// Dev helper: POST a PDF to the running dev server and print the SSE events.
// Usage: pnpm tsx scripts/test-analyze.ts [path/to/resume.pdf] [--out file.json]
import fs from 'fs';
import path from 'path';

async function main() {
  const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'scripts/fixtures/sample-resume.pdf';
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx > 0 ? process.argv[outIdx + 1] : null;
  const base = process.env.BASE_URL || 'http://localhost:3000';

  const form = new FormData();
  form.append('resume', new Blob([fs.readFileSync(file)], { type: 'application/pdf' }), path.basename(file));
  const t0 = Date.now();
  const res = await fetch(`${base}/api/analyze`, { method: 'POST', body: form });
  if (!res.ok || !res.body) {
    console.log('HTTP', res.status, await res.text());
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const ev = JSON.parse(line.slice(5));
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (ev.type === 'result') {
        console.log(`[${secs}s] RESULT`);
        console.log(JSON.stringify(ev.result, null, 2));
        if (out) fs.writeFileSync(out, JSON.stringify(ev.result, null, 2));
      } else if (ev.type === 'step') console.log(`[${secs}s] ${ev.status === 'done' ? '✓' : '…'} ${ev.label}`);
      else if (ev.type === 'error') console.log(`[${secs}s] ERROR ${ev.message}`);
    }
  }
}
main();
