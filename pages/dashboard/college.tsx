import { useEffect, useState } from 'react';
import Head from 'next/head';
import { signOut } from 'next-auth/react';
import { motion } from 'framer-motion';
import { BadgeCheck, Check, ClipboardCheck, Copy, Gauge, GraduationCap, LogOut } from 'lucide-react';
import LightTheme from '@/components/LightTheme';
import { Logo } from '@/components/NavBar';
import { EmptyState, Kpi, RoleChip, SampleChip, Skeleton } from '@/components/ui';
import { fadeUp, stagger } from '@/components/motion';
import { requireRole, type AuthUser } from '@/lib/server/guard';
import { getCollegeSummary } from '@/lib/server/college';
import { fetcher } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';

type Data = Awaited<ReturnType<typeof getCollegeSummary>>;
type Plan = NonNullable<Data['plans'][number]>;

export const getServerSideProps = requireRole('college', async (_ctx, user) => ({
  props: { d: JSON.parse(JSON.stringify(await getCollegeSummary(user.id))) as Data },
}));

const NOT_ENOUGH = 'Not enough student data yet';

function Bar({ label, value, note, tone }: { label: string; value: number; note: string; tone: 'gap' | 'demand' }) {
  return (
    <li>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-[15px]">
        <span className="font-medium">{label}</span>
        <span className="num font-mono text-sm">
          {value}% <span className="meta font-body">· {note}</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#F0E9DC]">
        <motion.div
          className={`h-full rounded-full ${tone === 'gap' ? 'bg-miss' : 'bg-sky'}`}
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.max(2, value)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        />
      </div>
    </li>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <motion.section variants={fadeUp} className="card p-5">
      <h2 className="h3">{title}</h2>
      {note && <p className="meta mb-4 mt-0.5">{note}</p>}
      {!note && <div className="mb-4" />}
      {children}
    </motion.section>
  );
}

