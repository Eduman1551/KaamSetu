// POST /api/student/test/[id]/answer — autosave one answer and/or review flag.
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { saveAnswer } from '@/lib/server/testRun';

const Body = z.object({ questionId: z.string().uuid(), answer: z.number().int().min(0).max(3).nullable(), marked: z.boolean().optional() });

export default handler('student', ['POST'], async (req, _res, user) => {
  const b = Body.parse(req.body);
  await saveAnswer(user.id, z.string().uuid().parse(req.query.id), b.questionId, b.answer, b.marked);
  return { ok: true };
});
