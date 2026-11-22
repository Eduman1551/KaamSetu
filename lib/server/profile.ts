// Step 2 of the pipeline: Groq (main model) reads the resume and returns
// target roles, current skills and education level.
import { z } from 'zod';
import { chatJSON } from './groq';
import { env } from './env';

export const ProfileSchema = z.object({
  targetRoles: z.array(z.string().min(2)).min(1).transform((a) => a.slice(0, 2)),
  skills: z.array(z.string().min(1)).default([]),
  educationLevel: z.string().default(''),
});
export type Profile = z.infer<typeof ProfileSchema>;

export async function readProfile(resumeText: string, onWait?: (s: number) => void): Promise<Profile> {
  return chatJSON({
    model: env.modelMain,
    schema: ProfileSchema,
    maxTokens: 600,
    onWait,
    system:
      'You are a careful career counsellor for Indian students and freshers. Read a resume and reply with JSON only.',
    user: `Resume text:
"""
${resumeText.slice(0, 7000)}
"""

Return JSON exactly like:
{"targetRoles": ["..."], "skills": ["..."], "educationLevel": "..."}

Rules:
- targetRoles: 1 or 2 realistic entry-level job titles this person should apply for now (e.g. "Data Analyst", "Business Analyst"). Use the objective if one is stated. The two must be clearly different roles, not variants of the same title (no "Junior X" next to "X").
- skills: every concrete skill, tool, language or framework the resume actually mentions, short names only (e.g. "Python", "Excel", "Communication"). Do not add skills that are not in the text.
- educationLevel: short, e.g. "B.E. Computer Engineering (final year)".`,
  });
}
