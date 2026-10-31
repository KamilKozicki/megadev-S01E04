---
plan: morning-digest
status: done
completed: 2026-10-31
owner: rook
opened: 2026-10-29
---

# Morning digest

The night's run log is a JSONL file nobody reads. By breakfast someone has to know what ran,
what retried, what failed, and whose it was, without opening `runs/`. rig already serves the
status board; the digest is one more page on it.

Out of scope: notifications, history across nights, auth (rig only listens on localhost).

## 1. Run log reader

Read `runs/<night>.jsonl` into one row per job: job, owner, runs, retries, last status, last
error, first and last time. One JSON object per line (`at`, `job`, `status`: `ok | retry | fail`,
`owner`, optional `error`).

- A line that doesn't parse is counted, never thrown. The night still renders.
- `owner` can be `null`. Keep the row; show the owner as `—`.
- Lives in `src/digest/`. Commit `src/digest/types.ts` first (the `DigestRow` type and the
  `readNight(runsDir, night)` signature), so every part of section 2 can start against it.

Done when: reader tests pass on `runs/2026-10-28.jsonl` (5 jobs, 1 bad line).

## 2. Digest page

Four small parts. Each needs only `src/digest/types.ts` from section 1, so once that is in they
can go to four workers at once. Small, well-specified work: a cheaper model is fine here.

### 2a. Page

`GET /digest/:night` renders the rows with the usual layout: one table, sorted by job, retries of
3 or more and any `fail` marked. A night with no file returns 404; an empty file renders
"nothing ran".

Done when: `/digest/2026-10-28` renders locally.

### 2b. JSON

`GET /api/digest/:night` returns the same rows as JSON. Agents read this one; the page and the
JSON must never disagree (ADR 0001).

Done when: the JSON for 2026-10-28 has the same jobs, in the same order, as the page.

### 2c. Board link

The status board links each night on disk to its digest, with its ok / retry / fail counts beside
it.

Done when: both nights on disk link to a digest that renders.

### 2d. Route tests

Route tests for 2a and 2b: 200, 404 for a night with no file, the empty night, a night with a bad
line. Use a temp runs dir; `runs/` is read-only.

Done when: `pnpm test` is green with the new tests.

## 3. Preview for review

The reviewer reads the page from a copy, not from the lane. Run rig and save `/digest/2026-10-28` as
one HTML file, lane banner included (a command, not a browser's "save as"; the page is
self-contained, ADR 0001). Put it on your own public host, one where you can upload over it later (any bucket
or static host, ADR 0003), so it opens from a public HTTPS link. Send the reviewer the link and the
issues for this plan.

Done when: the preview link is sent to the reviewer.

## 4. Clean up

The preview carries this lane's marker on a public link (ADR 0003). Take the marker off: save the
page again with `LANE_MARKER` unset (the banner reads "no marker set") and upload it over the same
link. Move this plan to `docs/plans/done/` with its issue list.

Done when: the preview link no longer shows the lane marker.

## Completion record

The reviewer confirmed that the preview had been seen. After separate human approval,
the digest was regenerated from the actual Hono service with LANE_MARKER unset and
uploaded over the same public URL:

https://megadev-s01e04.megadev-s01e04-preview.workers.dev/

The live page returns HTTPS 200, displays “no marker set”, and matches the clean export
byte for byte. Its digest data is unchanged. The official marker is absent from the
live HTML, historical Version URLs are disabled in the deployment configuration, and
transient local marked HTML copies were removed. The marker assignment was removed
from ignored .env to prevent accidental future marked exports.

Course review and repository completion are separate: the course confirmed review,
but final course acceptance is not claimed by this archive. The exact original
repository and preview answer must be submitted again after this cleanup.

### Actual plan issues

- [#1 · Define the digest types and reader contract](https://github.com/KamilKozicki/megadev-S01E04/issues/1)
- [#2 · Read and aggregate nightly JSONL logs](https://github.com/KamilKozicki/megadev-S01E04/issues/2)
- [#3 · Render the morning digest page](https://github.com/KamilKozicki/megadev-S01E04/issues/3)
- [#4 · Serve the digest as JSON](https://github.com/KamilKozicki/megadev-S01E04/issues/4)
- [#5 · Link nights from the status board to their digests](https://github.com/KamilKozicki/megadev-S01E04/issues/5)
- [#6 · Test digest HTML and JSON routes](https://github.com/KamilKozicki/megadev-S01E04/issues/6)
- [#7 · Publish the HTML digest preview for review](https://github.com/KamilKozicki/megadev-S01E04/issues/7)
- [#8 · Remove the preview marker and archive the finished plan](https://github.com/KamilKozicki/megadev-S01E04/issues/8)
