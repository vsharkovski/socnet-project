import Graph from 'graphology';
import { Edge, Party, Politician } from './model';

const COLORS: Record<Party, string> = {
  democratic: '#5A75DB',
  republican: '#FA5A3D',
};

export function createFullGraph(
  politicians: Politician[],
  edges: Edge[]
): Graph {
  const graph: Graph = new Graph();

  for (const politician of politicians) {
    if (graph.hasNode(politician.name)) continue;
    graph.addNode(politician.name, {
      label: politician.name,
      color: COLORS[politician.party],
    });
  }

  for (let edge of edges) {
    if (
      graph.hasNode(edge.from) &&
      graph.hasNode(edge.to) &&
      !graph.hasDirectedEdge(edge.from, edge.to)
    ) {
      graph.addDirectedEdge(edge.from, edge.to, { weight: 1 });
    }
  }

  return graph;
}

export function createIndividualGraph(
  politicians: Politician[],
  edges: Edge[],
  sources: string[]
): Graph {
  const graph: Graph = new Graph();

  const sourcesSet = new Set(sources);
  const relevant = new Set<string>();

  for (const edge of edges) {
    if (sourcesSet.has(edge.from)) {
      relevant.add(edge.from);
      relevant.add(edge.to);
    }
  }

  for (const politician of politicians) {
    if (!relevant.has(politician.name) || graph.hasNode(politician.name))
      continue;
    graph.addNode(politician.name, {
      label: politician.name,
      color: COLORS[politician.party],
    });
  }

  for (let edge of edges) {
    if (
      graph.hasNode(edge.from) &&
      graph.hasNode(edge.to) &&
      !graph.hasDirectedEdge(edge.from, edge.to)
    ) {
      graph.addDirectedEdge(edge.from, edge.to, { weight: 1 });
    }
  }

  return graph;
}

export function resizeNodes(
  graph: Graph,
  minSize: number,
  maxSize: number
): void {
  // Use degrees for node sizes
  const degrees = graph.nodes().map((node) => graph.degree(node));
  const minDegree = Math.min(...degrees);
  const maxDegree = Math.max(...degrees);
  const degreeDistance = maxDegree - minDegree;
  const sizeDistance = maxSize - minSize;

  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    graph.setNodeAttribute(
      node,
      'size',
      minSize + ((degree - minDegree + 1) / (degreeDistance + 1)) * sizeDistance
    );
  });
}
