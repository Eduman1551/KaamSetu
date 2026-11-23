// GET /api/student/test/[id]/result — result + explanations (only after submission).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { getResult } from '@/lib/server/testRun';

export default handler('student', ['GET'], async (req, _res, user) => getResult(user.id, z.string().uuid().parse(req.query.id)));
