export interface PageParams {
  limit: number;
  offset: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePageParams(query: {
  limit?: string;
  offset?: string;
}): PageParams {
  const rawLimit = Number(query.limit);
  const rawOffset = Number(query.offset);

  const limit = Number.isInteger(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const offset = Number.isInteger(rawOffset) && rawOffset >= 0
    ? rawOffset
    : 0;

  return { limit, offset };
}
