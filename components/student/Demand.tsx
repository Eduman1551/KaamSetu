import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Alert, EmptyState, Skeleton } from '../ui';
import { CheckIcon } from '../Icons';
import { fetcher } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';
import { fadeUp, stagger } from '../motion';

interface Demand {
  enough: boolean;
  openRequirements: number;
  skills: { skill: string; pct: number; verified: boolean; onResume: boolean }[];
}

/** Aggregate of all companies' open requirements vs the student's verified skills. */
export default function DemandView({ go }: { go: (tab: string) => void }) {
  const { data, error } = useSWR<Demand>('/api/student/demand', fetcher);
  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  if (!data.enough)
    return (
      <EmptyState title="Not enough company data yet">
        We show this once at least 3 companies&apos; requirements are open on KaamSetu. Check back soon.
      </EmptyState>
    );
  const gaps = data.skills.filter((s) => !s.verified);
  return (
    <div className="space-y-5">
      <p className="max-w-prose text-[15px] text-ink/80">
        The 10 skills companies ask for most, as a share of <b className="num">{data.openRequirements}</b> open requirements on KaamSetu, compared with your
        verified skills. <span className="text-teal">Green</span> = verified, <span className="text-miss">red</span> = gap.
      </p>
      <motion.ul initial="hidden" animate="show" variants={stagger} className="card divide-y divide-ink/5">
        {data.skills.map((s) => (
          <motion.li key={s.skill} variants={fadeUp} className="flex items-center gap-4 px-4 py-3">
            <span className="w-36 shrink-0 text-[15px] font-medium">{displaySkill(s.skill)}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/10" aria-hidden>
              <motion.div
                className={`h-full rounded-full ${s.verified ? 'bg-teal' : 'bg-miss'}`}
                initial={{ width: 0 }}
                animate={{ width: `${s.pct}%` }}
                transition={{ duration: 0.7 }}
              />
            </div>
            <span className="num w-12 text-right font-mono text-sm">{s.pct}%</span>
            <span className={`flex w-28 shrink-0 items-center gap-1 text-sm ${s.verified ? 'text-teal' : 'text-miss'}`}>
              {s.verified ? (
                <>
                  <CheckIcon width={14} height={14} /> Verified
                </>
              ) : s.onResume ? (
                'Not verified'
              ) : (
                'Gap'
              )}
            </span>
          </motion.li>
        ))}
      </motion.ul>
      {gaps.length > 0 && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[15px]">
            Your biggest gap: <b>{displaySkill(gaps[0].skill)}</b> appears in {gaps[0].pct}% of open requirements.
          </p>
          <button className="btn-secondary btn-sm" onClick={() => go('analysis')}>
            See courses in my analysis
          </button>
        </div>
      )}
    </div>
  );
}
