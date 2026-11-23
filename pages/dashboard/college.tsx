import { useCallback, useState } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { AnimatePresence, motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Alert, EmptyState, Kpi, SampleChip, Skeleton } from '@/components/ui';
import { ChartCard, TrendLine, VBar } from '@/components/charts';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import { requireRole, type AuthUser } from '@/lib/server/guard';
import { getCollegeDashboard } from '@/lib/server/college';
import { fetcher, send } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';
import { fadeUp, stagger } from '@/components/motion';

type Data = Awaited<ReturnType<typeof getCollegeDashboard>>;
type Plan = Data['workshops'][string];

export const getServerSideProps = requireRole('college', async (_ctx, user) => ({
  props: { initial: JSON.parse(JSON.stringify(await getCollegeDashboard(user.id, null))) as Data },
}));

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'gaps', label: 'Skill Gaps' },
  { id: 'workshops', label: 'Workshops' },
  { id: 'students', label: 'Students' },
  { id: 'settings', label: 'Settings' },
];
const NA = <span className="meta">Not enough data yet</span>;

/** Heat colour for a cell: higher = stronger tint. */
const heat = (v: number | null, max: number, rgb: string) => (v == null ? undefined : { background: `rgba(${rgb}, ${0.08 + (Math.min(v, max) / max) * 0.4})` });

