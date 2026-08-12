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
 * ADD OWNER. Who hears about a new lead here.
 *
 * Marrs: "let's just try and consolidate that whole idea into one button in the top right,
 * which says 'Add owner'. When you click that, it opens up a little modal."
 *
 * It was a full-width bar carrying a sentence nobody needs to read twice. Now it is one
 * button, and the state it holds (a count) is on the button itself, so the page does not
 * spend a row on a setting that is changed about twice a year.
 */
export function AddOwner({
  owner,
  recipients,
}: {
  owner: string;
  recipients: string[];
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState(recipients.join(', '));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = saved ?? recipients;

  // Escape closes it, because a modal you cannot dismiss with the keyboard is a trap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

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

  return (
    <>
      <button type="button" className={c.ownerBtn} onClick={() => setOpen(true)}>
        Add owner{current.length > 0 ? ` · ${current.length}` : ''}
      </button>

      {open ? (
        <div
          className={c.modalScrim}
          role="dialog"
          aria-modal="true"
          aria-label="Add owner"
          // Clicking the backdrop closes; clicking the panel must not, hence the guard.
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className={c.modal}>
            <h2 className={c.modalTitle}>Add owner</h2>
            <p className={c.modalText}>
              Enter your email if you want to know when someone is contacted.
            </p>
            <input
              className={c.textInput}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="you@polynize.io"
              aria-label="Email addresses to notify"
              autoFocus
            />
            <p className={c.modalHint}>
              Separate several with commas. Each person gets their own email. Leave it empty to
              turn it off.
            </p>
            {err ? <p className={c.formError}>{err}</p> : null}
            <div className={c.modalActions}>
              <button type="button" className={c.addBtn} onClick={() => void save()} disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className={c.cancel} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * FIREFLIES REVIEW. Pull recent meetings, tick who is real, add them.
 *
 * Nothing is written until a box is ticked and Add is pressed. His Fireflies holds personal
 * meetings alongside sales calls and no filter can reliably tell them apart, so the meeting
 * TITLE is shown against every candidate: that is the thing a person reads to know whether a
 * contact belongs in a CRM at all.
 */
export function FirefliesReview({ owner }: { owner: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'saving'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<
    { email: string; meetingTitle: string; meetingDate?: string; transcriptUrl: string }[]
  >([]);
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const scan = async () => {
    setState('loading');
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/console/leads/${owner}/fireflies`);
      const b = (await res.json().catch(() => null)) as {
        candidates?: typeof candidates;
        scanned?: number;
        error?: string;
      } | null;
      if (!res.ok) {
        setErr(b?.error ?? 'Could not reach Fireflies.');
        setState('idle');
        return;
      }
      setCandidates(b?.candidates ?? []);
      setTicked(new Set());
      if ((b?.candidates ?? []).length === 0) {
        setMsg(
          `Looked at ${b?.scanned ?? 0} recent meetings. Nobody new outside Polynize, so there is nothing to add.`
        );
      }
      setState('ready');
    } catch {
      setErr('Network error.');
      setState('idle');
    }
  };

  const add = async () => {
    if (ticked.size === 0) return;
    setState('saving');
    setErr(null);
    try {
      const res = await fetch(`/console/leads/${owner}/fireflies`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accept: [...ticked] }),
      });
      const b = (await res.json().catch(() => null)) as
        | { added?: number; failed?: string[]; error?: string }
        | null;
      if (!res.ok) {
        setErr(b?.error ?? 'Could not add those.');
        setState('ready');
        return;
      }
      setMsg(
        `${b?.added ?? 0} added${b?.failed?.length ? `, ${b.failed.length} could not be saved` : ''}.`
      );
      setCandidates((prev) => prev.filter((c) => !ticked.has(c.email)));
      setTicked(new Set());
      setState('ready');
      router.refresh();
    } catch {
      setErr('Network error.');
      setState('ready');
    }
  };

  const dismiss = async (email: string) => {
    // Optimistic: the row goes at once. Waiting on a round trip to remove something you have
    // decided is junk makes the list feel broken.
    setCandidates((prev) => prev.filter((x) => x.email !== email));
    setTicked((prev) => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
    try {
      const res = await fetch(`/console/leads/${owner}/fireflies`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ignore: [email] }),
      });
      if (!res.ok) setErr('That one will come back on the next scan: the dismissal did not save.');
    } catch {
      setErr('That one will come back on the next scan: the dismissal did not save.');
    }
  };

  const toggle = (email: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  return (
    <div className={c.notifyBar}>
      <button
        type="button"
        className={c.notifyBtn}
        onClick={() => void scan()}
        disabled={state === 'loading' || state === 'saving'}
      >
        {state === 'loading' ? 'Looking…' : 'Pull contacts from my meetings'}
      </button>
      <span className={c.notifyText}>
        {err ? <span className={c.ffError}>{err}</span> : (msg ?? 'Reads your recent Fireflies meetings and proposes anyone outside Polynize. Nothing is added until you tick it.')}
      </span>

      {candidates.length > 0 ? (
        <>
          <ul className={c.ffList}>
            {candidates.map((cand) => (
              <li key={cand.email} className={c.ffItem}>
                <label className={c.ffLabel}>
                  <input
                    type="checkbox"
                    checked={ticked.has(cand.email)}
                    onChange={() => toggle(cand.email)}
                  />
                  <span className={c.ffEmail}>{cand.email}</span>
                  <span className={c.ffMeeting}>
                    {cand.meetingTitle}
                    {cand.meetingDate ? ` · ${cand.meetingDate.slice(0, 10)}` : ''}
                  </span>
                </label>
                <span className={c.ffRowActions}>
                  <a
                    className={c.transcript}
                    href={cand.transcriptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    transcript ↗
                  </a>
                  {/* Not a delete: it removes them from the PROPOSALS and remembers, so the
                      same person stops being offered every scan. */}
                  <button
                    type="button"
                    className={c.ffDismiss}
                    onClick={() => void dismiss(cand.email)}
                    title="Not a lead. Stop proposing this person."
                  >
                    not a lead
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className={c.ffActions}>
            <button
              type="button"
              className={c.addBtn}
              onClick={() => void add()}
              disabled={ticked.size === 0 || state === 'saving'}
            >
              {state === 'saving'
                ? 'Adding…'
                : `Add ${ticked.size || ''}${ticked.size === 1 ? ' contact' : ' contacts'}`.trim()}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
