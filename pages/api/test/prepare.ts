// POST /api/test/prepare — (students) make sure a skills test is ready.
// Called by the browser right after an analysis finishes, and again if the student
// presses Start before the test exists. Generation runs inside this request.
import { handler } from '@/lib/server/apiHandler';
import { prepareTest } from '@/lib/server/testGen';

// Vercel Hobby allows at most 300 s per function (Pro: 800 s). Must be a literal (read statically by Next.js).
export const config = { maxDuration: 300 };

export default handler('student', ['POST'], async (_req, _res, user) => prepareTest(user.id));