function GapsTable({ d }: { d: Data }) {
  if (!d.gaps.length) return <EmptyState title="No test data yet">Skill gaps appear once linked students take the skills test.</EmptyState>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-ink/60">
          <tr>
            <th className="px-4 py-2.5 font-medium">Skill</th>
            <th className="px-3 py-2.5 text-right font-medium">Students tested</th>
            <th className="px-3 py-2.5 text-right font-medium">Avg score</th>
            <th className="px-3 py-2.5 text-right font-medium">% verified</th>
            <th className="px-3 py-2.5 text-right font-medium">Company demand</th>
            <th className="px-4 py-2.5 text-right font-medium">Gap index</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/5">
          {d.gaps.map((g) => (
            <tr key={g.skill} className={g.priority ? 'bg-miss/[0.04]' : ''}>
              <td className="px-4 py-2.5 font-medium">
                {displaySkill(g.skill)} {g.priority && <span className="chip ml-1 bg-miss/15 text-miss">Priority gap</span>}
              </td>
              <td className="num px-3 py-2.5 text-right font-mono">{g.tested}</td>
              <td className="num px-3 py-2.5 text-right font-mono" style={heat(g.avgScore == null ? null : 100 - g.avgScore, 70, '248,113,113')}>
                {g.avgScore == null ? NA : `${g.avgScore}%`}
              </td>
              <td className="num px-3 py-2.5 text-right font-mono" style={heat(g.verifiedPct, 100, '45,212,191')}>
                {g.verifiedPct == null ? NA : `${g.verifiedPct}%`}
              </td>
              <td className="num px-3 py-2.5 text-right font-mono" style={heat(g.demandPct, 100, '96,165,250')}>
                {g.demandPct}%
              </td>
              <td className="num px-4 py-2.5 text-right font-mono font-semibold" style={heat(g.gapIndex, 40, '255,153,51')}>
                {g.gapIndex == null ? NA : g.gapIndex}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta border-t border-ink/10 px-4 py-2.5">
        Gap index = company demand % × (100 − average score %) / 100. Figures based on fewer than 5 students are hidden.
      </p>
    </div>
  );
}

function Workshops({ d, refresh }: { d: Data; refresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [plans, setPlans] = useState<Record<string, Plan>>(d.workshops);
  const [error, setError] = useState<string | null>(null);
  const priority = d.gaps.filter((g) => g.priority);
  const generate = async (skill: string, regenerate = false) => {
    setBusy(skill);
    setError(null);
    try {
      const r = await send<{ plan: Plan }>('/api/college/workshop', 'POST', { skill, regenerate });
      setPlans((p) => ({ ...p, [skill]: r.plan }));
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-[15px] text-ink/80">One suggested 1-day workshop for each priority gap, written by AI from your cohort&apos;s anonymous data.</p>
        <a className="btn-secondary btn-sm" href={`/api/college/report${d.gradYear ? `?year=${d.gradYear}` : ''}`}>
          Download aggregate report (CSV)
        </a>
      </div>
      {error && <Alert>{error}</Alert>}
      {priority.length === 0 ? (
        <EmptyState title="No priority gaps yet">They appear once at least 5 linked students are tested on a skill.</EmptyState>
      ) : (
        <motion.div initial="hidden" animate="show" variants={stagger} className="grid gap-4 lg:grid-cols-2">
          {priority.map((g) => {
            const p = plans[g.skill];
            return (
              <motion.section key={g.skill} variants={fadeUp} className="card flex flex-col p-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="kicker mb-1">{displaySkill(g.skill)}</p>
                    <p className="meta num">
                      Avg {g.avgScore}% · {g.verifiedPct}% verified · demand {g.demandPct}% · gap {g.gapIndex}
                    </p>
                  </div>
                </div>
                {busy === g.skill ? (
                  <div className="space-y-2 py-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : p ? (
                  <div className="flex-1">
                    <h3 className="card-title mb-1">{p.title}</h3>
                    <p className="meta mb-2">
                      {p.duration} · {p.audience}
                    </p>
                    <ol className="list-decimal space-y-1 pl-5 text-[15px] text-ink/85">
                      {p.topics.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ol>
                    <button className="btn-ghost btn-sm mt-3" onClick={() => generate(g.skill, true)}>
                      Suggest another plan
                    </button>
                  </div>
                ) : (
                  <button className="btn-primary mt-2 self-start" onClick={() => generate(g.skill)}>
                    Suggest a workshop
                  </button>
                )}
              </motion.section>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

function CountList({ title, rows }: { title: string; rows: { label: string; count: number | '<5' }[] }) {
  return (
    <section className="card p-5">
      <h3 className="card-title mb-3">{title}</h3>
      <ul className="space-y-1.5 text-[15px]">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between gap-3">
            <span className="text-ink/85">{r.label}</span>
            <span className="num font-mono">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CollegeDashboard({ user, initial }: { user: AuthUser; initial: Data }) {
  const router = useRouter();
  const tab = TABS.some((t) => t.id === router.query.tab) ? String(router.query.tab) : 'overview';
  const [year, setYear] = useState<number | null>(null);
  const { data, mutate } = useSWR<Data>(`/api/college/dashboard${year ? `?year=${year}` : ''}`, fetcher, {
    fallbackData: year === null ? initial : undefined,
    keepPreviousData: true,
  });
  const d = data ?? initial;
  const [copied, setCopied] = useState(false);
  const go = useCallback(
    (id: string) => router.replace({ pathname: router.pathname, query: id === 'overview' ? {} : { tab: id } }, undefined, { shallow: true, scroll: false }),
    [router],
  );
  const copy = async () => {
    await navigator.clipboard.writeText(d.college.joinCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const o = d.overview;
  const title = TABS.find((t) => t.id === tab)!.label;

  const cohortPicker = tab !== 'settings' && tab !== 'workshops' && (
    <label className="flex items-center gap-2 text-sm">
      <span className="meta">Cohort</span>
      <select className="input w-52 py-1.5" value={year ?? ''} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : null)}>
        <option value="" className="bg-navy">
          All graduation years
        </option>
        {d.years.map((y) => (
          <option key={y} value={y} className="bg-navy">
            Class of {y}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <DashboardLayout title={title} role="college" userName={d.college.name} nav={TABS} active={tab} onNav={go} topRight={<span className="hidden sm:inline-flex"><SampleChip show={d.hasSynthetic} /></span>}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{tab === 'overview' ? d.college.name : title}</h1>
        {cohortPicker}
      </div>
      <p className="meta mb-5 max-w-prose">You see anonymous totals only. Any figure based on fewer than 5 students is hidden, so no student can be identified.</p>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {tab === 'overview' &&
            (o.linked === 0 ? (
              <EmptyState title="No students linked yet" action={<button className="btn-primary" onClick={() => go('settings')}>Show my join code</button>}>
                Share your join code <b className="font-mono">{d.college.joinCode}</b> with students. They enter it at sign-up or in Settings.
              </EmptyState>
            ) : (
              <div className="space-y-5">
                <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  {[
                    { label: 'Students linked', value: o.linked },
                    { label: 'Analysed a resume', value: o.analysedPct == null ? '–' : `${o.analysedPct}%` },
                    { label: 'Took the test', value: o.testedPct == null ? '–' : `${o.testedPct}%` },
                    { label: 'Verified', value: o.verifiedPct == null ? '–' : `${o.verifiedPct}%` },
                    { label: 'Average test score', value: o.avgScore == null ? '–' : `${o.avgScore}%` },
                  ].map((k) => (
                    <motion.div key={k.label} variants={fadeUp}>
                      <Kpi label={k.label} value={k.value} />
                    </motion.div>
                  ))}
                </motion.div>
                {!o.enough && <Alert tone="info">Fewer than 5 students in this cohort, so percentages are hidden.</Alert>}
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <ChartCard title="Verified rate by month" note="Share of the cohort verified (and tested) at each month end">
                    {o.enough ? (
                      <TrendLine
                        data={d.trend}
                        x="month"
                        lines={[
                          { key: 'verifiedPct', color: '#2DD4BF', name: '% verified' },
                          { key: 'testedPct', color: '#A78BFA', name: '% tested' },
                        ]}
                      />
                    ) : (
                      <p className="meta py-16 text-center">Not enough data yet</p>
                    )}
                  </ChartCard>
                  <section className="card p-4">
                    <h3 className="card-title mb-3">Top priority gaps</h3>
                    {d.gaps.filter((g) => g.priority).length === 0 ? (
                      <p className="meta">Not enough data yet.</p>
                    ) : (
                      <ol className="space-y-2">
                        {d.gaps
                          .filter((g) => g.priority)
                          .map((g, i) => (
                            <li key={g.skill} className="flex items-center justify-between gap-3 text-[15px]">
                              <span>
                                <span className="meta mr-2 font-mono">{i + 1}</span>
                                {displaySkill(g.skill)}
                              </span>
                              <span className="num font-mono text-sm text-miss">gap {g.gapIndex}</span>
                            </li>
                          ))}
                      </ol>
                    )}
                    <button className="btn-ghost btn-sm mt-3" onClick={() => go('gaps')}>
                      Open skill gaps
                    </button>
                  </section>
                </div>
              </div>
            ))}
          {tab === 'gaps' && <GapsTable d={d} />}
          {tab === 'workshops' && <Workshops d={d} refresh={() => mutate()} />}
          {tab === 'students' && (
            <div className="grid gap-4 md:grid-cols-3">
              <CountList title="Progress funnel" rows={d.distribution.funnel} />
              <CountList title="By graduation year" rows={d.distribution.byYear} />
              <CountList title="By education level" rows={d.distribution.byEducation} />
              <div className="md:col-span-3">
                <ChartCard title="Funnel" note="Counts below 5 are shown as <5 and not charted">
                  <VBar data={d.distribution.funnel.map((f) => ({ label: f.label, count: typeof f.count === 'number' ? f.count : 0 }))} x="label" y="count" color="#A78BFA" />
                </ChartCard>
              </div>
            </div>
          )}
          {tab === 'settings' && (
            <div className="space-y-5">
              <section className="card p-5">
                <h2 className="h3 mb-1">Join code</h2>
                <p className="meta mb-4">Students enter this code at sign-up or in their Settings to link to your college.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-xl border border-violet/40 bg-violet/10 px-4 py-2 font-mono text-2xl tracking-wider text-violet">{d.college.joinCode}</span>
                  <button className="btn-secondary" onClick={copy}>
                    {copied ? 'Copied' : 'Copy code'}
                  </button>
                </div>
              </section>
              <section className="card p-5">
                <h2 className="h3 mb-3">College details</h2>
                <dl className="grid max-w-md grid-cols-[120px_1fr] gap-y-1.5 text-[15px]">
                  <dt className="text-ink/60">Name</dt>
                  <dd>{d.college.name}</dd>
                  <dt className="text-ink/60">City</dt>
                  <dd>{d.college.city}</dd>
                  <dt className="text-ink/60">State</dt>
                  <dd>{d.college.state}</dd>
                  <dt className="text-ink/60">Login</dt>
                  <dd>{user.email}</dd>
                </dl>
              </section>
              <section className="card p-5">
                <h2 className="h3 mb-3">Password</h2>
                <ChangePasswordForm />
              </section>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </DashboardLayout>
  );
}
