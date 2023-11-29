import Papa from 'papaparse';
import Graph from 'graphology';
import { circular } from 'graphology-layout';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import Sigma from 'sigma';

const COLORS: Record<string, string> = {
  democratic: '#5A75DB',
  republican: '#FA5A3D',
};

async function main(): Promise<void> {
  const graph: Graph = new Graph();

  await new Promise<void>((resolve) => {
    Papa.parse<{ name: string; party: string }>('public/politicians.csv', {
      download: true,
      header: true,
      delimiter: ',',
      complete: (results) => {
        results.data.forEach((line) => {
          if (!graph.hasNode(line.name)) {
            // Create the node
            console.log('Adding node', line.name);

            graph.addNode(line.name, {
              label: line.name,
              color: COLORS[line.party],
            });
          }
        });
        resolve();
      },
    });
  });

  await new Promise<void>((resolve) => {
    Papa.parse<{ from: string; to: string }>('public/edges.csv', {
      download: true,
      header: true,
      delimiter: ',',
      complete: (results) => {
        results.data.forEach((line) => {
          // Create the edge
          if (
            line.from &&
            line.to &&
            !graph.hasDirectedEdge(line.from, line.to)
          ) {
            console.log(`Adding edge '${line.from}' - '${line.to}'`);

            graph.addDirectedEdge(line.from, line.to, { weight: 1 });
          }
        });
        resolve();
      },
      error: (error) => {
        console.error(error);
      },
    });
  });

  // Use degrees for node sizes
  const degrees = graph.nodes().map((node) => graph.degree(node));
  const minDegree = Math.min(...degrees);
  const maxDegree = Math.max(...degrees);
  const degreeDistance = maxDegree - minDegree;
  const minSize = 2;
  const maxSize = 15;
  const sizeDistance = maxSize - minSize;

  graph.forEachNode((node) => {
    const degree = graph.degree(node);
    graph.setNodeAttribute(
      node,
      'size',
      minSize + ((degree - minDegree) / degreeDistance) * sizeDistance
    );
  });

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
  new Sigma(graph, container);
}

main();
