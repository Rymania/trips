import { useId, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { useFamily, type FamilyApi } from '../../account/ProfileProvider';
import type { FamilyMember, MemberInput, MemberKind } from '../../account/types';
import { ageInYears, familyDefaults } from '../../domain/family';
import { AGE_GROUPS } from '../../domain/types';
import { t } from '../../i18n';

const MAX_MEMBERS = 20;
const NICKNAME_MAX = 30;
const KINDS: [MemberKind, string][] = [
  ['adult', t.kindAdult],
  ['child', t.kindChild],
  ['dog', t.kindDog],
];
const monthName = (month: number, style: 'long' | 'short') =>
  new Date(2000, month - 1, 1).toLocaleString('en-GB', { month: style });
const MONTHS = Array.from({ length: 12 }, (_, i) => monthName(i + 1, 'long'));

function describeMember(m: FamilyMember, today: Date): string {
  if (m.kind === 'child' && m.birth) {
    const born = `${monthName(m.birth.month, 'short')} ${m.birth.year}`;
    return t.childDetails(born, ageInYears(m.birth, today));
  }
  return m.kind === 'dog' ? t.kindDog : t.kindAdult;
}

/** Settings → Family (spec 005 US3). */
export function FamilySection() {
  const family = useFamily();
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <section
      id="family"
      className="card form-card settings__section"
      aria-labelledby="family-title"
    >
      <h3 id="family-title" ref={heading} tabIndex={-1}>
        {t.family}
      </h3>
      <p className="hint">{t.familyIntro}</p>
      <FamilyBody family={family} heading={heading} />
    </section>
  );
}

