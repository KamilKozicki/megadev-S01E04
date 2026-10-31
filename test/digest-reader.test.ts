import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/reader.js';

const night = '2026-10-28';
const directories: string[] = [];

function temporaryNight(lines: string[]): string {
  const directory = mkdtempSync(join(tmpdir(), 'rig-reader-'));
  directories.push(directory);
  writeFileSync(join(directory, `${night}.jsonl`), lines.join('\n'));
  return directory;
}

function record(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    at: '2026-10-29T01:00:00+01:00', job: 'backup', status: 'ok', owner: 'rook', ...overrides,
  });
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('readNight', () => {
  it('summarizes the real fixture without discarding the unknown owner or recovered errors', () => {
    const digest = readNight('runs', night);
    expect(digest).not.toBeNull();
    expect(digest?.badLines).toBe(1);
    expect(digest?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(digest?.rows.map((row) => row.job)).toEqual([
      'digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs',
    ]);
    expect(digest?.rows[0]).toMatchObject({ owner: null, runs: 1, lastError: null });
    expect(digest?.rows[1]).toEqual({
      job: 'fixtures/refresh', owner: 'rook', runs: 4, retries: 3, failures: 0,
      lastStatus: 'ok', lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00', lastAt: '2026-10-29T01:37:00+01:00',
    });
    expect(digest?.rows[2]).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok', lastError: 'lock held' });
    expect(digest?.rows[3]).toMatchObject({ failures: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('distinguishes a missing night from an empty or blank night', () => {
    const directory = temporaryNight(['', '  ', '\r']);
    expect(readNight(directory, '2026-10-27')).toBeNull();
    expect(readNight(directory, night)).toEqual({ night, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    writeFileSync(join(directory, `${night}.jsonl`), '');
    expect(readNight(directory, night)?.rows).toEqual([]);
  });

  it('counts invalid JSON and invalid record fields while retaining valid records', () => {
    const invalid = [
      '{broken', 'null', '[]', '{}', record({ owner: undefined }), record({ owner: 7 }),
      record({ status: 'unknown' }), record({ job: '  ' }), record({ error: null }),
      record({ at: '2026-10-29T01:00:00' }), record({ at: '2026-02-30T01:00:00+01:00' }),
      record({ at: '2026-10-29T25:00:00+01:00' }),
    ];
    const digest = readNight(temporaryNight([' ', ...invalid, record(), '']), night);
    expect(digest?.badLines).toBe(invalid.length);
    expect(digest?.rows).toHaveLength(1);
    expect(digest?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });

  it('uses chronological instants across offsets and file order for ties, preserving original text', () => {
    const digest = readNight(temporaryNight([
      record({ at: '2026-10-29T03:00:00+02:00', status: 'retry', error: 'latest error' }),
      record({ at: '2026-10-29T02:00:00+02:00', status: 'fail', error: 'older error' }),
      record({ at: '2026-10-29T02:00:00+01:00', owner: null }),
    ]), night);
    expect(digest?.rows[0]).toEqual({
      job: 'backup', owner: null, runs: 3, retries: 1, failures: 1,
      lastStatus: 'ok', lastError: 'latest error',
      firstAt: '2026-10-29T02:00:00+02:00', lastAt: '2026-10-29T02:00:00+01:00',
    });
    expect(digest?.counts).toEqual({ ok: 1, retry: 1, fail: 1 });
  });

  it('accepts Z and fractional timestamps and CRLF logs', () => {
    const directory = temporaryNight([]);
    writeFileSync(join(directory, `${night}.jsonl`), `${record({ at: '2026-10-29T01:00:00.123Z' })}\r\n${record({ job: 'sync' })}\r\n`);
    const digest = readNight(directory, night);
    expect(digest?.badLines).toBe(0);
    expect(digest?.rows[0].firstAt).toBe('2026-10-29T01:00:00.123Z');
    expect(digest?.rows).toHaveLength(2);
  });

  it('orders jobs by Unicode code point rather than locale or UTF-16 code unit', () => {
    const digest = readNight(temporaryNight(['😀', '\uE000', 'a', 'A', 'aa'].map((job) => record({ job }))), night);
    expect(digest?.rows.map((row) => row.job)).toEqual(['A', 'a', 'aa', '\uE000', '😀']);
  });

  it('rejects unsafe or invalid night names', () => {
    const directory = temporaryNight([record()]);
    for (const invalid of ['../2026-10-28', '2026-10-28/../2026-10-28', '2026-1-28', '2026-02-30', '2026-10-28\n']) {
      expect(readNight(directory, invalid)).toBeNull();
    }
  });

  it('does not disguise other filesystem errors as missing nights', () => {
    const directory = temporaryNight([]);
    const path = join(directory, `${night}.jsonl`);
    rmSync(path);
    mkdirSync(path);
    expect(() => readNight(directory, night)).toThrow();
  });
});
