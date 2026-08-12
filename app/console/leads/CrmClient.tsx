'use client';

/**
 * The interactive parts of one person's CRM: adding a contact, and editing a row.
 *
 * Everything saves in place. There is no Save-all button and no form submit, because a
 * CRM gets touched a dozen times in a sitting and a page reload between each touch is
 * how a CRM stops being used.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
// From model, NOT contact-store: the store imports the Supabase service-role client and
// this is a client component.
import { CRM_STAGES, type CrmContact, type CrmStage } from '@/lib/crm/model';
import c from './crm.module.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

/** Shared: PATCH one field set and report how it went. */
async function patch(body: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch('/console/leads/contact', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const b = (await res.json().catch(() => null)) as { error?: string } | null;
    return b?.error ?? 'Could not save that.';
  } catch {
    return 'Network error.';
  }
}

export function AddContact({ owner }: { owner: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    email: '',
    name: '',
    business: '',
    role_title: '',
    phone: '',
    next_action: '',
    next_action_at: '',
    notes: '',
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async () => {
    if (busy) return;
    if (!f.email.trim()) {
      setErr('An email address is the one thing a contact needs.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/console/leads/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner, ...f }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(b?.error ?? 'Could not save that contact.');
        return;
      }
      setF({
        email: '',
        name: '',
        business: '',
        role_title: '',
        phone: '',
        next_action: '',
        next_action_at: '',
        notes: '',
      });
      setOpen(false);
      router.refresh();
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className={c.addWrap}>
        <button type="button" className={c.addBtn} onClick={() => setOpen(true)}>
          Add a contact
        </button>
      </div>
    );
  }

  return (
    <div className={c.addWrap}>
      <div className={c.addForm}>
        <input
          className={c.textInput}
          placeholder="Email (required)"
          value={f.email}
          onChange={set('email')}
          type="email"
          autoFocus
        />
        <input className={c.textInput} placeholder="Name" value={f.name} onChange={set('name')} />
        <input
          className={c.textInput}
          placeholder="Company"
          value={f.business}
          onChange={set('business')}
        />
        <input
          className={c.textInput}
          placeholder="Role"
          value={f.role_title}
          onChange={set('role_title')}
        />
        <input className={c.textInput} placeholder="Phone" value={f.phone} onChange={set('phone')} />
        <input
          className={c.textInput}
          placeholder="Next action"
          value={f.next_action}
          onChange={set('next_action')}
        />
        <input
          className={`${c.dateInput} ${c.wide}`}
          type="date"
          value={f.next_action_at}
          onChange={set('next_action_at')}
          aria-label="When the next action is due"
        />
        <textarea
          className={`${c.notes} ${c.wide}`}
          placeholder="Notes"
          value={f.notes}
          onChange={set('notes')}
        />
        {err ? <p className={c.formError}>{err}</p> : null}
        <div className={c.addRow}>
          <button type="button" className={c.addBtn} onClick={() => void submit()} disabled={busy}>
            {busy ? 'Saving…' : 'Save contact'}
          </button>
          <button type="button" className={c.cancel} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One contact. Stage and dates save the moment they change; text saves on a debounce so
 * typing a note is not one request per keystroke.
 */
export function ContactRow({ contact }: { contact: CrmContact }) {
  const router = useRouter();
  const [stage, setStage] = useState<CrmStage>(contact.stage);
  const [action, setAction] = useState(contact.next_action ?? '');
  const [when, setWhen] = useState(contact.next_action_at?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(contact.notes ?? '');
  const [state, setState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const body = pending.current;
    pending.current = null;
    if (!body) return;
    setState('saving');
    const err = await patch({ id: contact.id, ...body });
    setState(err ? 'failed' : 'saved');
    if (err) console.error('[crm.row]', err);
  }, [contact.id]);

  // Anything typed and not yet sent goes on unmount, so navigating away mid-note does
  // not silently throw it away.
  useEffect(() => () => void flush(), [flush]);

  const queue = (body: Record<string, unknown>) => {
    pending.current = { ...(pending.current ?? {}), ...body };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  const now = async (body: Record<string, unknown>) => {
    setState('saving');
    const err = await patch({ id: contact.id, ...body });
    setState(err ? 'failed' : 'saved');
    // The list is sorted by what is due, so a stage or date change can reorder it.
    if (!err) router.refresh();
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${contact.name || contact.email}? This cannot be undone.`)) return;
    setState('saving');
    try {
      const res = await fetch('/console/leads/contact', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: contact.id }),
      });
      if (!res.ok) {
        setState('failed');
        return;
      }
      router.refresh();
    } catch {
      setState('failed');
    }
  };

  const due = Boolean(when) && new Date(`${when}T12:00:00.000Z`).getTime() <= Date.now();
  const inbound = contact.source === 'blueprint';

  return (
    <article className={c.row}>
      <div className={c.rowTop}>
        <h3 className={c.name}>{contact.name || contact.email}</h3>
        {contact.business ? (
          <span className={c.at}>
            {contact.role_title ? `${contact.role_title}, ` : ''}
            {contact.business}
          </span>
        ) : null}
        <a className={c.email} href={`mailto:${contact.email}`}>
          {contact.email}
        </a>
        <span className={`${c.source} ${inbound ? c.sourceInbound : ''}`}>
          {inbound ? 'from the website' : contact.source}
        </span>
        {contact.fireflies_url ? (
          <a
            className={c.transcript}
            href={contact.fireflies_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            transcript ↗
          </a>
        ) : null}
      </div>

      <div className={c.rowMid}>
        <select
          className={c.stageSelect}
          value={stage}
          onChange={(e) => {
            const next = e.target.value as CrmStage;
            setStage(next);
            void now({ stage: next });
          }}
          aria-label="Stage"
        >
          {CRM_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          className={c.textInput}
          placeholder="Next action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            queue({ next_action: e.target.value });
          }}
          onBlur={() => void flush()}
        />
        <input
          className={c.dateInput}
          type="date"
          value={when}
          onChange={(e) => {
            setWhen(e.target.value);
            void now({ next_action_at: e.target.value });
          }}
          aria-label="Due"
        />
        {due ? <span className={c.dueFlag}>due</span> : null}
      </div>

      <textarea
        className={c.notes}
        placeholder="Notes"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          queue({ notes: e.target.value });
        }}
        onBlur={() => void flush()}
      />

      <div className={c.rowActions}>
        <span
          className={`${c.saveState} ${state === 'saved' ? c.saved : ''} ${
            state === 'failed' ? c.failed : ''
          }`}
        >
          {state === 'saving'
            ? 'saving…'
            : state === 'saved'
              ? 'saved'
              : state === 'failed'
                ? 'not saved'
                : ''}
        </span>
        <button type="button" className={c.del} onClick={() => void remove()}>
          delete
        </button>
      </div>
    </article>
  );
}

/**
 * WHO GETS TOLD when a lead lands in this CRM.
 *
 * Free text rather than a repeating field, because it is edited about twice a year and
 * pasting two addresses is the whole job. The store parses commas, newlines and
 * semicolons, de-duplicates, and drops anything that is not an address.
 */
export function NotifyEditor({
  owner,
  recipients,
  ownerLabel,
}: {
  owner: string;
  recipients: string[];
  ownerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(recipients.join(', '));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = saved ?? recipients;

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/console/leads/notify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ owner, recipients: raw }),
      });
      const b = (await res.json().catch(() => null)) as
        | { recipients?: string[]; error?: string }
        | null;
      if (!res.ok) {
        setErr(b?.error ?? 'Could not save that.');
        return;
      }
      setSaved(b?.recipients ?? []);
      setOpen(false);
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className={c.notifyBar}>
        <span className={c.notifyText}>
          {current.length === 0 ? (
            <>Nobody is told when a lead lands in {ownerLabel}.</>
          ) : (
            <>Pinged on a new lead: {current.join(', ')}</>
          )}
        </span>
        <button type="button" className={c.notifyBtn} onClick={() => setOpen(true)}>
          {current.length === 0 ? 'Add someone' : 'Change'}
        </button>
      </div>
    );
  }

  return (
    <div className={c.notifyBar}>
      <div className={c.notifyEdit}>
        <input
          className={c.textInput}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="name@example.com, someone@example.com"
          aria-label={`Who to notify about new ${ownerLabel} leads`}
          autoFocus
        />
        <button type="button" className={c.addBtn} onClick={() => void save()} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={c.cancel} onClick={() => setOpen(false)}>
          Cancel
        </button>
        {err ? <p className={c.formError}>{err}</p> : null}
        <p className={c.notifyHint}>
          Separate addresses with commas. Each person gets their own email, so nobody sees
          the rest of the list. Leave it empty to turn the ping off.
        </p>
      </div>
    </div>
  );
}

/**
 * Bring the old engagement roster in as contacts. Polynize only.
 *
 * Reports what it did rather than just succeeding, because "move my old leads in" is a
 * one-way-feeling action and the useful answer is which ones needed a hand.
 */
export function ImportEngagements() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setResult(null);
    setReasons([]);
    try {
      const res = await fetch('/console/leads/import-engagements', { method: 'POST' });
      const b = (await res.json().catch(() => null)) as {
        found?: number;
        imported?: number;
        alreadyThere?: number;
        skipped?: number;
        reasons?: string[];
        error?: string;
      } | null;
      if (!res.ok) {
        setResult(b?.error ?? 'Could not run the import.');
        return;
      }
      const parts = [`${b?.imported ?? 0} brought in`];
      if (b?.alreadyThere) parts.push(`${b.alreadyThere} already here`);
      if (b?.skipped) parts.push(`${b.skipped} needs a hand`);
      setResult(
        (b?.found ?? 0) === 0
          ? 'Nothing on the old roster is flagged as a lead, so there was nothing to bring in.'
          : parts.join(' · ')
      );
      setReasons(b?.reasons ?? []);
      router.refresh();
    } catch {
      setResult('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={c.importBar}>
      <button type="button" className={c.notifyBtn} onClick={() => void run()} disabled={busy}>
        {busy ? 'Importing…' : 'Import the old lead roster'}
      </button>
      <span className={c.notifyText}>
        {result ?? 'Brings the engagement records the old Leads page showed in as contacts. Safe to run twice.'}
      </span>
      {reasons.length > 0 ? (
        <ul className={c.importReasons}>
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
