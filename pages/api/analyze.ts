// POST /api/analyze — (students) upload a resume PDF and stream progress back with SSE.
// The PDF and its raw text stay in memory; only the structured result is saved.
// Serverless-safe: the run's status is stored in the DB (running/done/failed). If the
// stream drops, the analysis still finishes and saves, and the browser recovers by polling
// /api/student/analysis-status.
import type { NextApiRequest, NextApiResponse } from 'next';
import { friendlyUploadError, readPdfUpload } from '@/lib/server/upload';
import { ANALYSIS_BUDGET_MS, requireKeys } from '@/lib/server/env';
import { runPipeline } from '@/lib/server/pipeline';
import { apiUser, methods } from '@/lib/server/guard';
import { saveAnalysis } from '@/lib/server/student';
import { isLimited, record } from '@/lib/server/rateLimit';
import { getRunStatus, heartbeat, setRun } from '@/lib/server/analysisRuns';
import type { ProgressEvent } from '@/lib/types';

// formidable reads the raw body, so Next's body parser must be off.
// maxDuration: Vercel Hobby allows at most 300 s per function (Pro: 800 s). Must be a literal.
export const config = { api: { bodyParser: false, responseLimit: false }, maxDuration: 300 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methods(req, res, ['POST'])) return;
  const user = await apiUser(req, res, 'student');
  if (!user) return;

  try {
    requireKeys();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
  const current = await getRunStatus(user.id);
  if (current?.status === 'running') return res.status(409).json({ error: 'An analysis is already running for your account. It will appear here when it finishes.' });
  if (await isLimited(`analyze:${user.id}`, 6, 3600_000)) {
    return res.status(429).json({ error: 'You have run several analyses in the last hour. Please try again a little later.' });
  }

  // 1. Read the upload (in memory). Errors here are plain JSON, before the stream starts.
  let pdf: Buffer;
  try {
    pdf = await readPdfUpload(req);
  } catch (err) {
    return res.status(400).json({ error: friendlyUploadError(err) });
  }
  await record(`analyze:${user.id}`, 3600_000);
  await setRun(user.id, 'running');
  const deadline = Date.now() + ANALYSIS_BUDGET_MS;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Encoding': 'none', // stop compression from buffering the stream
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let closed = false;
  let lastBeat = Date.now();
  const send = (ev: ProgressEvent) => {
    if (Date.now() - lastBeat > 10_000) {
      lastBeat = Date.now();
      void heartbeat(user.id).catch(() => {});
    }
    if (!closed) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15_000);
  res.on('close', () => {
    closed = true; // keep working: the result is saved and picked up by polling
  });

  try {
    // Never cancelled by a dropped stream: the student gets the result on refresh.
    const out = await runPipeline(pdf, send, () => false, { deadline });
    send({ type: 'step', id: 'save', label: 'Saving your results…', status: 'active' });
    const stored = await saveAnalysis(user.id, out);
    await setRun(user.id, 'done');
    send({ type: 'step', id: 'save', label: 'Saved to your account', status: 'done' });
    send({ type: 'result', result: stored });
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : 'Something went wrong during analysis.';
    console.error('[analyze] failed:', message);
    await setRun(user.id, 'failed', message).catch(() => {});
    send({ type: 'error', message });
  } finally {
    clearInterval(ping);
    if (!closed) res.end();
  }
}
