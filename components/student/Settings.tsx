import { useState } from 'react';
import { signOut } from 'next-auth/react';
import useSWR from 'swr';
import type { StudentData } from './types';
import { Alert, Confirm, Field, PasswordField, Skeleton } from '../ui';
import ChangePasswordForm from '../ChangePasswordForm';
import { fetcher, send } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';
import type { CompanyCandidateDTO } from '@/lib/companyDto';

function Section({ title, children, note }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="h3">{title}</h2>
      {note && <p className="meta mb-4 mt-1 max-w-prose">{note}</p>}
      {!note && <div className="mb-4" />}
      {children}
    </section>
  );
}

/** Exactly what companies see (built by the same server-side DTO mapper). */
function Preview({ p }: { p: CompanyCandidateDTO }) {
  return (
    <div className="max-w-sm rounded-2xl border border-ink/15 bg-navy-950/50 p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="font-mono text-[15px] font-medium">{p.anonCode}</p>
          <p className="meta">
            {p.educationLevel} · {p.gradYear}
          </p>
        </div>
        <span className="chip num bg-ink/5">Test {p.overallScore}%</span>
      </div>
      <div className="mb-3">
        <span className={`chip ${p.verified ? 'bg-teal/15 text-teal' : 'bg-ink/10 text-ink/60'}`}>
          {p.verified ? (p.distinction ? 'Distinction' : 'Verified') : 'Not verified'}
        </span>
      </div>
      <ul className="mb-3 space-y-1 text-sm">
        {p.skills.slice(0, 5).map((s) => (
          <li key={s.skill} className="flex justify-between">
            <span className={s.verified ? '' : 'text-ink/50'}>{displaySkill(s.skill)}</span>
            <span className={`num font-mono ${s.verified ? 'text-teal' : 'text-ink/50'}`}>{s.scorePct}%</span>
          </li>
        ))}
        {p.skills.length === 0 && <li className="meta">No tested skills yet.</li>}
      </ul>
      {p.highlights.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-ink/75">
          {p.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Settings({ d, refresh }: { d: StudentData; refresh: () => void }) {
  const verifiedNow = d.verification === 'verified' || d.verification === 'distinction';
  const { data, mutate } = useSWR<{ preview: CompanyCandidateDTO | null }>('/api/student/settings', fetcher);
  const [visBusy, setVisBusy] = useState(false);
  const [visErr, setVisErr] = useState<string | null>(null);
  const [code, setCode] = useState(d.profile?.joinCode ?? '');
  const [codeMsg, setCodeMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const toggle = async () => {
    setVisBusy(true);
    setVisErr(null);
    try {
      await send('/api/student/settings', 'PATCH', { visible: !d.profile?.visible });
      refresh();
      mutate();
    } catch (e) {
      setVisErr((e as Error).message);
    } finally {
      setVisBusy(false);
    }
  };

  const saveCode = async () => {
    setCodeMsg(null);
    try {
      const r = await send<{ collegeName: string | null }>('/api/student/settings', 'PATCH', { joinCode: code });
      setCodeMsg({ tone: 'success', text: r.collegeName ? `Linked to ${r.collegeName}.` : 'College link removed.' });
      refresh();
    } catch (e) {
      setCodeMsg({ tone: 'error', text: (e as Error).message });
    }
  };

  const deleteAccount = async () => {
    setDelBusy(true);
    setDelErr(null);
    try {
      await send('/api/student/account', 'DELETE', { password: delPw });
      await signOut({ callbackUrl: '/?deleted=1' });
    } catch (e) {
      setDelErr((e as Error).message);
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <Section
        title="Visibility to companies"
        note="When on, companies can see your anonymous verified profile (code, graduation year, education level, test scores and anonymised highlights). Never your name, email, college or resume."
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
          <div>
            <label className={`flex items-center gap-3 ${verifiedNow ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
              <button
                role="switch"
                aria-checked={!!d.profile?.visible}
                disabled={!verifiedNow || visBusy}
                onClick={toggle}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${d.profile?.visible ? 'bg-teal' : 'bg-ink/20'}`}
              >
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-ink transition-[left] ${d.profile?.visible ? 'left-6' : 'left-1'}`} />
              </button>
              <span className="text-[15px]">{d.profile?.visible ? 'Visible to companies' : 'Hidden from companies'}</span>
            </label>
            {!verifiedNow && <p className="meta mt-2">Pass the skills test to unlock visibility.</p>}
            {visErr && (
              <div className="mt-3">
                <Alert>{visErr}</Alert>
              </div>
            )}
          </div>
          <div>
            <p className="meta mb-2">How companies see you</p>
            {data?.preview ? <Preview p={data.preview} /> : <Skeleton className="h-48 w-72" />}
          </div>
        </div>
      </Section>

      <Section title="College" note="Link your account to your college with the join code from your placement cell. Your college only ever sees anonymous totals, never your name or scores.">
        <div className="flex max-w-md items-end gap-2">
          <div className="flex-1">
            <Field label={d.profile?.collegeName ? `Linked: ${d.profile.collegeName}` : 'Join code'} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. KIT-7F3A9" />
          </div>
          <button className="btn-secondary mb-[1px]" onClick={saveCode}>
            Save
          </button>
        </div>
        {codeMsg && (
          <div className="mt-3 max-w-md">
            <Alert tone={codeMsg.tone}>{codeMsg.text}</Alert>
          </div>
        )}
      </Section>

      <Section title="Password">
        <ChangePasswordForm />
      </Section>

      <div className="flex justify-end">
        <button className="text-sm text-ink/55 underline-offset-4 hover:text-miss hover:underline" onClick={() => setDel(true)}>
          Delete account
        </button>
      </div>
      <Confirm
        open={del}
        title="Delete your account?"
        confirmLabel="Delete permanently"
        danger
        busy={delBusy}
        onConfirm={deleteAccount}
        onCancel={() => {
          setDel(false);
          setDelPw('');
          setDelErr(null);
        }}
      >
        <p className="mb-3">This permanently deletes your account, analysis, screenshots, test history, skills and invites. It cannot be undone.</p>
        <PasswordField label="Enter your password to confirm" value={delPw} onChange={setDelPw} />
        {delErr && (
          <div className="mt-2">
            <Alert>{delErr}</Alert>
          </div>
        )}
      </Confirm>
    </div>
  );
}
