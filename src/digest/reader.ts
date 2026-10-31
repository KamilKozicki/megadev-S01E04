import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

type RunRecord = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function validDate(date: string): boolean {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function isRecord(value: unknown): value is RunRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.at === 'string'
    && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(record.at)
    && validDate(record.at.slice(0, 10))
    && Number.isFinite(Date.parse(record.at))
    && typeof record.job === 'string' && record.job.trim().length > 0
    && (record.status === 'ok' || record.status === 'retry' || record.status === 'fail')
    && (record.owner === null || typeof record.owner === 'string')
    && (record.error === undefined || typeof record.error === 'string');
}

function compareJobs(a: DigestRow, b: DigestRow): number {
  const left = Array.from(a.job, (character) => character.codePointAt(0) ?? 0);
  const right = Array.from(b.job, (character) => character.codePointAt(0) ?? 0);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || !validDate(night)) return null;

  let contents: string;
  try {
    contents = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }

  const digest: NightDigest = { night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } };
  const records: RunRecord[] = [];
  for (const line of contents.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const value: unknown = JSON.parse(line);
      if (!isRecord(value)) {
        digest.badLines++;
        continue;
      }
      records.push(value);
    } catch {
      digest.badLines++;
    }
  }

  // Stable sorting keeps original file order for equal instants.
  records.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const jobs = new Map<string, DigestRow>();
  for (const record of records) {
    digest.counts[record.status]++;
    let row = jobs.get(record.job);
    if (!row) {
      row = {
        job: record.job, owner: record.owner, runs: 0, retries: 0, failures: 0,
        lastStatus: record.status, lastError: null, firstAt: record.at, lastAt: record.at,
      };
      jobs.set(record.job, row);
    }
    row.runs++;
    if (record.status === 'retry') row.retries++;
    if (record.status === 'fail') row.failures++;
    row.owner = record.owner;
    row.lastStatus = record.status;
    row.lastAt = record.at;
    if (record.error !== undefined) row.lastError = record.error;
  }
  digest.rows = Array.from(jobs.values()).sort(compareJobs);
  return digest;
};
