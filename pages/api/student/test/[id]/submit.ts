// POST /api/student/test/[id]/submit — score the test.
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { submitTest } from '@/lib/server/testRun';

export default handler('student', ['POST'], async (req, _res, user) => submitTest(user.id, z.string().uuid().parse(req.query.id)));
