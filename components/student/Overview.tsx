import { motion } from 'framer-motion';
import type { StudentData } from './types';
import { ScoreRing } from '../Results';
import { CheckIcon, ShieldIcon, WarnIcon } from '../Icons';
import { fadeUp, stagger } from '../motion';
import { displaySkill } from '@/lib/skillNames';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function VerificationBadge({ state }: { state: StudentData['verification'] }) {
  if (state === 'distinction') return <span className="chip bg-teal/15 text-teal">Verified with Distinction</span>;
  if (state === 'verified') return <span className="chip bg-teal/15 text-teal">Verified</span>;
  if (state === 'expired') return <span className="chip bg-saffron/15 text-saffron">Verification expired</span>;
  return <span className="chip bg-ink/10 text-ink/70">Not verified</span>;
}

/** The single most useful next step for the student. */
function nextAction(d: StudentData): { text: string; tab: string; cta: string } {
  if (!d.analysis) return { text: 'Analyse your resume against today’s real job listings.', tab: 'analysis', cta: 'Analyse my resume' };
  if (!d.canTest) return { text: 'Add more technical skills to your resume to unlock verification (at least 3 testable skills).', tab: 'analysis', cta: 'Upload an updated resume' };
  if (d.verification === 'none' || d.verification === 'expired') {
    if (!d.retake.allowed && d.retake.nextAt)
      return { text: `Review your weak skills. Your next test attempt opens on ${fmt(d.retake.nextAt)}.`, tab: 'verify', cta: 'See my results' };
    return { text: 'Take the 15-question skills test to earn your Verified badge.', tab: 'verify', cta: 'Verify my skills' };
  }
  if (!d.profile?.visible) return { text: 'You are verified. Turn on visibility so companies can find you.', tab: 'settings', cta: 'Open settings' };
  if (d.pendingInvites) return { text: `You have ${d.pendingInvites} pending company invite${d.pendingInvites > 1 ? 's' : ''}.`, tab: 'invites', cta: 'View invites' };
  return { text: 'Close a gap companies ask for to rank higher in matches.', tab: 'demand', cta: 'What companies want' };
}

export default function Overview({ d, go }: { d: StudentData; go: (tab: string) => void }) {
  const action = nextAction(d);
  const verifiedCount = d.skills.filter((s) => s.verified).length;
  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-5">
      <motion.div variants={fadeUp} className="card flex flex-col gap-3 border-saffron/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="kicker mb-1">Next best action</p>
          <p className="text-[15px]">{action.text}</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => go(action.tab)}>
          {action.cta}
        </button>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <motion.section variants={fadeUp} className="card p-5">
          <h2 className="h3 mb-4">Resume score</h2>
          {d.analysis ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ScoreRing score={d.analysis.overallScore} size="sm" />
              <div className="space-y-1 text-sm text-ink/75">
                <p>
                  Target roles: <span className="text-ink">{d.analysis.targetRoles.join(' · ')}</span>
                </p>
                <p className="num">Based on {d.analysis.listingsAnalyzed.count} live listings</p>
                <p>Analysed {fmt(d.analysis.generatedAt)}</p>
                <button className="mt-2 font-medium text-saffron hover:underline" onClick={() => go('analysis')}>
                  Open full analysis
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-ink/70">No analysis yet. Upload your resume to get your score.</p>
          )}
        </motion.section>

        <motion.section variants={fadeUp} className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="h3">Verification</h2>
            <VerificationBadge state={d.verification} />
          </div>
          {d.verification === 'verified' || d.verification === 'distinction' ? (
            <div className="flex items-start gap-3">
              <ShieldIcon className="mt-0.5 shrink-0 text-teal" width={22} height={22} />
              <div className="text-[15px]">
                <p>
                  Overall test score <b className="num font-mono">{d.profile?.testScorePct}%</b>, {verifiedCount} skill{verifiedCount === 1 ? '' : 's'} verified.
                </p>
                <p className="meta mt-1">Valid until {fmt(d.profile?.verifiedUntil ?? null)}. Visibility to companies: {d.profile?.visible ? 'on' : 'off'}.</p>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-ink/75">
              {d.verification === 'expired'
                ? 'Your verification has expired. Take a new test to renew it.'
                : 'Pass the 15-question skills test (11 correct or more) to get verified. Verification lasts 12 months.'}
            </p>
          )}
        </motion.section>
      </div>

      <motion.section variants={fadeUp} className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="h3">My skills</h2>
          <span className="meta">From your resume and tests</span>
        </div>
        {d.skills.length === 0 ? (
          <p className="px-5 py-6 text-[15px] text-ink/70">Your skills appear here after your first resume analysis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-ink/60">
                <tr>
                  <th className="px-5 py-2 font-medium">Skill</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Test score</th>
                  <th className="px-5 py-2 text-right font-medium">On resume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {d.skills.map((s) => (
                  <tr key={s.skill}>
                    <td className="px-5 py-2.5 font-medium">{displaySkill(s.skill)}</td>
                    <td className="px-3 py-2.5">
                      {s.verified ? (
                        <span className="inline-flex items-center gap-1 text-teal">
                          <CheckIcon width={14} height={14} /> Verified
                        </span>
                      ) : s.tested ? (
                        <span className="inline-flex items-center gap-1 text-saffron">
                          <WarnIcon width={14} height={14} /> Below the bar
                        </span>
                      ) : (
                        <span className="text-ink/55">Untested</span>
                      )}
                    </td>
                    <td className="num px-3 py-2.5 text-right font-mono">{s.scorePct != null ? `${s.scorePct}%` : '–'}</td>
                    <td className="px-5 py-2.5 text-right text-ink/70">{s.inResume ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
