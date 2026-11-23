import { useMemo, useState } from 'react';
import Head from 'next/head';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { requireRole, type AuthUser } from '@/lib/server/guard';
import { getCompanyDashboard } from '@/lib/server/company';
import { Alert, Drawer, EmptyState, Kpi, RoleChip, SampleChip, Skeleton } from '@/components/ui';
import { CHART, ChartCard, HBar, VBar } from '@/components/charts';
import LightTheme from '@/components/LightTheme';
import DashBand from '@/components/DashBand';
import { LogoutButton, NavyTopBar } from '@/components/DashboardLayout';
import { BadgeCheck, ClipboardList, Gauge, Handshake } from 'lucide-react';
import RequirementDrawer, { type RequirementRow } from '@/components/company/RequirementDrawer';
import { fetcher, send } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';
import { fadeUp, stagger } from '@/components/motion';

type Data = Awaited<ReturnType<typeof getCompanyDashboard>>;
type Candidate = Data['candidates'][number];

export const getServerSideProps = requireRole('company', async (_ctx, user) => {
  const data = await getCompanyDashboard(user.id, null);
  const first = data.requirements.find((r) => r.status === 'open')?.id ?? null;
  const initial = first ? await getCompanyDashboard(user.id, first) : data;
  return { props: { initial: JSON.parse(JSON.stringify(initial)) as Data } };
});

const year = new Date().getFullYear();

