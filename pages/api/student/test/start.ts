// POST /api/student/test/start — start (or resume) the ready test. The server records started_at.
import { handler } from '@/lib/server/apiHandler';
import { startTest } from '@/lib/server/testRun';
import { generationProgress, isGenerating, queueTestGeneration } from '@/lib/server/testGen';

export default handler('student', ['POST'], async (_req, _res, user) => {
  const r = await startTest(user.id);
  if (r.attemptId) return r;
  // No ready test yet: make sure one is being prepared and report progress.
  const q = isGenerating(user.id) ? { queued: true } : await queueTestGeneration(user.id);
  return { attemptId: null, preparing: !!q.queued, reason: (q as { reason?: string }).reason ?? null, progress: generationProgress(user.id) };
});
