// GET /api/student/settings — company-view preview. PATCH {visible} or {joinCode}.
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { getCompanyPreview, joinCollege, setVisibility } from '@/lib/server/studentExtras';

const Body = z.union([
  z.object({ visible: z.boolean() }),
  z.object({ joinCode: z.string().trim().toUpperCase().regex(/^([A-Z0-9]{2,6}-[A-Z0-9]{3,6})?$/, 'Join codes look like DEMO-2026 or KIT-7F3A9.') }),
]);

export default handler('student', ['GET', 'PATCH'], async (req, _res, user) => {
  if (req.method === 'PATCH') {
    const b = Body.parse(req.body);
    if ('visible' in b) await setVisibility(user.id, b.visible);
    else return joinCollege(user.id, b.joinCode);
  }
  return { preview: await getCompanyPreview(user.id) };
});
