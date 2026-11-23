// Input schemas shared by the forms (client) and API routes (server).
import { z } from 'zod';

export const password = z.string().min(8, 'Use at least 8 characters.').max(128);
const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(200);
const name = (label: string) => z.string().trim().min(2, `Enter the ${label}.`).max(120);
const thisYear = new Date().getFullYear();

export const EDUCATION_LEVELS = ['B.Tech / B.E.', 'BCA', 'B.Sc', 'MCA', 'M.Tech / M.E.', 'MBA', 'Diploma', 'Other'];
export const INDUSTRIES = ['Software products', 'IT services', 'Analytics & BI', 'Financial services', 'E-commerce', 'Consulting', 'Manufacturing', 'Education', 'Other'];
export const SIZE_BANDS = ['1-10', '11-50', '51-200', '201-1000', '1000+'];

export const StudentSignup = z.object({
  role: z.literal('student'),
  name: name('your full name'),
  email,
  password,
  gradYear: z.coerce.number().int().min(thisYear - 3, 'Graduation year looks too far back.').max(thisYear + 5),
  educationLevel: z.enum(EDUCATION_LEVELS as [string, ...string[]]),
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{3}-[0-9A-F]{5})?$/, 'Join codes look like KIT-7F3A9.')
    .optional()
    .default(''),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please accept to continue.' }) }),
});

export const CompanySignup = z.object({
  role: z.literal('company'),
  companyName: name('company name'),
  email,
  password,
  website: z.string().trim().url('Enter a full URL, e.g. https://example.com').max(200).or(z.literal('')).default(''),
  industry: z.enum(INDUSTRIES as [string, ...string[]]),
  sizeBand: z.enum(SIZE_BANDS as [string, ...string[]]),
});

export const CollegeSignup = z.object({
  role: z.literal('college'),
  collegeName: name('college name'),
  email,
  password,
  city: name('city'),
  state: name('state'),
});

export const SignupSchema = z.discriminatedUnion('role', [StudentSignup, CompanySignup, CollegeSignup]);
export type SignupInput = z.infer<typeof SignupSchema>;

/** 0-4 password strength used by the strength meter. */
export function passwordStrength(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.min(4, s);
}

export const ChangePasswordSchema = z.object({ current: z.string().min(1).max(128), next: password });

export const RequirementSchema = z.object({
  roleTitle: z.string().trim().min(2).max(80),
  experienceLevel: z.enum(['fresher', '0-2y']),
  openings: z.coerce.number().int().min(1).max(500),
  minOverallScore: z.coerce.number().int().min(0).max(100),
  status: z.enum(['open', 'closed']).default('open'),
  skills: z
    .array(
      z.object({
        skill: z.string().trim().toLowerCase().min(1).max(40),
        weight: z.coerce.number().int().min(1).max(5),
        mustHave: z.boolean(),
      }),
    )
    .min(1, 'Add at least one skill.')
    .max(12),
});

export const InviteSchema = z.object({
  anonCode: z.string().regex(/^KS-[0-9A-F]{6}$/),
  requirementId: z.string().uuid().nullable(),
  message: z.string().trim().min(5, 'Write a short message.').max(280, 'Keep it under 280 characters.'),
});
