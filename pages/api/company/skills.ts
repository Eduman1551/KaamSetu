// GET /api/company/skills — known skill names for the requirement autocomplete.
import { handler } from '@/lib/server/apiHandler';
import { knownSkills } from '@/lib/server/company';

export default handler('company', ['GET'], async () => ({ skills: await knownSkills() }));
