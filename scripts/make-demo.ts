// Generate the pre-saved demo result from ONE real live run.
// Usage: pnpm make-demo [path/to/resume.pdf]   (default: demo/sample-resume.pdf)
// Writes demo/result.json and demo/shots/*.jpg (served via /api/shot/demo-<n>).
import fs from 'fs';
import path from 'path';
import { runPipeline } from '../lib/server/pipeline';
import { lookupShot } from '../lib/server/shots';
import { deleteSession, createSession } from '../lib/server/sessions';
import { getBrowser } from '../lib/server/browser';

async function main() {
  const pdfPath = process.argv[2] || path.join('demo', 'sample-resume.pdf');
  const session = createSession();
  const t0 = Date.now();
  const result = await runPipeline(
    fs.readFileSync(pdfPath),
    session.id,
    (ev) => {
      if (ev.type === 'step') console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${ev.status === 'done' ? '✓' : '…'} ${ev.label}`);
    },
    () => false,
  );

  // Copy the live screenshots into /demo/shots and point the cards at them.
  const shotDir = path.join('demo', 'shots');
  fs.mkdirSync(shotDir, { recursive: true });
  for (const f of fs.readdirSync(shotDir)) fs.rmSync(path.join(shotDir, f));
  result.proofCards.forEach((card, i) => {
    const token = card.shotUrl?.split('/').pop();
    const entry = token ? lookupShot(token) : undefined;
    if (entry) {
      fs.copyFileSync(entry.file, path.join(shotDir, `${i + 1}.jpg`));
      card.shotUrl = `/api/shot/demo-${i + 1}`;
    } else {
      card.shotUrl = null;
    }
  });

  const demo = { ...result, sessionId: 'demo', demo: true };
  fs.writeFileSync(path.join('demo', 'result.json'), JSON.stringify(demo, null, 2) + '\n');
  await deleteSession(session.id); // remove the temp files
  console.log(`Saved demo/result.json (${result.listingsAnalyzed.count} listings, score ${result.overallScore}) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await (await getBrowser()).close();
  process.exit(0);
}

main().catch((e) => {
  console.error('Demo generation failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
