import { describe, expect, it } from 'vitest';
import { toCompanyCandidateDTO } from '@/lib/companyDto';
import { containsPII, scrubHighlights } from '@/lib/redact';

const now = new Date('2026-11-23T00:00:00Z');
const raw = {
  // private fields that must never reach a company
  userId: '8f14e45f-ceea-467f-a0e6-1c3f5b0d1a11',
  collegeId: '1679091c-5a88-4faf-afb5-e6087eb1b2dc',
  name: 'Priya Raghavan',
  email: 'priya.raghavan@gmail.com',
  collegeName: 'Kaveri Institute of Technology',
  phone: '+91 98765 43210',
  resumeText: 'Priya Raghavan, Bengaluru. github.com/priyar',
  passwordHash: '$2a$12$abc',
  // allowed fields
  anonCode: 'KS-7F3A9C',
  gradYear: 2026,
  educationLevel: 'B.Tech / B.E.',
  testScorePct: 87,
  verified: true,
  distinction: true,
  verifiedUntil: new Date('2027-06-01'),
  redactedHighlights: ['Built a sales dashboard analysing 12,000 rows of data'],
  skills: [
    { skill: 'sql', scorePct: 100, verified: true, tested: true, expiresAt: new Date('2027-06-01') },
    { skill: 'docker', scorePct: 33, verified: false, tested: true },
    { skill: 'excel', scorePct: null, verified: false, tested: false },
  ],
};

describe('company candidate DTO', () => {
  const dto = toCompanyCandidateDTO(raw, now);
  const json = JSON.stringify(dto);

  it('contains only the allowed keys', () => {
    expect(Object.keys(dto).sort()).toEqual(['anonCode', 'distinction', 'educationLevel', 'gradYear', 'highlights', 'overallScore', 'skills', 'verified']);
    for (const s of dto.skills) expect(Object.keys(s).sort()).toEqual(['scorePct', 'skill', 'verified']);
  });

  it('never contains name, email, college, ids, phone or raw text', () => {
    for (const secret of [raw.name, 'Priya', 'Raghavan', raw.email, 'gmail', raw.collegeName, 'Kaveri', raw.userId, raw.collegeId, '98765', 'github', '$2a$']) {
      expect(json).not.toContain(secret);
    }
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i); // no uuids at all
  });

  it('includes only tested skills and respects expiry', () => {
    expect(dto.skills.map((s) => s.skill)).toEqual(['sql', 'docker']);
    const expired = toCompanyCandidateDTO({ ...raw, verifiedUntil: new Date('2026-01-01') }, now);
    expect(expired.verified).toBe(false);
    expect(expired.distinction).toBe(false);
  });
});

describe('redaction scrub', () => {
  const id = { name: 'Aarav Mehta', email: 'aarav.mehta21@gmail.com', collegeName: 'Kaveri Institute of Technology' };

  it('drops bullets with emails, phones, links and handles', () => {
    expect(containsPII('Contact me at someone@example.com', id)).toBe(true);
    expect(containsPII('Call +91 98765 43210 for details', id)).toBe(true);
    expect(containsPII('Portfolio at https://my-site.dev', id)).toBe(true);
    expect(containsPII('Source on github.com/someone', id)).toBe(true);
    expect(containsPII('Follow @aarav_codes for updates', id)).toBe(true);
  });

  it("drops bullets with the student's own name, email prefix or college", () => {
    expect(containsPII('Aarav built a dashboard', id)).toBe(true);
    expect(containsPII('Led the MEHTA project team', id)).toBe(true);
    expect(containsPII('Won the hackathon at Kaveri Institute', id)).toBe(true);
    expect(containsPII('Project named aarav.mehta21', id)).toBe(true);
  });

  it('keeps generic bullets (including generic college words)', () => {
    const ok = ['Built a sales dashboard analysing 12,000 rows of data', 'Completed an internship at a technology institute', 'Improved load time by 40%'];
    expect(scrubHighlights(ok, id)).toEqual(ok);
  });

  it('keeps at most 5 bullets', () => {
    const many = Array.from({ length: 8 }, (_, i) => `Generic project bullet number ${i + 1}`);
    expect(scrubHighlights(many, id)).toHaveLength(5);
  });
});
