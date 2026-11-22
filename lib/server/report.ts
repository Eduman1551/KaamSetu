// Final report (Groq main model): impact + structure scores, one summary
// sentence, extra ATS tips and how relevant each in-demand skill is to the role.
import { z } from 'zod';
import { env } from './env';
import { chatJSON } from './groq';

const ReportSchema = z.object({
  impactScore: z.coerce.number().min(0).max(100).catch(50),
  structureScore: z.coerce.number().min(0).max(100).catch(60),
  summary: z.string().catch(''),
  extraAtsTips: z.array(z.string()).catch([]).transform((a) => a.slice(0, 3)),
  relevance: z.record(z.coerce.number()).catch({}),
});
export type Report = z.infer<typeof ReportSchema>;

export async function writeReport(input: {
  resumeText: string;
  roles: string[];
  demand: { skill: string; count: number; has: boolean }[];
  total: number;
  codeAtsIssues: string[];
  onWait?: (s: number) => void;
}): Promise<Report> {
  const demandLines = input.demand
    .slice(0, 14)
    .map((d) => `- ${d.skill}: in ${d.count} of ${input.total} listings (${d.has ? 'on resume' : 'MISSING'})`)
    .join('\n');

  return chatJSON({
    model: env.modelMain,
    schema: ReportSchema,
    maxTokens: 700,
    onWait: input.onWait,
    system:
      'You are a friendly, honest career coach for Indian freshers. Use only the facts given. Never invent numbers. Reply with JSON only.',
    user: `Target roles: ${input.roles.join(', ')}

Skills found in ${input.total} live job listings today:
${demandLines}

ATS issues already detected: ${input.codeAtsIssues.join('; ') || 'none'}

Resume:
"""
${input.resumeText.slice(0, 5000)}
"""

Return JSON:
{"impactScore": 0-100, "structureScore": 0-100, "summary": "", "extraAtsTips": [""], "relevance": {"<skill>": 1-3}}
- impactScore: how well the bullet points show results (numbers, outcomes, strong action verbs).
- structureScore: clear order, headings, consistent formatting, easy to scan.
- summary: ONE plain sentence (max 30 words) for the student about where they stand and the single most useful next step. Only mention skills from the list above.
- extraAtsTips: up to 3 short, specific tips (max 14 words each) about the resume DOCUMENT: wording, bullet points, numbers, keywords from the listings, formatting. Not about learning new skills, and never suggest listing a skill the resume does not show. Do not repeat the detected issues.
- relevance: for each skill in the list, 3 = core to the target role, 2 = useful, 1 = generic.`,
  });
}
