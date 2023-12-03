export function getSample<T>(data: T[], size: number): T[] {
  const dataCopy: T[] = [...data];
  const sample: T[] = [];

  for (let i = 0; i < Math.min(size, dataCopy.length); i++) {
    let j = Math.floor(Math.random() * dataCopy.length);
    sample.push(dataCopy[j]);
    dataCopy.splice(j, 1);
  }

  return sample;
}