function FamilyBody({
  family,
  heading,
}: {
  family: FamilyApi;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  if (family.status === 'error') {
    return (
      <div role="alert" className="banner">
        <p>{t.familyLoadFailed}</p>
        <button type="button" className="btn btn-primary" onClick={family.reload}>
          {t.retry}
        </button>
      </div>
    );
  }
  if (family.status !== 'ready') {
    return (
      <p role="status" className="skeleton skeleton--short">
        {t.pageLoading}
      </p>
    );
  }
  return (
    <>
      <FamilySummary members={family.members} />
      <MemberList family={family} onRemoved={() => heading.current?.focus()} />
      {family.members.length >= MAX_MEMBERS ? (
        <p>{t.familyLimit}</p>
      ) : (
        <>
          <h4 className="settings__subhead">{t.addMember}</h4>
          <MemberForm label={t.addMember} submitLabel={t.addMemberButton} onSubmit={family.add} />
        </>
      )}
    </>
  );
}

/** Spells out the filters this family gives new searches. */
function FamilySummary({ members }: { members: FamilyMember[] }) {
  const d = familyDefaults(members, new Date());
  const labels = AGE_GROUPS.filter((g) => d.ageGroups?.includes(g.id)).map((g) => g.label);
  const parts = [
    labels.length > 0 ? t.familyAges(labels.join(', ')) : null,
    d.familySize ? t.familyOf(d.familySize) : null,
    d.dogFriendly ? t.familyDog : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return null;
  return <p className="family-summary">{t.familySummary(parts.join(' · '))}</p>;
}

function MemberList({ family, onRemoved }: { family: FamilyApi; onRemoved: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // Where focus goes once an edit form closes and its row's Edit button is back.
  const refocus = useRef<string | null>(null);
  const { members } = family;

  const run = async (change: Promise<boolean>) => {
    const ok = await change;
    setFailed(!ok);
    return ok;
  };
  const closeEdit = (id: string) => {
    refocus.current = id;
    setEditing(null);
  };

  if (members.length === 0) return <p>{t.familyEmpty}</p>;
  return (
    <>
      {failed && (
        <p role="alert" className="error-text">
          {t.familyUpdateFailed}
        </p>
      )}
      <ol className="family-list">
        {members.map((m, i) => (
          <li key={m.id} className="family-list__item">
            {editing === m.id ? (
              <MemberForm
                label={t.editMember(m.nickname)}
                initial={m}
                submitLabel={t.saveMember}
                onSubmit={async (input) => {
                  const ok = await family.update(m.id, input);
                  if (ok) closeEdit(m.id);
                  return ok;
                }}
                onCancel={() => closeEdit(m.id)}
              />
            ) : (
              <MemberRow
                member={m}
                first={i === 0}
                last={i === members.length - 1}
                editRef={(el) => {
                  if (el && refocus.current === m.id) {
                    refocus.current = null;
                    el.focus();
                  }
                }}
                onEdit={() => setEditing(m.id)}
                onMove={(by) => void run(family.move(m.id, by))}
                onRemove={async () => {
                  if (await run(family.remove(m.id))) onRemoved();
                }}
              />
            )}
          </li>
        ))}
      </ol>
    </>
  );
}

function MemberRow({
  member: m,
  first,
  last,
  editRef,
  onEdit,
  onMove,
  onRemove,
}: {
  member: FamilyMember;
  first: boolean;
  last: boolean;
  editRef: (el: HTMLButtonElement | null) => void;
  onEdit: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => Promise<void>;
}) {
  return (
    <>
      <span className="family-list__who">
        <span className="family-list__name">{m.nickname}</span>
        <span className="meta">{describeMember(m, new Date())}</span>
      </span>
      <span className="family-list__actions">
        <button
          type="button"
          className="btn btn-icon"
          aria-label={t.moveUp(m.nickname)}
          disabled={first}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label={t.moveDown(m.nickname)}
          disabled={last}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          ref={editRef}
          type="button"
          className="btn"
          aria-label={t.editMember(m.nickname)}
          onClick={onEdit}
        >
          {t.edit}
        </button>
        <button
          type="button"
          className="btn"
          aria-label={t.removeMember(m.nickname)}
          onClick={() => void onRemove()}
        >
          {t.removeSaved}
        </button>
      </span>
    </>
  );
}

interface Fields {
  nickname: string;
  kind: MemberKind;
  month: string;
  year: string;
}

const toFields = (m?: MemberInput): Fields => ({
  nickname: m?.nickname ?? '',
  kind: m?.kind ?? 'adult',
  month: m?.birth ? String(m.birth.month) : '',
  year: m?.birth ? String(m.birth.year) : '',
});

/** A child's birth month and year, if they're real and not in the future. */
function parseBirth(f: Fields, today: Date): MemberInput['birth'] | undefined {
  const month = Number(f.month);
  const year = Number(f.year);
  const thisYear = today.getFullYear();
  const valid =
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(year) &&
    year >= 1900 &&
    (year < thisYear || (year === thisYear && month <= today.getMonth() + 1));
  return valid ? { year, month } : undefined;
}

/** Checks the member form, returning which fields are wrong and, if none, the member. */
function validateMember(f: Fields, today: Date) {
  const nickname = f.nickname.trim();
  const length = [...nickname].length;
  const birth = f.kind === 'child' ? parseBirth(f, today) : null;
  const errors = { nickname: length < 1 || length > NICKNAME_MAX, birth: birth === undefined };
  const member: MemberInput | null =
    errors.nickname || birth === undefined ? null : { nickname, kind: f.kind, birth };
  return { errors, member };
}

function MemberForm({
  label,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial?: MemberInput;
  submitLabel: string;
  onSubmit: (member: MemberInput) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const id = useId();
  const [fields, setFields] = useState(() => toFields(initial));
  const [errors, setErrors] = useState({ nickname: false, birth: false });
  const [status, setStatus] = useState<'idle' | 'saving' | 'failed'>('idle');
  const set = (patch: Partial<Fields>) => setFields((f) => ({ ...f, ...patch }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const result = validateMember(fields, new Date());
    setErrors(result.errors);
    if (!result.member) return;
    setStatus('saving');
    const ok = await onSubmit(result.member);
    setStatus(ok ? 'idle' : 'failed');
    if (ok && !initial) setFields(toFields());
  };

  return (
    <form
      aria-label={label}
      className="settings__form member-form"
      noValidate
      onSubmit={(e) => void submit(e)}
    >
      <div className="field">
        <label htmlFor={`${id}-nick`}>{t.nickname}</label>
        <input
          id={`${id}-nick`}
          type="text"
          autoComplete="off"
          value={fields.nickname}
          onChange={(e) => set({ nickname: e.target.value })}
          aria-invalid={errors.nickname}
          aria-describedby={errors.nickname ? `${id}-nick-err` : undefined}
        />
        {errors.nickname && (
          <p id={`${id}-nick-err`} className="error-text">
            {t.nicknameInvalid}
          </p>
        )}
      </div>
      <fieldset>
        <legend>{t.memberType}</legend>
        <div className="chips">
          {KINDS.map(([kind, text]) => (
            <label key={kind} className="chip">
              <input
                type="radio"
                name={`${id}-kind`}
                value={kind}
                checked={fields.kind === kind}
                onChange={() => set({ kind })}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {fields.kind === 'child' && (
        <BirthFields id={id} fields={fields} invalid={errors.birth} onChange={set} />
      )}
      <p className="row">
        <button type="submit" className="btn btn-primary" disabled={status === 'saving'}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            {t.cancel}
          </button>
        )}
      </p>
      {status === 'failed' && (
        <p role="alert" className="error-text">
          {t.memberSaveFailed}
        </p>
      )}
    </form>
  );
}

function BirthFields({
  id,
  fields,
  invalid,
  onChange,
}: {
  id: string;
  fields: Fields;
  invalid: boolean;
  onChange: (patch: Partial<Fields>) => void;
}) {
  const msg = `${id}-birth-msg`;
  return (
    <div className="member-form__birth">
      <div className="field">
        <label htmlFor={`${id}-month`}>{t.birthMonth}</label>
        <select
          id={`${id}-month`}
          value={fields.month}
          onChange={(e) => onChange({ month: e.target.value })}
          aria-invalid={invalid}
          aria-describedby={msg}
        >
          <option value="">{t.monthPlaceholder}</option>
          {MONTHS.map((name, i) => (
            <option key={name} value={String(i + 1)}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-year`}>{t.birthYear}</label>
        <input
          id={`${id}-year`}
          type="number"
          inputMode="numeric"
          min={1900}
          max={new Date().getFullYear()}
          value={fields.year}
          onChange={(e) => onChange({ year: e.target.value })}
          aria-invalid={invalid}
          aria-describedby={msg}
        />
      </div>
      <p id={msg} className={invalid ? 'error-text' : 'hint'}>
        {invalid ? t.birthInvalid : t.birthHint}
      </p>
    </div>
  );
}
