import { ObjectMap } from 'csv-writer/src/lib/lang/object';
import { createObjectCsvWriter } from 'csv-writer';
import { readFileSync, writeFileSync } from 'fs';
import Papa from 'papaparse';

export async function loadOrGet<T>(
  jsonPath: string,
  getter: () => Promise<T[]>
): Promise<T[]> {
  let data = readJson<T[]>(jsonPath);
  if (data) {
    return data;
  }

  data = await getter();
  writeJson(jsonPath, data);
  return data;
}

export function readJson<T>(file: string): T | null {
  try {
    const buffer = readFileSync(file);
    const dataStringified = buffer.toString();
    const data = JSON.parse(dataStringified);
    const casted = data as T;
    console.log(`Successfully read from file: ${file}`);
    return casted;
  } catch (error) {
    console.log(`Could not read from file: ${file}`);
    return null;
  }
}

export function writeJson<T>(file: string, data: T): void {
  const dataStringified = JSON.stringify(data);

  try {
    writeFileSync(file, dataStringified);
    console.log(`Successfully wrote to file: ${file}`);
  } catch (error) {
    console.error(`Could not write to file: ${file}`, error);
  }
}

export async function readCsv<T>(path: string): Promise<T[]> {
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

export async function writeCsv<T extends ObjectMap<any>>(
  path: string,
  data: T[]
): Promise<void> {
  if (data.length == 0) {
    console.log(`Data empty, not writing to ${path}`);
    return;
  }

  const header = Object.keys(data[0]).map((key) => ({ id: key, title: key }));

  const writer = createObjectCsvWriter({
    path: path,
    header: header,
  });

  return writer.writeRecords(data);
}
