// POST /api/student/test/[id]/event — tab switch / paste (integrity counter).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { recordIntegrityEvent } from '@/lib/server/testRun';

const Body = z.object({ type: z.enum(['tab', 'paste']) });

export default handler('student', ['POST'], async (req, _res, user) => {
  Body.parse(req.body);
  return recordIntegrityEvent(user.id, z.string().uuid().parse(req.query.id));
});
