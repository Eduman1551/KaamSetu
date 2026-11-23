// POST /api/company/requirements — create; PUT ?id= — update (own requirements only).
import { z } from 'zod';
import { handler } from '@/lib/server/apiHandler';
import { saveRequirement } from '@/lib/server/company';
import { RequirementSchema } from '@/lib/validation';

export default handler('company', ['POST', 'PUT'], async (req, _res, user) => {
  const input = RequirementSchema.parse(req.body);
  const id = req.method === 'PUT' ? z.string().uuid().parse(req.query.id) : undefined;
  return { id: await saveRequirement(user.id, input, id) };
});
