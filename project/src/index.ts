import { existsSync, mkdirSync } from 'fs';
import { readJson, writeJson } from './json-utils';
import {
  Entity,
  MAX_BATCH_SIZE,
  Property,
  WIKIDATA_API_URL,
  WIKIPEDIA_API_URL,
  getBacklinks,
  getEntities,
  getWikitext,
  parseLinks,
} from './api-client';
import { doBatched } from './batch-utils';
import { exit } from 'process';

// File names.
const CANDIDATES_FILE = 'output/candidates.json';
const POLITICIANS_FILE = 'output/politicians.json';
const EDGES_FILE = 'output/edges.json';

// Batch size when sending multiple items to APIs.
const BATCH_SIZE = 50;

// Wikidata IDs of relevant properties and entities.
const IDS = {
  PROPERTY: {
    INSTANCE_OF: 'P31',
    POSITION_HELD: 'P39',
    OCCUPATION: 'P106',
    PARLIAMENTARY_GROUP: 'P4100',
  },
  ENTITY: {
    POLITICIAN: 'Q82955',
    US: {
      POSITION: {
        SENATOR: 'Q4416090',
        REPRESENTATIVE: 'Q13218630',
        PRESIDENT: 'Q11696',
        VICE_PRESIDENT: 'Q11699',
      },
      CONGRESS: {
        CONGRESS_118: 'Q104842452',
        CONGRESS_117: 'Q65089999',
      },
      PARTY: {
        REPUBLICAN: 'Q29468',
        DEMOCRATIC: 'Q29552',
      },
    },
  },
};

type Party = 'republican' | 'democratic';

interface Politician {
  name: string;
  party: Party;
}

interface Edge {
  from: string;
  to: string;
}

async function main(): Promise<void> {
  if (!existsSync('output')) {
    mkdirSync('output');
  }

  const candidateIds = await loadOrGetCandidateIds();
  console.log('Candidate IDs', candidateIds);

  const politicians = await loadOrGetPoliticians(candidateIds);
  console.log('Politicians', politicians);

  const politicianNames = politicians.map((p) => p.name);
  const edges = await loadOrGetEdges(politicianNames);
  console.log('Graph edges', edges);

  console.log('Graph node count:', politicians.length);
  console.log('Graph edge count:', edges.length);
}

async function loadOrGetCandidateIds(): Promise<string[]> {
  let candidateIds = readJson<string[]>(CANDIDATES_FILE);
  if (candidateIds) {
    return candidateIds;
  }

  console.log('Getting candidate IDs');

  candidateIds = await getBacklinks(
    WIKIDATA_API_URL,
    IDS.ENTITY.US.CONGRESS.CONGRESS_117
  );

  writeJson(CANDIDATES_FILE, candidateIds);

  return candidateIds;
}

async function loadOrGetPoliticians(
  candidateIds: string[]
): Promise<Politician[]> {
  let politicians = readJson<Politician[]>(POLITICIANS_FILE);
  if (politicians) {
    return politicians;
  }

  console.log('Getting politician names');
  politicians = await getPoliticians(candidateIds);

  writeJson(POLITICIANS_FILE, politicians);

  return politicians;
}

async function getPoliticians(candidateIds: string[]): Promise<Politician[]> {
  const entities = await doBatched(candidateIds, BATCH_SIZE, (batchIds) =>
    getEntities(batchIds)
  );

  const politicians: Politician[] = entities
    .map((entity) => {
      if (!Object.hasOwn(entity.labels, 'en')) return null;
      const name = entity.labels['en'].value;

      const party = getLatestParty(entity);
      if (party === null) return null;

      return { name: name, party: party };
    })
    .filter((politician): politician is Politician => politician !== null);

  return politicians;
}

function getLatestParty(entity: Entity): Party | null {
  if (!Object.hasOwn(entity.claims, IDS.PROPERTY.POSITION_HELD)) return null;

  const positions = entity.claims[IDS.PROPERTY.POSITION_HELD];
  const positionsWithParty = positions.filter(
    (position) =>
      position.qualifiers &&
      Object.hasOwn(position.qualifiers, IDS.PROPERTY.PARLIAMENTARY_GROUP)
  );
  if (positionsWithParty.length === 0) return null;

  const getDate = (position: Property) =>
    new Date(position.mainsnak.datavalue.value.time!);
  const latestPosition = positionsWithParty.reduce((latestSoFar, current) =>
    getDate(current) > getDate(latestSoFar) ? current : latestSoFar
  );

  const latestPositionPartyId =
    latestPosition.qualifiers![IDS.PROPERTY.PARLIAMENTARY_GROUP][0].datavalue
      .value.id!;
  return latestPositionPartyId === IDS.ENTITY.US.PARTY.REPUBLICAN
    ? 'republican'
    : 'democratic';
}

async function loadOrGetEdges(titles: string[]): Promise<Edge[]> {
  let edges = readJson<Edge[]>(EDGES_FILE);

  if (edges) {
    return edges;
  }

  console.log('Getting edges');
  edges = await getEdges(titles);

  writeJson(EDGES_FILE, edges);

  return edges;
}

async function getEdges(titles: string[]): Promise<Edge[]> {
  const nodes = new Set(titles);
  const edges: Edge[] = [];

  for (const title of titles) {
    const links = await getLinksNoFooter(title);

    for (const link of links) {
      if (nodes.has(link)) {
        edges.push({ from: title, to: link });
      }
    }
  }

  return edges;
}

async function getLinksNoFooter(title: string): Promise<string[]> {
  const wikitext = await getWikitext(WIKIPEDIA_API_URL, title);
  if (!wikitext) return [];

  let endIndex: number = wikitext.indexOf('== External Links ==');
  if (endIndex == -1) {
    return parseLinks(wikitext);
  } else {
    return parseLinks(wikitext, endIndex);
  }
}

// Tests.
if (BATCH_SIZE > MAX_BATCH_SIZE) {
  console.error(
    `BATCH_SIZE (${BATCH_SIZE}) should be at most MAX_BATCH_SIZE (${MAX_BATCH_SIZE})`
  );
  exit();
}

// Run main.
main();
