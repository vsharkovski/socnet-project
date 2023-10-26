import { readFileSync, writeFileSync } from 'fs';

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
