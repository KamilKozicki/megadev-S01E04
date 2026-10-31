import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-28';
const directories: string[] = [];

function temporaryRuns(contents: string): string {
  const directory = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  directories.push(directory);
  writeFileSync(join(directory, `${night}.jsonl`), contents);
  return directory;
}

function appFor(runsDir: string) {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
}

function record(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    at: '2026-10-29T01:00:00+01:00',
    job: 'backup',
    status: 'ok',
    owner: 'rook',
    ...overrides,
  });
}

function renderedRows(html: string): string[][] {
  const table = html.match(/<table\b[\s\S]*?<\/table>/)?.[0];
  if (!table) throw new Error('digest table was not rendered');

  return Array.from(table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g))
    .slice(1)
    .map(([, row]) => Array.from(row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g))
      .map(([, cell]) => decodeEntities(cell.replace(/<[^>]*>/g, ''))));
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('serves the digest as HTML and JSON, with matching sorted jobs and rendered cells', async () => {
    const runsDir = temporaryRuns([
      record({ job: 'zulu<script>', owner: 'sam', error: '</script><script>globalThis.pwned=1</script> & "x"' }),
      record({ job: 'backup', at: '2026-10-29T01:11:00+01:00', status: 'retry' }),
      record({ job: 'alpha', at: '2026-10-29T01:30:00+01:00', owner: null }),
      record({ job: 'backup', at: '2026-10-29T01:10:00+01:00', status: 'retry' }),
      '{malformed json',
      record({ job: 'backup', at: '2026-10-29T01:12:00+01:00', status: 'retry' }),
      record({ job: 'backup', at: '2026-10-29T01:13:00+01:00', status: 'fail', error: 'disk full', owner: null }),
      record({ job: 'backup', at: '2026-10-29T01:14:00+01:00', owner: null }),
    ].join('\n'));
    const app = appFor(runsDir);

    const htmlResponse = await app.request(`/digest/${night}`);
    const jsonResponse = await app.request(`/api/digest/${night}`);
    const html = await htmlResponse.text();
    const digest = await jsonResponse.json();

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(digest).toMatchObject({ night, badLines: 1 });
    expect(digest.rows.map((row: { job: string }) => row.job)).toEqual(['alpha', 'backup', 'zulu<script>']);
    const cells = renderedRows(html);
    expect(cells.map(([job]) => job)).toEqual(digest.rows.map((row: { job: string }) => row.job));
    expect(cells).toEqual([
      ['alpha', '—', '1', '0', 'ok', '—', '2026-10-29T01:30:00+01:00', '2026-10-29T01:30:00+01:00'],
      ['backup', '—', '5', '3', 'ok · failure', 'disk full', '2026-10-29T01:10:00+01:00', '2026-10-29T01:14:00+01:00'],
      ['zulu<script>', 'sam', '1', '0', 'ok', '</script><script>globalThis.pwned=1</script> & "x"', '2026-10-29T01:00:00+01:00', '2026-10-29T01:00:00+01:00'],
    ]);

    expect(html).toContain('1 malformed line');
    expect(html).toContain('class="warn"');
    expect(html).toContain('3</td>');
    expect(html).toContain('ok<span class="warn"> · failure</span>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).toContain('&amp;');
    expect(html).not.toMatch(/<script\b/i);
  });

  it('returns 404 for a night missing from the temporary runs directory', async () => {
    const runsDir = temporaryRuns('');
    const app = appFor(runsDir);

    const html = await app.request('/digest/2026-10-27');
    const json = await app.request('/api/digest/2026-10-27');

    expect(html.status).toBe(404);
    expect(json.status).toBe(404);
  });

  it('renders an empty night in HTML and returns an empty JSON rows array', async () => {
    const app = appFor(temporaryRuns(''));

    const htmlResponse = await app.request(`/digest/${night}`);
    const jsonResponse = await app.request(`/api/digest/${night}`);
    const html = await htmlResponse.text();
    const json = await jsonResponse.json();

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(html).toContain('nothing ran');
    expect(json.rows).toEqual([]);
    expect(json.badLines).toBe(0);
  });
});
