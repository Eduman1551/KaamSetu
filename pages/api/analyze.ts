// POST /api/analyze — (students) upload a resume PDF and stream progress back with SSE.
// The PDF and its raw text stay in memory; only the structured result is saved.
import type { NextApiRequest, NextApiResponse } from 'next';
import { friendlyUploadError, readPdfUpload } from '@/lib/server/upload';
import { requireKeys } from '@/lib/server/env';
import { runPipeline } from '@/lib/server/pipeline';
import { apiUser, methods } from '@/lib/server/guard';
import { saveAnalysis } from '@/lib/server/student';
import { isLimited, record } from '@/lib/server/rateLimit';
import { queueTestGeneration } from '@/lib/server/testGen';
import type { ProgressEvent } from '@/lib/types';

// formidable reads the raw body, so Next's body parser must be off.
export const config = { api: { bodyParser: false, responseLimit: false } };

const g = globalThis as unknown as { __ksRunning?: Set<string> };
const running: Set<string> = g.__ksRunning ?? (g.__ksRunning = new Set());

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methods(req, res, ['POST'])) return;
  const user = await apiUser(req, res, 'student');
  if (!user) return;

  try {
    requireKeys();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }
  if (running.has(user.id)) return res.status(409).json({ error: 'An analysis is already running for your account.' });
  if (isLimited(`analyze:${user.id}`, 6, 3600_000)) {
    return res.status(429).json({ error: 'You have run several analyses in the last hour. Please try again a little later.' });
  }

  // 1. Read the upload (in memory). Errors here are plain JSON, before the stream starts.
  let pdf: Buffer;
  try {
    pdf = await readPdfUpload(req);
  } catch (err) {
    return res.status(400).json({ error: friendlyUploadError(err) });
  }
  record(`analyze:${user.id}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Encoding': 'none', // stop compression from buffering the stream
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let closed = false;
  const send = (ev: ProgressEvent) => {
    if (!closed) res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15_000);
  res.on('close', () => {
    closed = true;
    clearInterval(ping);
  });

  running.add(user.id);
  try {
    const out = await runPipeline(pdf, send, () => closed);
    if (closed) return; // user left: nothing saved
    send({ type: 'step', id: 'save', label: 'Saving your results…', status: 'active' });
    const stored = await saveAnalysis(user.id, out);
    send({ type: 'step', id: 'save', label: 'Saved to your account', status: 'done' });
    send({ type: 'result', result: stored });
    // Prepare the skills test in the background (never blocks the response).
    queueTestGeneration(user.id);
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : 'Something went wrong during analysis.';
    console.error('[analyze] failed:', message);
    send({ type: 'error', message });
  } finally {
    running.delete(user.id);
    clearInterval(ping);
    if (!closed) res.end();
  }
}
