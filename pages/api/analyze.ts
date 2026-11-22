// POST /api/analyze — upload a resume PDF and stream progress back with SSE.
import type { NextApiRequest, NextApiResponse } from 'next';
import { friendlyUploadError, readPdfUpload } from '@/lib/server/upload';
import { requireKeys } from '@/lib/server/env';
import { runPipeline } from '@/lib/server/pipeline';
import { createSession, deleteSession } from '@/lib/server/sessions';
import type { ProgressEvent } from '@/lib/types';

// formidable reads the raw body, so Next's body parser must be off.
export const config = { api: { bodyParser: false, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }

  try {
    requireKeys();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }

  // 1. Read the upload (in memory). Errors here are plain JSON, before the stream starts.
  let pdf: Buffer;
  try {
    pdf = await readPdfUpload(req);
  } catch (err) {
    return res.status(400).json({ error: friendlyUploadError(err) });
  }

  // From here on we stream Server-Sent Events.
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
    if (closed) return;
    res.write(`data: ${JSON.stringify(ev)}\n\n`);
  };
  // Keep the connection alive during long waits.
  const ping = setInterval(() => !closed && res.write(': ping\n\n'), 15_000);

  const session = createSession();
  res.on('close', () => {
    closed = true;
    clearInterval(ping);
  });

  try {
    const result = await runPipeline(pdf, session.id, send, () => closed);
    if (closed) {
      // The user left (reset / switched to demo): nothing to keep.
      await deleteSession(session.id);
      return;
    }
    session.result = result;
    send({ type: 'result', result });
  } catch (err) {
    await deleteSession(session.id);
    const message = err instanceof Error && err.message ? err.message : 'Something went wrong during analysis.';
    console.error('[analyze] failed:', message);
    send({ type: 'error', message });
  } finally {
    clearInterval(ping);
    if (!closed) res.end();
  }
}
