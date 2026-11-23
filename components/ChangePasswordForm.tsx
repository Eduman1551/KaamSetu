import { useState, type FormEvent } from 'react';
import { Alert, PasswordField } from './ui';
import { send } from '@/lib/fetcher';
import { ChangePasswordSchema } from '@/lib/validation';

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = ChangePasswordSchema.safeParse({ current, next });
    if (!parsed.success) return setMsg({ tone: 'error', text: parsed.error.issues[0]?.message ?? 'Check the form.' });
    setBusy(true);
    try {
      await send('/api/account/password', 'POST', parsed.data);
      setMsg({ tone: 'success', text: 'Password changed.' });
      setCurrent('');
      setNext('');
    } catch (err) {
      setMsg({ tone: 'error', text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-md space-y-3" noValidate>
      <PasswordField label="Current password" value={current} onChange={setCurrent} />
      <PasswordField label="New password" value={next} onChange={setNext} meter autoComplete="new-password" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <button className="btn-secondary" disabled={busy || !current || !next}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
