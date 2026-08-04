'use client';

/**
 * Manage a stream's Content Pillar Templates (D25): list, create, edit, retire,
 * delete, and copy in from the built-in library. One editor panel at a time;
 * saves PUT the full template to ./save (slug derived server-side for new ones).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ContentTemplate, TemplateStatus } from '@/lib/marketing/template-store';
import type { LibraryTemplate } from '@/lib/marketing/template-library';
import { FORMATS, ICP_ARCHETYPES, formatById, defaultLengthFor } from '@/lib/marketing/output-plan';
import { channelLabel } from '@/lib/marketing/channels';
import s from './templates.module.css';

type Draft = {
  template_id?: string; // absent = new
  name: string;
  description: string;
  status: TemplateStatus;
  format: string;
  platforms: string[];
  icp: string;
  length: string;
  hook_variants: string;
  hook_recipe: string;
  recipe: string;
  cta_recipe: string;
  example: string;
};

const BLANK: Draft = {
  name: '',
  description: '',
  status: 'developing',
  format: 'linkedin_text',
  platforms: ['linkedin'],
  icp: '',
  length: defaultLengthFor('linkedin_text'),
  hook_variants: '1',
  hook_recipe: '',
  recipe: '',
  cta_recipe: '',
  example: '',
};

function toDraft(t: ContentTemplate): Draft {
  return {
    template_id: t.template_id,
    name: t.name,
    description: t.description,
    status: t.status,
    format: t.format,
    platforms: t.platforms,
    icp: t.icp ?? '',
    // Prefill length from the format default for older templates that predate it.
    length: t.length ?? defaultLengthFor(t.format),
    hook_variants: String(t.hook_variants ?? 1),
    hook_recipe: t.hook_recipe ?? '',
    recipe: t.recipe ?? '',
    cta_recipe: t.cta_recipe ?? '',
    example: t.example ?? '',
  };
}

export function TemplatesManager({
  stream,
  initial,
  library,
}: {
  stream: string;
  initial: ContentTemplate[];
  library: LibraryTemplate[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ContentTemplate[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamIds = new Set(templates.map((t) => t.template_id));
  const copyable = library.filter((t) => !streamIds.has(t.template_id));

  const baseUrl = () => window.location.pathname.replace(/\/+$/, '');

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const setFormat = (formatId: string) => {
    const channels = formatById(formatId)?.channels ?? [];
    setDraft((d) => {
      if (!d) return d;
      // Refresh the suggested length to the new format's default, unless the user
      // has typed a custom one (i.e. it differs from the old format's default).
      const length =
        !d.length.trim() || d.length === defaultLengthFor(d.format)
          ? defaultLengthFor(formatId)
          : d.length;
      return { ...d, format: formatId, platforms: channels.slice(), length };
    });
  };

  const togglePlatform = (c: string) =>
    setDraft((d) => {
      if (!d) return d;
      const platforms = d.platforms.includes(c)
        ? d.platforms.filter((x) => x !== c)
        : [...d.platforms, c];
      return { ...d, platforms };
    });

  const save = async () => {
    if (!draft || busy) return;
    if (!draft.name.trim()) {
      setError('Give the template a name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(baseUrl() + '/save', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const b = (await res.json().catch(() => null)) as
        | { template?: ContentTemplate; error?: string }
        | null;
      if (!res.ok || !b?.template) {
        setError(b?.error ?? 'Could not save the template.');
        return;
      }
      const saved = b.template;
      setTemplates((ts) => {
        const rest = ts.filter((t) => t.template_id !== saved.template_id);
        return [...rest, saved].sort((a, c) => a.name.localeCompare(c.name));
      });
      setDraft(null);
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: ContentTemplate) => {
    if (busy) return;
    if (!window.confirm(`Delete the "${t.name}" content template? Pieces already made from it keep working.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(baseUrl() + '/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ template_id: t.template_id }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(b?.error ?? 'Could not delete.');
        return;
      }
      setTemplates((ts) => ts.filter((x) => x.template_id !== t.template_id));
      router.refresh();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyIn = (t: LibraryTemplate) =>
    setDraft({
      // Keep the library id so the stream copy shadows the library original in
      // both dedupe filters (instead of re-slugging to a duplicate).
      template_id: t.template_id,
      name: t.name,
      description: t.description,
      status: t.status,
      format: t.format,
      platforms: t.platforms.slice(),
      icp: t.icp ?? '',
      length: t.length ?? defaultLengthFor(t.format),
      hook_variants: String(t.hook_variants ?? 1),
      hook_recipe: t.hook_recipe ?? '',
      recipe: t.recipe ?? '',
      cta_recipe: t.cta_recipe ?? '',
      example: t.example ?? '',
    });

  const channels = draft ? (formatById(draft.format)?.channels ?? []) : [];

  return (
    <div className={s.manager}>
      {error ? <p className={s.error}>{error}</p> : null}

      <section className={s.panel}>
        <div className={s.groupHead}>
          <h2 className={s.groupTitle}>Your content templates</h2>
          <button type="button" className={s.newBtn} onClick={() => setDraft({ ...BLANK })}>
            + New template
          </button>
        </div>
        {templates.length === 0 ? (
          <p className={s.emptyNote}>None yet. Create one, or copy one in from the library below.</p>
        ) : (
          <div className={s.list}>
            {templates.map((t) => (
              <div key={t.template_id} className={s.row}>
                <span className={s.rowName}>{t.name}</span>
                <span className={s.rowMeta}>
                  {formatById(t.format)?.label ?? t.format} → {t.platforms.map(channelLabel).join(', ')}
                </span>
                <span className={`${s.status} ${s[`st_${t.status}`] ?? ''}`}>{t.status}</span>
                <button type="button" className={s.rowBtn} onClick={() => setDraft(toDraft(t))}>
                  Edit
                </button>
                <button type="button" className={s.rowBtnDanger} onClick={() => remove(t)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {draft ? (
        <section className={s.editor}>
          <h2 className={s.groupTitle}>{draft.template_id ? `Edit: ${draft.name}` : 'New content template'}</h2>
          <div className={s.fields}>
            <label className={s.field}>
              Name
              <input className={s.input} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Marrs Attacks" />
            </label>
            <label className={s.field}>
              Status
              <select className={s.input} value={draft.status} onChange={(e) => set('status', e.target.value as TemplateStatus)}>
                <option value="developing">developing</option>
                <option value="active">active</option>
                <option value="retired">retired</option>
              </select>
            </label>
            <label className={s.field}>
              Format
              <select className={s.input} value={draft.format} onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                    {f.module === 'coming' ? ' (module coming)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className={s.field}>
              Audience (ICP)
              <select className={s.input} value={draft.icp} onChange={(e) => set('icp', e.target.value)}>
                <option value="">No specific persona</option>
                {ICP_ARCHETYPES.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {channels.length > 0 ? (
            <div className={s.chipsRow}>
              <span className={s.chipsLabel}>Platforms</span>
              {channels.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${s.chip} ${draft.platforms.includes(c) ? s.chipOn : ''}`}
                  onClick={() => togglePlatform(c)}
                >
                  {channelLabel(c)}
                </button>
              ))}
            </div>
          ) : null}

          <label className={s.fieldWide}>
            Description (shown in the picker)
            <input className={s.input} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="What this template makes, in a sentence." />
          </label>
          <p className={s.recipeIntro}>
            The recipe below is what the agent follows. Write each part as a direct
            instruction, specific to this piece type. The concept supplies the facts
            and the brand voice supplies the sound, so you only need to say what is
            distinctive about how THIS template is built.
          </p>
          <label className={s.fieldWide}>
            Length (a limit for the draft; prefilled by format, editable)
            <input
              className={s.input}
              value={draft.length}
              onChange={(e) => set('length', e.target.value)}
              placeholder="e.g. 150 to 250 words, or 45 to 90 seconds"
            />
          </label>
          <label className={s.field}>
            How many hooks? (record them all in one session, cut into that many posts)
            <select
              className={s.input}
              value={draft.hook_variants}
              onChange={(e) => set('hook_variants', e.target.value)}
            >
              <option value="1">1 hook</option>
              <option value="2">2 hooks, one body</option>
              <option value="3">3 hooks, one body</option>
              <option value="4">4 hooks, one body</option>
            </select>
          </label>
          <label className={s.fieldWide}>
            Hook recipe (how to OPEN, as an ordered formula the agent follows)
            <textarea
              className={s.recipe}
              value={draft.hook_recipe}
              onChange={(e) => set('hook_recipe', e.target.value)}
              placeholder={
                'e.g.\nLine 1: state the belief the reader already holds, as if you agree.\nLine 2: flip it in under 12 words.'
              }
            />
          </label>
          <label className={s.fieldWide}>
            Structure recipe (the BODY: its beats, in order)
            <textarea
              className={s.recipe}
              value={draft.recipe}
              onChange={(e) => set('recipe', e.target.value)}
              placeholder="e.g. 2 to 3 short paragraphs grounding the flip in the concept's proof. One idea per line break."
            />
          </label>
          <label className={s.fieldWide}>
            CTA recipe (how to CLOSE; write &ldquo;no CTA&rdquo; to end on the point)
            <textarea
              className={s.recipe}
              value={draft.cta_recipe}
              onChange={(e) => set('cta_recipe', e.target.value)}
              placeholder="e.g. One line on what the reader can now do. A challenge, not a summary."
            />
          </label>
          <label className={s.fieldWide}>
            Example (link or description of a piece made this way)
            <input className={s.input} value={draft.example} onChange={(e) => set('example', e.target.value)} placeholder="Optional" />
          </label>

          <div className={s.editorActions}>
            <button type="button" className={s.saveBtn} onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save template'}
            </button>
            <button type="button" className={s.cancelBtn} onClick={() => setDraft(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {copyable.length > 0 ? (
        <section className={s.panel}>
          <h2 className={s.groupTitle}>Built-in template library</h2>
          <div className={s.list}>
            {copyable.map((t) => (
              <div key={t.template_id} className={s.row}>
                <span className={s.rowName}>{t.name}</span>
                <span className={s.rowMeta}>
                  {formatById(t.format)?.label ?? t.format} → {t.platforms.map(channelLabel).join(', ')}
                </span>
                <span className={`${s.status} ${s[`st_${t.status}`] ?? ''}`}>{t.status}</span>
                <button type="button" className={s.rowBtn} onClick={() => copyIn(t)}>
                  Copy to this stream
                </button>
              </div>
            ))}
          </div>
          <p className={s.libNote}>
            Built-in templates are usable directly when you create content; copy one here to
            refine its recipe for this stream.
          </p>
        </section>
      ) : null}
    </div>
  );
}
