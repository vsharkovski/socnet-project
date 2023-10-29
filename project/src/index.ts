import { existsSync, mkdirSync } from 'fs';
import { readJson, writeJson } from './json-utils';
import {
  BATCH_SIZE,
  ENTITIY_IDS,
  WIKIDATA_API_URL,
  WIKIPEDIA_API_URL,
  getBacklinks,
  getLinks,
  getPoliticianNames,
} from './api-client';
import { doBatched } from './batch-utils';

// File names.
const CANDIDATES_FILE = 'output/candidates.json';
const POLITICIAN_NAMES_FILE = 'output/politician-names.json';
const EDGES_FILE = 'output/edges.json';

async function main(): Promise<void> {
  if (!existsSync('output')) {
    mkdirSync('output');
  }

  const candidateIds = await getAllCandidateIds();
  console.log('Candidate IDs', candidateIds);

  const politicianNames = await getAllPoliticianNames(candidateIds);
  console.log('Politician names', politicianNames);

  const edges = await getEdges(politicianNames);
  console.log('Graph edges', edges);

  console.log('Graph node count:', politicianNames.length);
  console.log('Graph edge count:', edges.length);
}

async function getAllCandidateIds(): Promise<string[]> {
  let candidateIds = readJson<string[]>(CANDIDATES_FILE);
  if (candidateIds) {
    return candidateIds;
  }

  console.log('Getting candidate IDs');

  candidateIds = await getBacklinks(
    WIKIDATA_API_URL,
    ENTITIY_IDS.US_CONGRESS_117
  );

  writeJson(CANDIDATES_FILE, candidateIds);

  return candidateIds;
}

async function getAllPoliticianNames(
  candidateIds: string[]
): Promise<string[]> {
  let politicianNames = readJson<string[]>(POLITICIAN_NAMES_FILE);
  if (politicianNames) {
    return politicianNames;
  }

  console.log('Getting politician names');
  politicianNames = await doBatched(
    candidateIds,
    BATCH_SIZE,
    getPoliticianNames
  );

  writeJson(POLITICIAN_NAMES_FILE, politicianNames);

  return politicianNames;
}

interface Edge {
  from: string;
  to: string;
}

async function getEdges(politicianNames: string[]): Promise<Edge[]> {
  let edges = readJson<Edge[]>(EDGES_FILE);

  if (edges) {
    return edges;
  }

  console.log('Getting edges');
  edges = await getEdgesBetweenTitles(politicianNames);

  writeJson(EDGES_FILE, edges);

  return edges;
}

async function getEdgesBetweenTitles(titles: string[]): Promise<Edge[]> {
  const nodes = new Set(titles);
  const edges: Edge[] = [];

  await doBatched(titles, BATCH_SIZE, async (batchTitles) => {
    const results = await getLinks(WIKIPEDIA_API_URL, batchTitles);

    for (const result of results) {
      for (const link of result.links) {
        if (nodes.has(link)) {
          edges.push({ from: result.title, to: link });
        }
      }
    }
  });

  return edges;
}

main();
