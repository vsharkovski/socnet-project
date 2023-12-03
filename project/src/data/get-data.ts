import { existsSync, mkdirSync } from 'fs';
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
import { loadOrGet, writeCsv } from '../file-utils';
import { getSample } from '../stats-utils';
import { Edge, Party, Politician } from '../model';

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

async function main(): Promise<void> {
  async function congress117() {
    // 117th Congress
    const candidateIds = await loadOrGet('output/c117-candidates.json', () =>
      getBacklinks(WIKIDATA_API_URL, IDS.ENTITY.US.CONGRESS.CONGRESS_117)
    );
    const politicians = await loadOrGet('output/c117-politicians.json', () =>
      getPoliticians(candidateIds)
    );
    await writeCsv('output/c117-politicians.csv', politicians);
    const politicianNames = politicians.map((p) => p.name);
    const edges = await getEdges(politicianNames, politicianNames);
    await writeCsv('output/c117-edges.csv', edges);
  }

  async function usPoliticians(): Promise<Politician[]> {
    const candidateIds = await loadOrGet(
      'output/us-candidates.json',
      async () => {
        const entityIds = [
          IDS.ENTITY.US.POSITION.SENATOR,
          IDS.ENTITY.US.POSITION.REPRESENTATIVE,
          IDS.ENTITY.US.POSITION.PRESIDENT,
          IDS.ENTITY.US.POSITION.VICE_PRESIDENT,
        ];
        const results = [];

        for (const entityId of entityIds) {
          const result = await getBacklinks(WIKIDATA_API_URL, entityId);
          results.push(result);
        }

        return results.flat();
      }
    );

    const politicians = await loadOrGet('output/us-politicians.json', () =>
      getPoliticians(candidateIds)
    );

    await writeCsv('output/us-politicians.csv', politicians);

    return politicians;
  }

  async function controversialGroup() {
    // Controversial US politicians
    // Adding party as well in order to ensure they are added to list of politicians,
    // even if they are skipped in the getPoliticians step (happened with e.g. George Santos)
    const sources = [
      ['Marjorie Taylor Greene', 'republican'],
      ['Ron DeSantis', 'republican'],
      ['Alexandria Ocasio-Cortez', 'democratic'],
      ['Ilhan Omar', 'democratic'],
      ['Matt Gaetz', 'republican'],
      ['Bernie Sanders', 'democratic'],
      ['George Santos', 'republican'],
      ['Lauren Boebert', 'republican'],
      ['Joe Manchin', 'democratic'],
      ['Donald Trump', 'republican'],
    ];
    const sourcesPoliticians: Politician[] = sources.map((source) => ({
      name: source[0],
      party: source[1] as Party,
    }));
    await writeCsv('output/contr-politicians.csv', sourcesPoliticians);

    const politicians = await usPoliticians();
    for (const p of sourcesPoliticians) {
      politicians.push(p);
    }

    const sourcesNames = sourcesPoliticians.map((p) => p.name);
    const politicianNames = politicians.map((p) => p.name);
    const edges = await getEdges(sourcesNames, politicianNames);
    await writeCsv('output/contr-edges.csv', edges);
  }

  async function randomSample() {
    const politicians = await usPoliticians();

    // Random sample
    const sources = getSample(politicians, 20);
    writeCsv('output/random-politicians.csv', sources);

    const politicianNames = politicians.map((p) => p.name);
    const sourcesNames = sources.map((p) => p.name);
    const edges = await getEdges(sourcesNames, politicianNames);
    await writeCsv('output/random-edges.csv', edges);
  }

  if (!existsSync('output')) {
    mkdirSync('output');
  }

  await congress117();
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

async function getEdges(
  sources: string[],
  validEnds: string[]
): Promise<Edge[]> {
  const validEndsSet = new Set(validEnds);
  const edges: Edge[] = [];

  for (const source of sources) {
    const links = await getLinksNoFooter(source);

    for (const end of links) {
      if (validEndsSet.has(end)) {
        edges.push({ from: source, to: end });
      }
    }
  }

  return edges;
}

async function getLinksNoFooter(title: string): Promise<string[]> {
  const wikitext = await getWikitext(WIKIPEDIA_API_URL, title);
  if (!wikitext) return [];

  let endIndex: number = wikitext.indexOf('External Links');
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
