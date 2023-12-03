import Graph from 'graphology';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';
import { Edge, Politician } from '../model';
import { getSample } from '../stats-utils';
import { readCsv } from '../file-utils';
import { createFullGraph, createIndividualGraph, resizeNodes } from '../graph';

async function main(): Promise<void> {
  async function congress117(): Promise<Graph> {
    const edges = await readCsv<Edge>('output/c117-edges.csv');
    const politicians = await readCsv<Politician>(
      'output/c117-politicians.csv'
    );
    const sample = getSample(politicians, 20);
    const graph = createFullGraph(sample, edges);
    resizeNodes(graph, 2, 15);
    return graph;
  }

  async function controversialGroup(): Promise<Graph> {
    const politicians = await readCsv<Politician>('output/us-politicians.csv');
    const sources = await readCsv<Politician>('output/contr-politicians.csv');
    const edges = await readCsv<Edge>('output/contr-edges.csv');
    const sourcesNames = sources.map((line) => line.name);
    const graph = createIndividualGraph(politicians, edges, sourcesNames);
    resizeNodes(graph, 6, 15);
    return graph;
  }

  async function randomSample(): Promise<Graph> {
    const politicians = await readCsv<Politician>('output/us-politicians.csv');
    const sources = await readCsv<Politician>('output/random-politicians.csv');
    const edges = await readCsv<Edge>('output/random-edges.csv');
    const sourcesNames = sources.map((line) => line.name);
    const graph = createIndividualGraph(politicians, edges, sourcesNames);
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

main();
