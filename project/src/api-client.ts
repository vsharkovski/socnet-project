import { Entity, EntityResponse } from './entity-response';
import { QueryResponse } from './query-response';

// API URLs.
export const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php';
export const WIKIPEDIA_API_URL = 'https://en.wikipedia.org/w/api.php';

// Batch size when sending multiple items to APIs.
export const BATCH_SIZE = 50;

// Hard limit on batch size enforced by APIs.
export const MAX_BATCH_SIZE = 50;

// Wikidata IDs of relevant properties and entities.
export const PROPERTY_IDS = {
  INSTANCE_OF: 'P31',
  OCCUPATION: 'P106',
};

export const ENTITIY_IDS = {
  POLITICIAN: 'Q82955',
  US_SENATOR: 'Q4416090',
  US_REPRESENTATIVE: 'Q13218630',
  US_PRESIDENT: 'Q11696',
  US_VICE_PRESIDENT: 'Q11699',
};

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

export interface LinkResult {
  title: string;
  links: string[];
}

/**
 * @param type All links ('all'), or just links pointing to other wiki pages ('interwiki').
 * NOTE: 'interwiki' works on Wikipedia, but not on Wikidata.
 * @returns The requested links for the given page titles.
 */
export async function getLinks(
  apiUrl: string,
  type: 'all' | 'interwiki',
  titles: string[]
): Promise<LinkResult[]> {
  if (titles.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Too many items (${titles.length}), max is ${MAX_BATCH_SIZE}`
    );
  }

  const initialParams = createParams({
    format: 'json',
    formatversion: '2',
    action: 'query',
    prop: type === 'all' ? 'links' : 'iwlinks',
    pllimit: 'max',
    iwlimit: 'max',
    titles: titles.join('|'),
  });

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

export async function getEntityIdsPointingTo(
  entityId: string
): Promise<string[]> {
  const initialParams = createParams({
    format: 'json',
    formatversion: '2',
    generator: 'backlinks',
    gblnamespace: '0', // Main Wikidata namespace, i.e. items.
    gbllimit: 'max',
    gbltitle: entityId,
    action: 'query',
    props: 'info',
  });

  return getResultsWithCompletion<QueryResponse, string>(
    WIKIDATA_API_URL,
    initialParams,
    (json) => json.query.pages.flatMap((page) => page.title),
    (json) =>
      json.continue?.gblcontinue
        ? createParams(initialParams, {
            gblcontinue: json.continue.gblcontinue,
          })
        : null
  );
}

export async function getPoliticianNames(
  entityIds: string[]
): Promise<string[]> {
  if (entityIds.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Too many items (${entityIds.length}), max is ${MAX_BATCH_SIZE}`
    );
  }

  const isPolitician = (entity: Entity) =>
    entity.claims.hasOwnProperty(PROPERTY_IDS.OCCUPATION) &&
    entity.claims[PROPERTY_IDS.OCCUPATION].some(
      (obj) => obj.mainsnak.datavalue.value.id === ENTITIY_IDS.POLITICIAN
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
        .filter(isPolitician)
        .filter((entity) => entity.labels.hasOwnProperty('en'))
        .map((entity) => entity.labels.en.value),
    (json) => null
  );
}
