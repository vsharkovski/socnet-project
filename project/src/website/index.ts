import Papa from 'papaparse';
import Graph from 'graphology';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { Edge, Party, Politician } from '../data/get-data';

const COLORS: Record<Party, string> = {
  democratic: '#5A75DB',
  republican: '#FA5A3D',
};

async function main(): Promise<void> {
  async function congress117(): Promise<Graph> {
    const edgeLines = await readCsv<Edge>('output/c117-edges.csv');
    const politicianLines = await readCsv<Politician>(
      'output/c117-politicians.csv'
    );
    const sample = getSample(politicianLines, 20);
    const graph = createFullGraph(sample, edgeLines);
    resizeNodes(graph, 2, 15);
    return graph;
  }

  async function controversialGroup(): Promise<Graph> {
    const politicianLines = await readCsv<Politician>(
      'output/us-politicians.csv'
    );
    const sourcesLines = await readCsv<Politician>(
      'output/contr-politicians.csv'
    );
    const edgeLines = await readCsv<Edge>('output/contr-edges.csv');
    const sources = sourcesLines.map((line) => line.name);
    const graph = createIndividualGraph(politicianLines, edgeLines, sources);
    resizeNodes(graph, 6, 15);
    return graph;
  }

  async function randomSample(): Promise<Graph> {
    const politicianLines = await readCsv<Politician>(
      'output/us-politicians.csv'
    );
    const sourcesLines = await readCsv<Politician>(
      'output/random-politicians.csv'
    );
    const edgeLines = await readCsv<Edge>('output/random-edges.csv');
    const sources = sourcesLines.map((line) => line.name);
    const graph = createIndividualGraph(politicianLines, edgeLines, sources);
    resizeNodes(graph, 6, 15);
    return graph;
  }

  const graph = await randomSample();

  // Position nodes on a circle, then run Force Atlas 2 for a while to get
  // proper graph layout
  circular.assign(graph);
  const settings = forceAtlas2.inferSettings(graph);
  forceAtlas2.assign(graph, { settings, iterations: 600 });

  // Hide the loader from the DOM
  const loader = document.getElementById('loader') as HTMLElement;
  loader.style.display = 'none';

  // Draw the graph using sigma
  const container = document.getElementById('sigma-container') as HTMLElement;

  const renderer = new Sigma(graph, container, {
    labelRenderedSizeThreshold: 0,
    labelDensity: 10,
  });
}

function createFullGraph(
  politicianLines: Politician[],
  edgeLines: Edge[]
): Graph {
  const graph: Graph = new Graph();

  for (const line of politicianLines) {
    if (graph.hasNode(line.name)) continue;
    // Create the node
    console.log('Adding node', line.name);
    graph.addNode(line.name, {
      label: line.name,
      color: COLORS[line.party],
    });
  }

  for (let line of edgeLines) {
    if (
      line.from &&
      line.to &&
      graph.hasNode(line.from) &&
      graph.hasNode(line.to) &&
      !graph.hasDirectedEdge(line.from, line.to)
    ) {
      // Create the edge
      console.log(`Adding edge ${line.from} - ${line.to}`);
      graph.addDirectedEdge(line.from, line.to, { weight: 1 });
    }
  }

  return graph;
}

function createIndividualGraph(
  politicianLines: Politician[],
  edgeLines: Edge[],
  sources: string[]
): Graph {
  const graph: Graph = new Graph();

  const sourcesSet = new Set(sources);
  const relevant = new Set<string>();

  for (const line of edgeLines) {
    if (sourcesSet.has(line.from)) {
      relevant.add(line.from);
      relevant.add(line.to);
    }
  }

  for (const line of politicianLines) {
    if (!relevant.has(line.name) || graph.hasNode(line.name)) continue;
    // Create the node
    console.log('Adding node', line.name);
    graph.addNode(line.name, {
      label: line.name,
      color: COLORS[line.party],
    });
  }

  for (let line of edgeLines) {
    if (
      line.from &&
      line.to &&
      graph.hasNode(line.from) &&
      graph.hasNode(line.to) &&
      !graph.hasDirectedEdge(line.from, line.to)
    ) {
      // Create the edge
      console.log(`Adding edge ${line.from} - ${line.to}`);
      graph.addDirectedEdge(line.from, line.to, { weight: 1 });
    }
  }

  return graph;
}

function resizeNodes(graph: Graph, minSize: number, maxSize: number): void {
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

async function readCsv<T>(path: string): Promise<T[]> {
  return new Promise<T[]>((resolve) => {
    Papa.parse<T>(path, {
      download: true,
      header: true,
      delimiter: ',',
      complete: (results) => resolve(results.data),
      error: (error) => console.error(error),
    });
  });
}

function getSample<T>(data: T[], size: number): T[] {
  const dataCopy: T[] = [...data];
  const sample: T[] = [];

  for (let i = 0; i < Math.min(size, dataCopy.length); i++) {
    let j = Math.floor(Math.random() * dataCopy.length);
    sample.push(dataCopy[j]);
    dataCopy.splice(j, 1);
  }

  return sample;
}

main();
