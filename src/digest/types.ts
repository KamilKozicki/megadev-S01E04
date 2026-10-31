export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job across the valid records in a night's log. */
export type DigestRow = {
  job: string;
  /** Owner on the latest record, including an explicitly unknown owner. */
  owner: string | null;
  /** All valid records for this job, including retries and failures. */
  runs: number;
  /** Number of records with status retry. */
  retries: number;
  /** Number of records with status fail, even if the job later recovered. */
  failures: number;
  lastStatus: RunStatus;
  /** Most recent supplied error; null if no record supplied one. */
  lastError: string | null;
  /** Earliest/latest event times, kept verbatim with their original offsets. */
  firstAt: string;
  lastAt: string;
};

/** Counts of valid log records, rather than counts of job summaries. */
export type DigestCounts = Record<RunStatus, number>;

export type NightDigest = {
  night: string;
  /** One row per job, sorted ascending by job with a stable code-point comparison. */
  rows: DigestRow[];
  /** Nonblank lines that are invalid JSON or do not match the log record schema. */
  badLines: number;
  counts: DigestCounts;
};

/**
 * Contract for readNight, to be implemented in src/digest/reader.ts.
 *
 * Read runsDir/<night>.jsonl synchronously. Accept only YYYY-MM-DD night names;
 * invalid names and absent files return null, so routes can return 404.
 * Other filesystem errors propagate rather than looking like missing nights.
 *
 * Empty files return a digest with empty rows, zero counts and zero badLines.
 * Blank lines are ignored. Malformed records increment badLines without
 * discarding valid records. A valid record has an offset-bearing timestamp,
 * a nonempty job, a RunStatus, a string or null owner, and an optional string
 * error. Never rewrite the log or normalize timestamps for display.
 *
 * First/latest refer to chronological event order; file order breaks timestamp
 * ties. The latest owner and status come from the latest valid record for a job.
 * The last error is the latest supplied error, including one before recovery.
 * Rows and counts are shared by HTML, JSON, and board views.
 */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