export default function CollegeDashboard({ d }: { user: AuthUser; d: Data }) {
  const [copied, setCopied] = useState(false);
  const [plans, setPlans] = useState<(Plan | null)[]>(d.plans);
  const [planError, setPlanError] = useState(false);
  const missing = d.gaps.length > 0 && plans.some((p) => !p);

  // Workshops are generated automatically (once per meaningful data change) and cached.
  useEffect(() => {
    if (!missing) return;
    let alive = true;
    fetcher('/api/college/workshops')
      .then((r: { plans: (Plan | null)[] }) => alive && setPlans(r.plans))
      .catch(() => alive && setPlanError(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    await navigator.clipboard.writeText(d.college.joinCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const s = d.stats;
  const pctOr = (v: number | null) => (v == null ? '–' : `${v}%`);

  return (
    <LightTheme>
      <Head>
        <title>{`${d.college.name} · KaamSetu`}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header className="border-b border-sand bg-navy-800">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo href="/dashboard" compact />
            <h1 className="truncate font-heading text-lg font-semibold sm:text-xl">{d.college.name}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-full border border-sand bg-navy-950 px-3 py-1 text-sm transition-colors hover:border-saffron"
              aria-label={`Copy join code ${d.college.joinCode}`}
              title="Copy join code"
            >
              <span className="meta hidden sm:inline">Join code</span>
              <span className="font-mono font-medium">{d.college.joinCode}</span>
              {copied ? <Check size={14} className="text-teal" /> : <Copy size={14} className="text-ink/60" />}
            </button>
            <RoleChip role="college" />
            <a
              href="/api/auth/signout"
              onClick={(e) => {
                e.preventDefault();
                signOut({ callbackUrl: '/' });
              }}
              className="inline-flex items-center gap-1.5 text-sm text-ink/75 hover:text-ink"
            >
              <LogOut size={15} aria-hidden /> <span className="hidden sm:inline">Log out</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <p className="meta max-w-prose">Anonymous totals only. A skill is shown only when at least 5 of your students were tested on it.</p>
          <SampleChip show={d.hasSynthetic} />
        </div>

        <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">
          <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Students linked" value={s.linked} icon={<GraduationCap size={20} />} tone="blue" />
            <Kpi label="Verified" value={pctOr(s.verifiedPct)} icon={<BadgeCheck size={20} />} tone="sage" />
            <Kpi label="Average test score" value={pctOr(s.avgScore)} icon={<Gauge size={20} />} tone="saffron" />
            <Kpi label="Took the test" value={pctOr(s.testedPct)} icon={<ClipboardCheck size={20} />} tone="blue" />
          </motion.div>

          {s.linked === 0 ? (
            <EmptyState title="No students linked yet">
              Share your join code <b className="font-mono">{d.college.joinCode}</b>. Students enter it when they sign up or in their Settings.
            </EmptyState>
          ) : (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Section title="Where our students are lacking" note="The 6 skills with the lowest average test score">
                  {d.lacking.length === 0 ? (
                    <p className="meta py-6 text-center">{NOT_ENOUGH}</p>
                  ) : (
                    <ul className="space-y-3.5">
                      {d.lacking.map((x) => (
                        <Bar key={x.skill} label={displaySkill(x.skill)} value={x.avgScore} note={`tested by ${x.tested} students`} tone="gap" />
                      ))}
                    </ul>
                  )}
                </Section>
                <Section title="What companies expect" note={`Most requested skills across ${d.openRequirements} open company requirements`}>
                  {d.expected.length === 0 ? (
                    <p className="meta py-6 text-center">No open company requirements yet</p>
                  ) : (
                    <ul className="space-y-3.5">
                      {d.expected.map((x) => (
                        <Bar key={x.skill} label={displaySkill(x.skill)} value={x.pct} note="of requirements" tone="demand" />
                      ))}
                    </ul>
                  )}
                </Section>
              </div>

              <Section title="Priority gaps" note="Gap index = company demand % × (100 − student average %) / 100">
                {d.gaps.length === 0 ? (
                  <p className="meta py-6 text-center">{NOT_ENOUGH}</p>
                ) : (
                  <ol className="divide-y divide-ink/5">
                    {d.gaps.map((g, i) => (
                      <li key={g.skill} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-3 first:pt-0 last:pb-0">
                        <span className="flex min-w-[180px] flex-1 items-center gap-3">
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-miss/15 font-mono text-sm font-semibold text-miss">{i + 1}</span>
                          <span className="card-title">{displaySkill(g.skill)}</span>
                        </span>
                        <span className="num text-sm text-ink/75">
                          Student average <b className="font-mono text-ink">{g.avgScore}%</b>
                        </span>
                        <span className="num text-sm text-ink/75">
                          Company demand <b className="font-mono text-ink">{g.demandPct}%</b>
                        </span>
                        <span className="num chip bg-miss/15 font-mono text-miss">gap {g.gapIndex}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Section>

              <motion.section variants={fadeUp}>
                <h2 className="h3 mb-1">Suggested workshops</h2>
                <p className="meta mb-4">One-day workshops for each priority gap, suggested by AI from your cohort&apos;s anonymous data.</p>
                {d.gaps.length === 0 ? (
                  <EmptyState title={NOT_ENOUGH}>Workshops appear once at least 5 linked students are tested on a skill.</EmptyState>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    {d.gaps.map((g, i) => {
                      const p = plans[i];
                      return (
                        <article key={g.skill} className="card lift flex flex-col p-5">
                          <p className="kicker mb-2">{displaySkill(g.skill)}</p>
                          {p ? (
                            <>
                              <h3 className="card-title mb-2 leading-snug">{p.title}</h3>
                              <ul className="mb-4 space-y-1.5 text-[15px] text-ink/85">
                                {p.topics.map((t) => (
                                  <li key={t} className="flex gap-2">
                                    <Check size={16} className="mt-1 shrink-0 text-teal" aria-hidden />
                                    <span>{t}</span>
                                  </li>
                                ))}
                              </ul>
                              <div className="mt-auto flex flex-wrap gap-1.5">
                                <span className="chip bg-saffron/15 text-saffron">{p.duration}</span>
                                <span className="chip whitespace-normal bg-sky/15 text-sky">{p.audience}</span>
                              </div>
                            </>
                          ) : planError ? (
                            <p className="meta">The suggestion could not be prepared right now. It will appear on your next visit.</p>
                          ) : (
                            <div className="space-y-2.5" aria-busy="true" aria-label="Preparing workshop suggestion">
                              <Skeleton className="h-5 w-4/5" />
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-11/12" />
                              <Skeleton className="h-4 w-3/4" />
                              <p className="meta pt-1">Preparing a suggestion…</p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            </>
          )}
        </motion.div>
      </main>
    </LightTheme>
  );
}
