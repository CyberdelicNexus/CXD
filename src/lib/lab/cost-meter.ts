// Accumulates what the providers bill for a unit of work (one arm, one judge
// call), including calls that fail after the provider has charged for them:
// max_tokens, refusals, unparseable output, and a critique draft whose revision
// then fails. Pure: safe anywhere.
export class CostMeter {
  costUsd = 0;
  inputTokens = 0;
  outputTokens = 0;

  add(costUsd: number, inputTokens = 0, outputTokens = 0): void {
    this.costUsd += costUsd;
    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
  }
}
