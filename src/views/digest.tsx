import type { NightDigest } from '../digest/types.js';

const missing = '—';

export function DigestPage({ digest }: { digest: NightDigest }) {
  return (
    <>
      <h1>digest · {digest.night}</h1>
      <p>{digest.badLines} malformed {digest.badLines === 1 ? 'line' : 'lines'}</p>
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <div class="table-scroll" role="region" aria-label="Night digest jobs" tabindex={0}>
          <table>
            <caption class="visually-hidden">Jobs from {digest.night}</caption>
            <thead>
              <tr>
                <th scope="col">job</th>
                <th scope="col">owner</th>
                <th scope="col">runs</th>
                <th scope="col">retries</th>
                <th scope="col">last status</th>
                <th scope="col">last error</th>
                <th scope="col">first time</th>
                <th scope="col">last time</th>
              </tr>
            </thead>
            <tbody>
              {digest.rows.map((row) => (
                <tr>
                  <td>{row.job || missing}</td>
                  <td>{row.owner ?? missing}</td>
                  <td>{row.runs ?? missing}</td>
                  <td class={row.retries >= 3 ? 'warn' : undefined}>
                    {row.retries ?? missing}
                  </td>
                  <td>
                    {row.lastStatus ?? missing}
                    {row.failures > 0 && <span class="warn"> · failure</span>}
                  </td>
                  <td>{row.lastError ?? missing}</td>
                  <td>{row.firstAt ?? missing}</td>
                  <td>{row.lastAt ?? missing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
