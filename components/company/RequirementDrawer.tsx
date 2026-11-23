import { useEffect, useId, useState } from 'react';
import useSWR from 'swr';
import { Alert, Drawer, Field, Select } from '../ui';
import { fetcher, send } from '@/lib/fetcher';
import { displaySkill } from '@/lib/skillNames';
import { RequirementSchema } from '@/lib/validation';

export interface RequirementRow {
  id: string;
  roleTitle: string;
  experienceLevel: 'fresher' | '0-2y';
  openings: number;
  minOverallScore: number;
  status: 'open' | 'closed';
  skills: { skill: string; weight: number; mustHave: boolean }[];
}

const EMPTY: Omit<RequirementRow, 'id'> = { roleTitle: '', experienceLevel: 'fresher', openings: 1, minOverallScore: 70, status: 'open', skills: [] };

/** Add / edit a hiring requirement: role, level, openings, min score, weighted skills. */
export default function RequirementDrawer({ open, initial, onClose, onSaved }: { open: boolean; initial: RequirementRow | null; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<Omit<RequirementRow, 'id'>>(EMPTY);
  const [skillInput, setSkillInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const listId = useId();
  const { data } = useSWR<{ skills: string[] }>(open ? '/api/company/skills' : null, fetcher);

  useEffect(() => {
    if (open) {
      setF(initial ? { ...initial, skills: initial.skills.map((s) => ({ ...s })) } : EMPTY);
      setError(null);
      setSkillInput('');
    }
  }, [open, initial]);

  const addSkill = () => {
    const s = skillInput.trim().toLowerCase();
    if (!s || f.skills.some((x) => x.skill === s) || f.skills.length >= 12) return;
    setF((p) => ({ ...p, skills: [...p.skills, { skill: s, weight: 3, mustHave: false }] }));
    setSkillInput('');
  };
  const updateSkill = (i: number, patch: Partial<RequirementRow['skills'][number]>) =>
    setF((p) => ({ ...p, skills: p.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));

  const save = async () => {
    const parsed = RequirementSchema.safeParse(f);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Please check the form.');
    setBusy(true);
    setError(null);
    try {
      const r = await send<{ id: string }>(initial ? `/api/company/requirements?id=${initial.id}` : '/api/company/requirements', initial ? 'PUT' : 'POST', parsed.data);
      onSaved(r.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={open}
      title={initial ? 'Edit requirement' : 'Post a requirement'}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save requirement'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Role title" value={f.roleTitle} onChange={(e) => setF({ ...f, roleTitle: e.target.value })} placeholder="e.g. Junior Data Analyst" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Experience level"
            options={[
              { value: 'fresher', label: 'Fresher' },
              { value: '0-2y', label: '0-2 years' },
            ]}
            value={f.experienceLevel}
            onChange={(e) => setF({ ...f, experienceLevel: e.target.value as RequirementRow['experienceLevel'] })}
          />
          <Field label="Openings" type="number" min={1} max={500} value={f.openings} onChange={(e) => setF({ ...f, openings: Number(e.target.value) })} />
          <Field label="Min overall test score (%)" type="number" min={0} max={100} value={f.minOverallScore} onChange={(e) => setF({ ...f, minOverallScore: Number(e.target.value) })} />
          <Select
            label="Status"
            options={[
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ]}
            value={f.status}
            onChange={(e) => setF({ ...f, status: e.target.value as RequirementRow['status'] })}
          />
        </div>

        <div>
          <label htmlFor={`${listId}-in`} className="label">
            Skills (weight 1-5, mark must-haves)
          </label>
          <div className="flex gap-2">
            <input
              id={`${listId}-in`}
              className="input"
              list={listId}
              value={skillInput}
              placeholder="Type a skill, e.g. sql"
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={addSkill}>
              Add
            </button>
          </div>
          <datalist id={listId}>
            {(data?.skills ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <ul className="mt-3 space-y-2">
            {f.skills.map((s, i) => (
              <li key={s.skill} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink/10 bg-navy-950/40 px-3 py-2 text-sm">
                <span className="min-w-[100px] flex-1 font-medium">{displaySkill(s.skill)}</span>
                <label className="flex items-center gap-2">
                  <span className="meta">Weight</span>
                  <input type="range" min={1} max={5} value={s.weight} onChange={(e) => updateSkill(i, { weight: Number(e.target.value) })} className="accent-saffron" aria-label={`Weight for ${s.skill}`} />
                  <span className="num w-3 font-mono">{s.weight}</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={s.mustHave} onChange={(e) => updateSkill(i, { mustHave: e.target.checked })} className="h-4 w-4 accent-saffron" />
                  Must-have
                </label>
                <button className="text-ink/60 hover:text-miss" onClick={() => setF((p) => ({ ...p, skills: p.skills.filter((_, j) => j !== i) }))} aria-label={`Remove ${s.skill}`}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
        {error && <Alert>{error}</Alert>}
      </div>
    </Drawer>
  );
}
