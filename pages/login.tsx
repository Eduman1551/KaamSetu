import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import AuthLayout from '@/components/AuthLayout';
import { Alert, Field, PasswordField, RoleTabs, type RoleName } from '@/components/ui';
import { authOptions } from '@/lib/server/auth';
import { DASHBOARD } from '@/lib/roles';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session?.user?.role) return { redirect: { destination: DASHBOARD[session.user.role], permanent: false } };
  return { props: {} };
};

export default function Login() {
  const router = useRouter();
  const initial = (['student', 'company', 'college'].includes(String(router.query.role)) ? router.query.role : 'student') as RoleName;
  const [role, setRole] = useState<RoleName>(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(router.query.created ? null : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const r = await signIn('credentials', { email, password, redirect: false });
    if (!r || r.error) {
      setBusy(false);
      setError(r?.error && r.error !== 'CredentialsSignin' ? r.error : 'Incorrect email or password.');
      return;
    }
    // The server sends each role to its own dashboard.
    const next = typeof router.query.next === 'string' && router.query.next.startsWith('/dashboard') ? router.query.next : '/dashboard';
    router.replace(next);
  };

  return (
    <AuthLayout title="Log in" role={role}>
      <h1 className="page-title mb-1">Welcome back</h1>
      <p className="mb-6 text-[15px] text-ink/70">Log in to your KaamSetu account.</p>
      <div className="mb-5">
        <RoleTabs value={role} onChange={setRole} />
      </div>
      {router.query.created && <div className="mb-4"><Alert tone="success">Account created. Please log in.</Alert></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label={role === 'student' ? 'Email' : role === 'company' ? 'Work email' : 'Official email'}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordField value={password} onChange={setPassword} />
        {error && <Alert>{error}</Alert>}
        <button type="submit" className="btn-primary w-full py-3" disabled={busy || !email || !password}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink/70">
        New to KaamSetu?{' '}
        <Link href={`/signup?role=${role}`} className="font-semibold text-saffron hover:underline">
          Create a {role} account
        </Link>
      </p>
    </AuthLayout>
  );
}
