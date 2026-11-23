// POST /api/student/test/start — start (or resume) the ready test. The server records started_at.
// If no test is ready yet, the client calls POST /api/test/prepare and polls progress.
import { handler } from '@/lib/server/apiHandler';
import { startTest } from '@/lib/server/testRun';
import { generationProgress } from '@/lib/server/testGen';

export default handler('student', ['POST'], async (_req, _res, user) => {
  const r = await startTest(user.id);
  if (r.attemptId) return r;
  return { attemptId: null, progress: await generationProgress(user.id) };
});
