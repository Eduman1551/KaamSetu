import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import AuthLayout from '@/components/AuthLayout';
import { Alert, Field, PasswordField, RoleTabs, Select, type RoleName } from '@/components/ui';
import { authOptions } from '@/lib/server/auth';
import { DASHBOARD } from '@/lib/roles';
import { EDUCATION_LEVELS, INDUSTRIES, SIZE_BANDS, SignupSchema } from '@/lib/validation';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (session?.user?.role) return { redirect: { destination: DASHBOARD[session.user.role], permanent: false } };
  return { props: {} };
};

const year = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => String(year - 2 + i));
type Errors = Record<string, string | undefined>;

export default function Signup() {
  const router = useRouter();
  const initial = (['student', 'company', 'college'].includes(String(router.query.role)) ? router.query.role : 'student') as RoleName;
  const [role, setRole] = useState<RoleName>(initial);
  const [f, setF] = useState<Record<string, string>>({
    name: '',
    email: '',
    password: '',
    gradYear: String(year + 1),
    educationLevel: EDUCATION_LEVELS[0],
    joinCode: '',
    companyName: '',
    website: '',
    industry: INDUSTRIES[0],
    sizeBand: SIZE_BANDS[1],
    collegeName: '',
    city: '',
    state: '',
  });
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = { ...f, role, consent };
    const parsed = SignupSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await fetch('/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setFormError(body.error ?? 'Could not create the account.');
      if (body.fieldErrors) setErrors(Object.fromEntries(Object.entries(body.fieldErrors as Record<string, string[]>).map(([k, v]) => [k, v?.[0]])));
      return;
    }
    // Log straight in.
    const r = await signIn('credentials', { email: f.email, password: f.password, redirect: false });
    if (r?.ok) router.replace(DASHBOARD[role]);
    else router.replace(`/login?role=${role}&created=1`);
  };

  return (
    <AuthLayout title="Sign up" role={role}>
      <h1 className="page-title mb-1">Create your account</h1>
      <p className="mb-6 text-[15px] text-ink/70">Free for students, companies and colleges.</p>
      <div className="mb-5">
        <RoleTabs
          value={role}
          onChange={(r) => {
            setRole(r);
            setErrors({});
            setFormError(null);
          }}
        />
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {role === 'student' && (
          <>
            <Field label="Full name" autoComplete="name" value={f.name} onChange={set('name')} error={errors.name} />
            <Field label="Email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} />
            <PasswordField label="Password" value={f.password} onChange={(v) => setF((p) => ({ ...p, password: v }))} error={errors.password} meter autoComplete="new-password" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Graduation year" options={YEARS} value={f.gradYear} onChange={set('gradYear')} error={errors.gradYear} />
              <Select label="Education" options={EDUCATION_LEVELS} value={f.educationLevel} onChange={set('educationLevel')} error={errors.educationLevel} />
            </div>
            <Field label="College join code (optional)" placeholder="e.g. KIT-7F3A9" value={f.joinCode} onChange={set('joinCode')} error={errors.joinCode} hint="Ask your placement cell. You can add it later in Settings." />
            <label className="flex items-start gap-2.5 text-sm text-ink/85">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-saffron" />
              <span>My verified skills and anonymous profile may be shown to companies only if I turn visibility on.</span>
            </label>
            {errors.consent && <p className="-mt-2 text-[13px] text-miss">{errors.consent}</p>}
          </>
        )}
        {role === 'company' && (
          <>
            <Field label="Company name" autoComplete="organization" value={f.companyName} onChange={set('companyName')} error={errors.companyName} />
            <Field label="Work email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} />
            <PasswordField label="Password" value={f.password} onChange={(v) => setF((p) => ({ ...p, password: v }))} error={errors.password} meter autoComplete="new-password" />
            <Field label="Website" type="url" placeholder="https://" value={f.website} onChange={set('website')} error={errors.website} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Industry" options={INDUSTRIES} value={f.industry} onChange={set('industry')} error={errors.industry} />
              <Select label="Company size" options={SIZE_BANDS.map((s) => ({ value: s, label: `${s} people` }))} value={f.sizeBand} onChange={set('sizeBand')} error={errors.sizeBand} />
            </div>
          </>
        )}
        {role === 'college' && (
          <>
            <Field label="College name" value={f.collegeName} onChange={set('collegeName')} error={errors.collegeName} />
            <Field label="Official email" type="email" autoComplete="email" value={f.email} onChange={set('email')} error={errors.email} />
            <PasswordField label="Password" value={f.password} onChange={(v) => setF((p) => ({ ...p, password: v }))} error={errors.password} meter autoComplete="new-password" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City" value={f.city} onChange={set('city')} error={errors.city} />
              <Field label="State" value={f.state} onChange={set('state')} error={errors.state} />
            </div>
            <p className="meta">Your college join code is created automatically and shown on your dashboard.</p>
          </>
        )}
        {formError && <Alert>{formError}</Alert>}
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-ink/70">
        Already have an account?{' '}
        <Link href={`/login?role=${role}`} className="font-semibold text-saffron hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
