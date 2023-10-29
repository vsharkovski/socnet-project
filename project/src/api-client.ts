import { Entity, EntityResponse } from './entity-response';
import { QueryResponse } from './query-response';

// API URLs.
export const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
export const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

// Hard limit on batch size enforced by APIs.
export const MAX_BATCH_SIZE = 50;

export interface LinkResult {
  title: string;
  links: string[];
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

export async function getResponse(
  url: string,
  params: URLSearchParams
): Promise<Response> {
  const finalUrl = `${url}?${params}`;
  console.log('Sending request:', finalUrl);

  const response = await fetch(finalUrl);

  if (!response.ok) {
    throw new Error(
      `Failed GET request to ${finalUrl}: ${response.status} ${response.statusText}`
    );
  }

  return response;
}

export async function getResultsWithCompletion<T, G>(
  apiUrl: string,
  params: URLSearchParams,
  resultHandler: (json: T) => G[],
  continueHandler: (json: T) => URLSearchParams | null
): Promise<G[]> {
  const allResults: G[] = [];
  let requestNumber = 0;

  while (true) {
    try {
      requestNumber++;
      console.log(`Sending request ${requestNumber}`);

      const response = await getResponse(apiUrl, params);
      const jsonUncasted = await response.json();
      const json = jsonUncasted as T;

      const results = resultHandler(json);
      for (const result of results) {
        allResults.push(result);
      }

      const newParams = continueHandler(json);
      if (!newParams) {
        break;
      }
      params = newParams;
    } catch (error) {
      console.error(error);
      break;
    }
  }

  return allResults;
}

/**
 * @param type All links ('all'), or just links pointing to other wiki pages ('interwiki').
 * NOTE: 'interwiki' works on Wikipedia, but not on Wikidata.
 * @param validLinks Use API to filter for only these links.
 * @returns All links for the given pages.
 */
export async function getLinks(
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

  return getResultsWithCompletion<QueryResponse, LinkResult>(
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

  return getResultsWithCompletion<QueryResponse, string>(
    apiUrl,
    initialParams,
    (json) => json.query.backlinks.flatMap((page) => page.title),
    (json) =>
      json.continue?.blcontinue
        ? createParams(initialParams, { blcontinue: json.continue.blcontinue })
        : null
  );
}

/**
 * @returns Names (labels in English) for the given entities, filtered for those
 * which have the given property with the given value.
 */
export async function getNamesFiltered(
  entityIds: string[],
  propertyId: string,
  propertyValue: string
): Promise<string[]> {
  const doesMatch = (entity: Entity) =>
    entity.claims.hasOwnProperty(propertyId) &&
    entity.claims[propertyId].some(
      (obj) => obj.mainsnak.datavalue.value.id === propertyValue
    );

  const initialParams = createParams({
    format: 'json',
    formatversion: '2',
    action: 'wbgetentities',
    languages: 'en',
    props: 'labels|claims',
    ids: entityIds.join('|'),
  });

  return getResultsWithCompletion<EntityResponse, string>(
    WIKIDATA_API_URL,
    initialParams,
    (json) =>
      Object.values(json.entities)
        .filter(doesMatch)
        .filter((entity) => entity.labels.hasOwnProperty('en'))
        .map((entity) => entity.labels.en.value),
    (json) => null
  );
}
