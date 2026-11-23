// DELETE /api/student/account {password} — delete the account and all its data.
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { deleteStudentAccount } from '@/lib/server/studentExtras';

export default handler('student', ['DELETE'], async (req, _res, user) => {
  const { password } = z.object({ password: z.string().min(1).max(200) }).parse(req.body);
  await deleteStudentAccount(user.id, password);
  return { deleted: true };
});
