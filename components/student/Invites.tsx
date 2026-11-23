import { useState } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { Alert, EmptyState, Skeleton } from '../ui';
import { fetcher, send } from '@/lib/fetcher';
import { fadeUp, stagger } from '../motion';

interface Invite {
  id: string;
  company: string;
  industry: string;
  role: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

const STATUS: Record<Invite['status'], string> = {
  pending: 'bg-saffron/15 text-saffron',
  accepted: 'bg-teal/15 text-teal',
  declined: 'bg-ink/10 text-ink/60',
};

export default function Invites({ onChange }: { onChange: () => void }) {
  const { data, error, mutate } = useSWR<{ invites: Invite[] }>('/api/student/invites', fetcher);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const respond = async (id: string, action: 'accept' | 'decline') => {
    setBusy(id);
    setErr(null);
    try {
      await mutate(await send<{ invites: Invite[] }>('/api/student/invites', 'POST', { id, action }), { revalidate: false });
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error) return <Alert>{error.message}</Alert>;
  if (!data) return <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (data.invites.length === 0)
    return (
      <EmptyState title="No invites yet">
        Companies can invite you once you are verified and have turned on visibility in Settings. They see only your anonymous profile.
      </EmptyState>
    );

  return (
    <div className="space-y-3">
      <p className="meta max-w-prose">Accepting shares your name and email with that company only. Declining hides the invite from them.</p>
      {err && <Alert>{err}</Alert>}
      <motion.ul initial="hidden" animate="show" variants={stagger} className="space-y-3">
        {data.invites.map((i) => (
          <motion.li key={i.id} variants={fadeUp} className="card p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="card-title">{i.company}</p>
                <p className="meta">
                  {i.role} · {i.industry} · {new Date(i.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <span className={`chip capitalize ${STATUS[i.status]}`}>{i.status}</span>
            </div>
            <p className="max-w-prose whitespace-pre-wrap text-[15px] text-ink/85">{i.message}</p>
            {i.status === 'pending' && (
              <div className="mt-3 flex gap-2">
                <button className="btn-primary btn-sm" disabled={busy === i.id} onClick={() => respond(i.id, 'accept')}>
                  Accept and share contact
                </button>
                <button className="btn-ghost btn-sm" disabled={busy === i.id} onClick={() => respond(i.id, 'decline')}>
                  Decline
                </button>
              </div>
            )}
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
