// Dev tool: run ONE real live analysis and save it as a fixture for the demo seed.
// Usage: pnpm tsx --env-file=.env.local scripts/make-fixture.ts <resume.pdf> <name>
// Writes scripts/fixtures/<name>.json and scripts/fixtures/<name>-shots/<idx>.jpg
import fs from 'fs';
import path from 'path';
import { runPipeline } from '../lib/server/pipeline';
import { closeBrowser } from '../lib/server/browser';

async function main() {
  const [pdfPath = 'scripts/fixtures/sample-resume-web.pdf', name = 'analysis-web'] = process.argv.slice(2);
  const t0 = Date.now();
  const out = await runPipeline(
    fs.readFileSync(pdfPath),
    (ev) => {
      if (ev.type === 'step' && ev.status === 'done') console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ✓ ${ev.label}`);
    },
    () => false,
  );
  const dir = path.join('scripts', 'fixtures', `${name}-shots`);
  fs.mkdirSync(dir, { recursive: true });
  out.shots.forEach((s, i) => s && fs.writeFileSync(path.join(dir, `${i}.jpg`), s));
  const json = { ...out.result, coreSkills: out.coreSkills, resumeSkills: out.resumeSkills, highlights: out.highlights };
  fs.writeFileSync(path.join('scripts', 'fixtures', `${name}.json`), JSON.stringify(json, null, 2) + '\n');
  console.log(`Saved ${name}: ${out.result.listingsAnalyzed.count} listings, score ${out.result.overallScore}, shots ${out.shots.filter(Boolean).length}/3`);
  await closeBrowser();
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