function CandidateDrawer({ c, data, onClose, onSent }: { c: Candidate | null; data: Data; onClose: () => void; onSent: () => void }) {
  const req = data.requirements.find((r) => r.id === data.selected) ?? null;
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const open = !!c;
  const reset = () => {
    setMessage('');
    setError(null);
    setSent(false);
    onClose();
  };
  const sendInvite = async () => {
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      await send('/api/company/invites', 'POST', { anonCode: c.anonCode, requirementId: req?.id ?? null, message });
      setSent(true);
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer open={open} title={c ? `Candidate ${c.anonCode}` : ''} onClose={reset}>
      {c && (
        <div className="space-y-5 text-[15px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-teal/15 text-teal">{c.distinction ? 'Verified with Distinction' : 'Verified'}</span>
            <span className="meta">
              Graduating {c.gradYear} · {c.educationLevel}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Overall test score" value={`${c.overallScore}%`} />
            <Kpi label={req ? `Match for ${req.roleTitle}` : 'Match'} value={c.match != null ? `${c.match}%` : '–'} />
          </div>
          <div>
            <h3 className="card-title mb-2">Tested skills</h3>
            <ul className="space-y-1.5">
              {c.skills.map((s) => (
                <li key={s.skill} className="flex items-center justify-between gap-2 text-sm">
                  <span>{displaySkill(s.skill)}</span>
                  <span className={`num font-mono ${s.verified ? 'text-teal' : 'text-ink/55'}`}>
                    {s.scorePct}% {s.verified ? '· verified' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="card-title mb-2">Highlights (anonymised)</h3>
            {c.highlights.length ? (
              <ul className="list-disc space-y-1 pl-5 text-ink/85">
                {c.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            ) : (
              <p className="meta">No highlights yet.</p>
            )}
          </div>
          <div className="border-t border-ink/10 pt-4">
            <h3 className="card-title mb-1">Send interest</h3>
            <p className="meta mb-2">The student sees your company name, role and message. Their name and email are shared only if they accept.</p>
            {c.invite || sent ? (
              <Alert tone="success">Invite {sent ? 'sent' : c.invite}. You will see their contact details here once they accept.</Alert>
            ) : (
              <>
                <textarea
                  className="input min-h-[96px]"
                  maxLength={280}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={`Hi! Your verified skills match our ${req?.roleTitle ?? 'opening'}. Would you like to talk?`}
                  aria-label="Message to the candidate"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className="meta num">{message.length}/280</span>
                  <span className="meta num">
                    {data.kpis.invitesSentToday}/{data.invitesPerDay} invites today
                  </span>
                </div>
                {error && (
                  <div className="mt-2">
                    <Alert>{error}</Alert>
                  </div>
                )}
                <button className="btn-primary mt-3 w-full" onClick={sendInvite} disabled={busy || message.trim().length < 5}>
                  {busy ? 'Sending…' : 'Send interest'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

export default function CompanyDashboard({ user, initial }: { user: AuthUser; initial: Data }) {
  const [reqId, setReqId] = useState<string | null>(initial.selected);
  const { data, mutate, isLoading } = useSWR<Data>(`/api/company/dashboard${reqId ? `?req=${reqId}` : ''}`, fetcher, {
    fallbackData: reqId === initial.selected ? initial : undefined,
    keepPreviousData: true,
  });
  const d = data ?? initial;
  const req = d.requirements.find((r) => r.id === d.selected) ?? null;

  // Filters
  const [minScore, setMinScore] = useState<number | ''>('');
  const [skillFilter, setSkillFilter] = useState<string[]>([]);
  const [gradYear, setGradYear] = useState<string>('');
  const [distinctionOnly, setDistinctionOnly] = useState(false);
  const [showPartial, setShowPartial] = useState(false);
  const [editing, setEditing] = useState<RequirementRow | null | 'new'>(null);
  const [selected, setSelected] = useState<Candidate | null>(null);

  const effectiveMin = minScore === '' ? req?.minOverallScore ?? 0 : minScore;
  const poolSkills = useMemo(() => d.analytics.topSkills.map((s) => s.skill), [d.analytics.topSkills]);
  const list = d.candidates.filter(
    (c) =>
      c.overallScore >= effectiveMin &&
      (!distinctionOnly || c.distinction) &&
      (!gradYear || String(c.gradYear) === gradYear) &&
      skillFilter.every((s) => c.skills.some((x) => x.skill === s && x.verified)) &&
      (showPartial || c.missingMustHave.length === 0),
  );

  return (
    <LightTheme>
      <Head>
        <title>Company dashboard · KaamSetu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen">
        <NavyTopBar>
          <span className="hidden max-w-[200px] truncate text-sm text-[#C9D4E8] md:inline">{d.company?.name ?? user.name}</span>
          <RoleChip role="company" />
          <button className="btn-primary btn-sm" onClick={() => setEditing('new')}>
            <span className="sm:hidden">Post</span>
            <span className="hidden sm:inline">Post requirement</span>
          </button>
          <LogoutButton />
        </NavyTopBar>

        <DashBand
          wide
          title={`${d.company?.name ?? 'Company'} hiring dashboard`}
          subtitle="Anonymous, test-verified candidates ranked against your own requirements."
          aside={<span className="on-navy"><SampleChip show={d.hasSynthetic} /></span>}
          stats={
            <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {(
                [
                  { label: 'Visible verified candidates', value: d.kpis.candidates, icon: <BadgeCheck size={20} />, tone: 'sage' },
                  { label: 'Average overall test score', value: `${d.kpis.avgScore}%`, icon: <Gauge size={20} />, tone: 'saffron' },
                  { label: 'Open requirements', value: d.kpis.openRequirements, icon: <ClipboardList size={20} />, tone: 'blue' },
                  { label: 'Invites accepted', value: d.kpis.invitesAccepted, icon: <Handshake size={20} />, tone: 'sage' },
                ] as const
              ).map((k) => (
                <motion.div key={k.label} variants={fadeUp}>
                  <Kpi label={k.label} value={k.value} icon={k.icon} tone={k.tone} />
                </motion.div>
              ))}
            </motion.div>
          }
        />

        <main className="mx-auto max-w-[1280px] space-y-6 px-4 pb-8 sm:px-6">
          <section className="card flex flex-col gap-3 p-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label htmlFor="req" className="label">
                Requirement
              </label>
              <select id="req" className="input" value={reqId ?? ''} onChange={(e) => setReqId(e.target.value || null)}>
                <option value="" className="bg-navy">
                  No requirement - browse all
                </option>
                {d.requirements.map((r) => (
                  <option key={r.id} value={r.id} className="bg-navy">
                    {r.roleTitle} {r.status === 'closed' ? '(closed)' : ''} · {r.openings} opening{r.openings > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
            {req && (
              <div className="flex flex-wrap gap-1.5 md:max-w-[50%]">
                {req.skills.map((s) => (
                  <span key={s.skill} className={`chip ${s.mustHave ? 'bg-saffron/15 text-saffron' : 'bg-ink/5 text-ink/75'}`}>
                    {displaySkill(s.skill)} ×{s.weight}
                    {s.mustHave ? ' · must' : ''}
                  </span>
                ))}
              </div>
            )}
            <button className="btn-secondary shrink-0" onClick={() => setEditing(req ? (req as RequirementRow) : 'new')}>
              {req ? 'Edit requirement' : 'Add requirement'}
            </button>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Demand vs supply" note={req ? 'Verified candidates per required skill (red = scarce)' : 'Select a requirement to compare'}>
              {req ? (
                <HBar
                  data={d.analytics.demandSupply.map((s) => ({ ...s, skill: displaySkill(s.skill) }))}
                  x="verified"
                  y="skill"
                  color={CHART.navy}
                  highlight={(s: { verified: number }) => s.verified < 3}
                />
              ) : (
                <p className="meta py-16 text-center">No requirement selected.</p>
              )}
            </ChartCard>
            <ChartCard title="Top verified skills" note="In the whole visible pool">
              <HBar data={d.analytics.topSkills.map((s) => ({ ...s, skill: displaySkill(s.skill) }))} x="count" y="skill" />
            </ChartCard>
            <ChartCard title="Score distribution" note="Overall test score of visible candidates">
              <VBar data={d.analytics.histogram} x="range" y="count" color={CHART.navy} />
            </ChartCard>
          </div>

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h2 className="section-title">Candidates</h2>
              <span className="meta num">
                {list.length} of {d.candidates.length} shown{req ? `, ranked by match for ${req.roleTitle}` : ''}
              </span>
            </div>
            <div className="card mb-4 flex flex-wrap items-end gap-3 p-3 text-sm">
              <label className="flex flex-col gap-1">
                <span className="meta">Min overall score</span>
                <input type="number" min={0} max={100} className="input w-28" placeholder={String(req?.minOverallScore ?? 0)} value={minScore} onChange={(e) => setMinScore(e.target.value === '' ? '' : Number(e.target.value))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="meta">Graduation year</span>
                <select className="input w-32" value={gradYear} onChange={(e) => setGradYear(e.target.value)}>
                  <option value="" className="bg-navy">
                    Any
                  </option>
                  {[year - 1, year, year + 1, year + 2].map((y) => (
                    <option key={y} className="bg-navy">
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pb-2">
                <input type="checkbox" className="h-4 w-4 accent-saffron" checked={distinctionOnly} onChange={(e) => setDistinctionOnly(e.target.checked)} />
                Distinction only
              </label>
              {req && (
                <label className="flex items-center gap-2 pb-2">
                  <input type="checkbox" className="h-4 w-4 accent-saffron" checked={showPartial} onChange={(e) => setShowPartial(e.target.checked)} />
                  Show partial matches
                </label>
              )}
              <div className="flex flex-1 flex-wrap gap-1.5 pb-1" aria-label="Filter by verified skill">
                {poolSkills.map((s) => {
                  const on = skillFilter.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => setSkillFilter((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                      aria-pressed={on}
                      className={`chip ${on ? 'bg-teal/20 text-teal' : 'bg-ink/5 text-ink/70 hover:text-ink'}`}
                    >
                      {displaySkill(s)}
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading && !data ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-40" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <EmptyState title="No candidates match these filters">Try lowering the minimum score, removing a skill filter, or turning on partial matches.</EmptyState>
            ) : (
              <motion.ul initial="hidden" animate="show" variants={stagger} className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((c) => {
                  const reqSkills = new Set(req?.skills.map((s) => s.skill) ?? []);
                  const shown = (req ? c.skills.filter((s) => reqSkills.has(s.skill)) : c.skills).slice(0, 5);
                  return (
                    <motion.li key={c.anonCode} variants={fadeUp}>
                      <button onClick={() => setSelected(c)} className="card lift block h-full w-full p-4 text-left">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-[15px] font-medium">{c.anonCode}</p>
                            <p className="meta">
                              {c.educationLevel} · {c.gradYear}
                            </p>
                          </div>
                          {c.match != null && (
                            <span className="num rounded-full bg-saffron/15 px-2.5 py-1 font-mono text-sm font-semibold text-saffron">{c.match}% match</span>
                          )}
                        </div>
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          <span className="chip bg-teal/15 text-teal">{c.distinction ? 'Distinction' : 'Verified'}</span>
                          <span className="chip num bg-ink/5 text-ink/80">Test {c.overallScore}%</span>
                          {c.missingMustHave.length > 0 && <span className="chip bg-miss/15 text-miss">Missing must-have</span>}
                          {c.invite && <span className="chip bg-sky/15 text-sky">Invite {c.invite}</span>}
                        </div>
                        <ul className="space-y-1 text-sm">
                          {shown.map((s) => (
                            <li key={s.skill} className="flex justify-between gap-2">
                              <span className={s.verified ? '' : 'text-ink/50'}>{displaySkill(s.skill)}</span>
                              <span className={`num font-mono ${s.verified ? 'text-teal' : 'text-ink/50'}`}>{s.scorePct}%</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </section>

          <section>
            <h2 className="section-title mb-3">Accepted invites</h2>
            {d.accepted.length === 0 ? (
              <EmptyState title="No accepted invites yet">When a candidate accepts, their name and email appear here, and only here.</EmptyState>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-ink/60">
                    <tr>
                      <th className="px-4 py-2 font-medium">Candidate</th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Email</th>
                      <th className="px-4 py-2 font-medium">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {d.accepted.map((a) => (
                      <tr key={a.anonCode + a.role}>
                        <td className="px-4 py-2.5 font-mono">{a.anonCode}</td>
                        <td className="px-4 py-2.5">{a.name}</td>
                        <td className="px-4 py-2.5">
                          <a className="text-saffron hover:underline" href={`mailto:${a.email}`}>
                            {a.email}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-ink/80">{a.role}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>

      <RequirementDrawer
        open={editing !== null}
        initial={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={(id) => {
          setEditing(null);
          setReqId(id);
          mutate();
        }}
      />
      <CandidateDrawer c={selected} data={d} onClose={() => setSelected(null)} onSent={() => mutate()} />
    </LightTheme>
  );
}
