// Small shared UI building blocks.
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { passwordStrength } from '@/lib/validation';
import { WarnIcon } from './Icons';

export type RoleName = 'student' | 'company' | 'college';
export const ROLE_META: Record<RoleName, { label: string; chip: string; text: string; ring: string }> = {
  student: { label: 'Student', chip: 'bg-saffron/15 text-saffron', text: 'text-saffron', ring: 'border-saffron' },
  company: { label: 'Company', chip: 'bg-sky/15 text-sky', text: 'text-sky', ring: 'border-sky' },
  college: { label: 'College', chip: 'bg-violet/15 text-violet', text: 'text-violet', ring: 'border-violet' },
};

export function RoleChip({ role }: { role: RoleName }) {
  return <span className={`chip ${ROLE_META[role].chip}`}>{ROLE_META[role].label}</span>;
}

export function RoleTabs({ value, onChange }: { value: RoleName; onChange: (r: RoleName) => void }) {
  return (
    <div role="tablist" aria-label="Account type" className="grid grid-cols-3 gap-1 rounded-xl border border-ink/10 bg-navy-950/60 p-1">
      {(Object.keys(ROLE_META) as RoleName[]).map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={value === r}
          onClick={() => onChange(r)}
          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            value === r ? `bg-navy-700 ${ROLE_META[r].text}` : 'text-ink/65 hover:text-ink'
          }`}
        >
          {ROLE_META[r].label}
        </button>
      ))}
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function Field({ label, error, hint, id, ...rest }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <input id={fid} aria-invalid={!!error} aria-describedby={error ? `${fid}-err` : undefined} className={`input ${error ? 'border-miss/70' : ''}`} {...rest} />
      {error ? (
        <p id={`${fid}-err`} className="mt-1 text-[13px] text-miss">
          {error}
        </p>
      ) : hint ? (
        <p className="meta mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: (string | { value: string; label: string })[];
  error?: string;
}

export function Select({ label, options, error, id, ...rest }: SelectProps) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div>
      <label htmlFor={fid} className="label">
        {label}
      </label>
      <select id={fid} className={`input ${error ? 'border-miss/70' : ''}`} {...rest}>
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          return (
            <option key={v} value={v} className="bg-navy">
              {typeof o === 'string' ? o : o.label}
            </option>
          );
        })}
      </select>
      {error && <p className="mt-1 text-[13px] text-miss">{error}</p>}
    </div>
  );
}

const STRENGTH = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
const STRENGTH_COLOR = ['bg-miss', 'bg-miss', 'bg-saffron', 'bg-teal', 'bg-teal'];

export function PasswordField({
  label = 'Password',
  value,
  onChange,
  error,
  meter = false,
  autoComplete = 'current-password',
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  meter?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const s = passwordStrength(value);
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          className={`input pr-16 ${error ? 'border-miss/70' : ''}`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[13px] text-ink/70 hover:text-ink"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {meter && value.length > 0 && (
        <div className="mt-2" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i < s ? STRENGTH_COLOR[s] : 'bg-ink/10'}`} />
            ))}
          </div>
          <p className="meta mt-1">
            Strength: {STRENGTH[s]}
            {value.length < 8 ? ' · at least 8 characters' : ''}
          </p>
        </div>
      )}
      {error && <p className="mt-1 text-[13px] text-miss">{error}</p>}
    </div>
  );
}

export function Alert({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' | 'success' }) {
  const cls =
    tone === 'error' ? 'border-miss/40 bg-miss/10' : tone === 'success' ? 'border-teal/40 bg-teal/10' : 'border-sky/40 bg-sky/10';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${cls}`}>
      {tone === 'error' && <WarnIcon className="mt-0.5 shrink-0 text-miss" width={16} height={16} />}
      <div>{children}</div>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Simple line illustration (an empty bridge) for empty states. */
function EmptyArt() {
  return (
    <svg viewBox="0 0 120 64" className="mb-4 h-14 w-28 text-sand" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M6 48h108" />
      <path d="M26 48V16M94 48V16" className="text-saffron" stroke="currentColor" />
      <path d="M26 16c14 20 54 20 68 0" />
      <path d="M44 48v-9M60 48v-6M76 48v-9" strokeDasharray="3 4" />
      <path d="M10 58c8-3 16 3 24 0s16-3 24 0 16 3 24 0 16-3 24 0" strokeWidth="1.8" />
    </svg>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <EmptyArt />
      <h3 className="card-title mb-1">{title}</h3>
      {children && <div className="max-w-prose text-[15px] text-ink/70">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const TONES = {
  saffron: 'bg-saffron/15 text-saffron',
  sage: 'bg-teal/15 text-teal',
  blue: 'bg-sky/15 text-sky',
  terracotta: 'bg-miss/15 text-miss',
};

export function Kpi({ label, value, hint, icon, tone = 'saffron' }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="card flex h-full items-start gap-3 p-4">
      {icon && <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${TONES[tone]}`}>{icon}</span>}
      <div className="min-w-0">
      <p className="meta">{label}</p>
      <p className="num mt-0.5 font-mono text-2xl font-semibold">{value}</p>
      {hint && <p className="meta mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

/** Small modal confirm dialog. */
export function Confirm({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title} onClick={onCancel}>
      <div className="card w-full max-w-md bg-navy-800 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="h3 mb-2">{title}</h3>
        <div className="mb-5 text-[15px] text-ink/80">{children}</div>
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onCancel} autoFocus>
            Cancel
          </button>
          <button className={danger ? 'btn border border-miss/60 text-miss hover:bg-miss/10' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Right-side drawer with overlay. Esc or overlay click closes it. */
export function Drawer({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-sand bg-navy-800 shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink/10 px-5 py-3">
          <h2 className="h3">{title}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-ink/10 px-5 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

/** Small "includes sample data" chip shown when seeded rows are in view. */
export function SampleChip({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="chip border border-ink/15 bg-ink/5 text-ink/70" title="Some rows are seeded sample students for the demo">
      Includes sample data
    </span>
  );
}
