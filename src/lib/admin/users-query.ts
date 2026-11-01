export const MAX_PAGE = 1_000_000;

type Param = string | string[] | undefined;

/** A repeated query parameter (`?q=a&q=b`) arrives as an array: take the first. */
export function singleParam(value: Param): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first !== '' ? first : undefined;
}

/** An integer from 1 to MAX_PAGE; anything else is page 1. */
export function parsePage(value: Param): number {
  const n = Number(singleParam(value));
  if (!Number.isInteger(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE);
}
