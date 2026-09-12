// PRD §5.5: these views/functions live in db/06_queries.sql (owned by the
// corpus side of the team, PRD §10). The API's job is thin: SELECT ... LIMIT
// from the view/function and pass the row shape straight through -- it never
// re-derives the analytics itself (PRD §1.3 "one feature, one place").
export type TopNarratorRow = Record<string, unknown>;
export type ContestedNarratorRow = Record<string, unknown>;
export type SharedNarratorRow = Record<string, unknown>;
export type CircleOverviewRow = Record<string, unknown>;
export type WeakestChainRow = Record<string, unknown>;
export type AssignmentCompletionRow = Record<string, unknown>;
