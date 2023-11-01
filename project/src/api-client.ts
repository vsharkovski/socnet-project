// API URLs.
export const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
export const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

// Hard limit on batch size enforced by APIs.
export const MAX_BATCH_SIZE = 50;

/**
 * A pair of: a page's title, and links associated with that page.
 */
export interface LinkResult {
  title: string;
  links: string[];
}

export interface EntityResponse {
  entities: {
    [id: string]: Entity;
  };
}

export interface Entity {
  id: string;
  labels: {
    [language: string]: {
      language: string;
      value: string;
    };
  };
  claims: {
    [propertyId: string]: Property[];
  };
}

export interface Property {
  mainsnak: Snak;
  qualifiers?: {
    [propertyId: string]: Snak[];
  };
}

export interface Snak {
  datavalue: {
    value: {
      id?: string;
      time?: string;
    };
  };
}

export interface QueryResponse {
  continue?: {
    continue?: string;
    plcontinue?: string;
    blcontinue?: string;
    gblcontinue?: string;
  };
  query: {
    pages: QueryPage[];
    backlinks: QueryPage[];
  };
}

export interface QueryPage {
  title: string;
  links?: {
    title: string;
  }[];
}

export interface ParseResponse {
  parse: {
    wikitext: string;
  };
}

/**
 * @returns URLSearchParams from merging existing URLSearchParams
 * and/or objects of key-value pairs of strings.
 */
export function createParams(
  ...options: Array<Record<string, string> | URLSearchParams>
): URLSearchParams {
  return new URLSearchParams([
    ...options.flatMap((option) => {
      if (option instanceof URLSearchParams) {
        const asParams = option as URLSearchParams;
        const entries = asParams.entries();
        return Array.from(entries);
      } else {
        // Record
        const asRecord = option as unknown as Record<string, string>;
        return Object.entries(asRecord);
      }
    }),
  ]);
}

export async function getResponse<T>(
  url: string,
  params: URLSearchParams
): Promise<T> {
  const finalUrl = `${url}?${params}`;
  console.log('Sending request:', finalUrl);

  const response = await fetch(finalUrl);

  if (!response.ok) {
    throw new Error(
      `Failed GET request to ${finalUrl}: ${response.status} ${response.statusText}`
    );
  }

  const jsonUncasted = await response.json();
  const json = jsonUncasted as T;

  return json;
}

export async function getResults<T, G>(
  apiUrl: string,
  params: URLSearchParams,
  resultHandler: (json: T) => G[],
  continueHandler?: (json: T) => URLSearchParams | null
): Promise<G[]> {
  const allResults: G[] = [];
  let requestNumber = 0;

  while (true) {
    try {
      requestNumber++;
      console.log(`Sending request ${requestNumber}`);

      const json = await getResponse<T>(apiUrl, params);

      const results = resultHandler(json);
      for (const result of results) {
        allResults.push(result);
      }

      if (!continueHandler) break;

      const newParams = continueHandler(json);
      if (!newParams) break;

      params = newParams;
    } catch (error) {
      console.error(error);
      break;
    }
  }

  return allResults;
}

/**
 * @param validLinks Use API to filter for only these links.
 * @returns All links for the given pages, in the form of LinkResults.
 * There may be more than one LinkResult for the same page.
 */
export async function getAllLinks(
  apiUrl: string,
  titles: string[],
  validLinks?: string[]
): Promise<LinkResult[]> {
  let initialParams = createParams({
    format: 'json',
    formatversion: '2',
    action: 'query',
    prop: 'links',
    pllimit: 'max',
    titles: titles.join('|'),
  });

  if (validLinks) {
    initialParams = createParams(initialParams, {
      pltitles: validLinks.join('|'),
    });
  }

  return getResults<QueryResponse, LinkResult>(
    apiUrl,
    initialParams,
    (json) =>
      json.query.pages.map((page) => ({
        title: page.title,
        links: (page.links ?? []).map((link) => link.title),
      })),
    (json) =>
      json.continue?.plcontinue
        ? createParams(initialParams, {
            plcontinue: json.continue.plcontinue,
          })
        : null
  );
}

/**
 * @returns All backlinks for the given page (pages pointing to it).
 */
export async function getBacklinks(
  apiUrl: string,
  title: string
): Promise<string[]> {
  const initialParams = createParams({
    format: 'json',
    formatversion: '2',
    action: 'query',
    list: 'backlinks',
    bllimit: 'max',
    blnamespace: '0', // Main namespace.
    bltitle: title,
  });

  return getResults<QueryResponse, string>(
    apiUrl,
    initialParams,
    (json) => json.query.backlinks.flatMap((page) => page.title),
    (json) =>
      json.continue?.blcontinue
        ? createParams(initialParams, { blcontinue: json.continue.blcontinue })
        : null
  );
}

export async function getWikitext(
  apiUrl: string,
  title: string
): Promise<string | null> {
  const params = createParams({
    format: 'json',
    formatversion: '2',
    action: 'parse',
    prop: 'wikitext',
    page: title,
  });

  try {
    const response = await getResponse<ParseResponse>(apiUrl, params);
    return response.parse.wikitext;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function getEntities(entityIds: string[]): Promise<Entity[]> {
  const initialParams = createParams({
    format: 'json',
    formatversion: '2',
    action: 'wbgetentities',
    languages: 'en',
    props: 'labels|claims',
    ids: entityIds.join('|'),
  });

  return getResults<EntityResponse, Entity>(
    WIKIDATA_API_URL,
    initialParams,
    (json) => Object.values(json.entities)
  );
}

export function parseLinks(wikitext: string, endIndex?: number): string[] {
  const links: string[] = [];

  let startIndex = 0;
  if (endIndex === undefined) endIndex = wikitext.length;

  while (startIndex < wikitext.length) {
    const openBracketIndex = wikitext.indexOf('[[', startIndex);
    if (openBracketIndex === -1 || openBracketIndex >= endIndex) {
      break;
    }

    const closeBracketIndex = wikitext.indexOf(']]', openBracketIndex);
    if (closeBracketIndex === -1) {
      break;
    }

    const link = wikitext.substring(openBracketIndex + 2, closeBracketIndex);
    links.push(link);

    startIndex = closeBracketIndex + 1;
  }

  return links;
}
