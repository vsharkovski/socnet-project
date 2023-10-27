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
const GRAPH_FILE = 'output/graph.json';

async function main(): Promise<void> {
  if (!existsSync('output')) {
    mkdirSync('output');
  }

  const candidateIds = await getAllCandidateIds();
  console.log('Candidate IDs', candidateIds);

  const politicianNames = await getAllPoliticianNames(candidateIds);
  console.log('Politician names', politicianNames);

  const graph = await getGraph(politicianNames);
  // const graph: Edge[] = [];

  const shortenName = (s: string): string => {
    const a = s.split(' ');
    if (a.length == 1) return s;
    a[0] = a[0][0];
    return a.join('');
  };

  console.log('Graph edge count:', graph.length);
  for (const edge of graph) {
    console.log(shortenName(edge.from), shortenName(edge.to));
  }
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

  // const CANDIDATE_VALID_OCCUPATIONS = [
  //   ENTITIY_IDS.US_SENATOR,
  //   ENTITIY_IDS.US_REPRESENTATIVE,
  //   ENTITIY_IDS.US_PRESIDENT,
  //   ENTITIY_IDS.US_VICE_PRESIDENT,
  // ];

  // const uniqueCandidateIds = new Set<string>();

  // for (const occupationId of CANDIDATE_VALID_OCCUPATIONS) {
  //   console.log(`Getting candidates with occupation ${occupationId}`);
  //   const candidatesWithOccupation = await getBacklinks(
  //     WIKIDATA_API_URL,
  //     occupationId
  //   );
  //   console.log(
  //     `Candidate ids with occupation ${occupationId}:`,
  //     candidatesWithOccupation
  //   );

  //   for (const candidateId of candidatesWithOccupation) {
  //     uniqueCandidateIds.add(candidateId);
  //   }
  // }

  // candidateIds = Array.from(uniqueCandidateIds);

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

async function getGraph(politicianNames: string[]): Promise<Edge[]> {
  let graph = readJson<Edge[]>(GRAPH_FILE);

  if (graph) {
    return graph;
  }

  console.log('Creating graph');
  graph = await constructGraph(politicianNames);

  writeJson(GRAPH_FILE, graph);

  return graph;
}

async function constructGraph(titles: string[]): Promise<Edge[]> {
  const nodes = new Set(titles);
  const edges: Edge[] = [];

  await doBatched(titles, BATCH_SIZE, async (batchTitles) => {
    console.log('Getting links with filtering');

    const results = await doBatched(titles, BATCH_SIZE, async (batchTitles2) =>
      getLinks(WIKIPEDIA_API_URL, batchTitles2, batchTitles)
    );

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
