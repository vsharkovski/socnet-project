/**
 * Apply `handler` to each element of contiguous blocks (batches) of `values` of size `batchSize`.
 * @param values
 * @param batchSize
 * @param handler A function which takes a batch of T[], and them maps into
 * a resulting G[] or returns nothing.
 * @returns All results G[] of each batch concatenated.
 */
export async function doBatched<T, G>(
  values: T[],
  batchSize: number,
  handler: (batchValues: T[]) => Promise<G[] | void>
): Promise<G[]> {
  const allResults: G[] = [];
  let batchNumber = 0;

  for (
    let batchStartIndex = 0;
    batchStartIndex < values.length;
    batchStartIndex += batchSize
  ) {
    batchNumber++;
    const batchEndIndex = Math.min(batchStartIndex + batchSize, values.length);
    const batchValues = values.slice(batchStartIndex, batchEndIndex);

    console.log(`Doing batch ${batchNumber}; values: ${batchValues}`);
    const batchResults = await handler(batchValues);

    if (batchResults) {
      for (const result of batchResults) {
        allResults.push(result);
      }
    }
  }

  return allResults;
}
