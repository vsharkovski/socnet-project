import Graph from 'graphology';
import { readCsv } from '../file-utils';
import { createFullGraph } from '../graph';
import { Edge, Party, Politician } from '../model';

const PARTIES_ORDERED: Party[] = ['republican', 'democratic'];

async function main(): Promise<void> {
  const politicians = await readCsv<Politician>('output/c117-politicians.csv');
  const edges = await readCsv<Edge>('output/c117-edges.csv');
  const realGraph = createFullGraph(politicians, edges);

  // E / (V * (V-1))
  const edgeProbability =
    politicians.length === 0
      ? 0
      : edges.length / (politicians.length * (politicians.length - 1));

  const count = new Map<Party, number>();
  for (const p of PARTIES_ORDERED) {
    count.set(p, 0);
  }

  realGraph.forEachNode((_, attributes) => {
    count.set(attributes.party, count.get(attributes.party)! + 1);
  });

  const partyProbability = count.get(PARTIES_ORDERED[0])! / politicians.length;

  const randomGraph = createRandomGraph(
    politicians.length,
    edgeProbability,
    partyProbability
  );
}

function createRandomGraph(
  nodeCount: number,
  edgeProbability: number,
  partyProbability: number
): Graph {
  const graph = new Graph();

  for (let i = 0; i < nodeCount; i++) {
    const partyIndex = Math.random() < partyProbability ? 0 : 1;
    const party = PARTIES_ORDERED[partyIndex];
    graph.addNode(i, { label: i, party: party });
  }

  for (let i = 0; i < nodeCount; i++) {
    for (let j = 0; j < nodeCount; j++) {
      if (j == i) continue;

      const x = Math.random();
      if (x < edgeProbability) {
        graph.addDirectedEdge(i, j, { weight: 1 });
      }
    }
  }

  return graph;
}

main();
