'use client';

/**
 * ONE SCREEN, FOUR TABS (D85).
 *
 * Marrs: "the sections look all the same... instead of showing four or five separate sections, we
 * have just one tab that says Media Library across the top. There are four big buttons across the
 * top... When you click one, it doesn't open a separate tab, instead it moves to the next tab
 * across. This keeps it neat because at the moment everything in a stack is a bit visually
 * confusing."
 *
 * He is right, and the reason the stack reads as confusing is worth naming: three of the four
 * sections are TOOLS you apply to an image and one is the LIBRARY you look at, and stacked in one
 * column they all look like the same kind of thing. Tabs say which is which by putting the library
 * first and the three tools beside it.
 *
 * IT IS PURELY LAYOUT. Each panel already owned its own picker and its own state, so nothing is
 * rewired: the four children are built on the server exactly as before and handed here as elements.
 *
 * EVERY PANEL STAYS MOUNTED, hidden rather than unmounted, which is the whole reason this holds
 * state worth keeping: a half-typed generation prompt survives a look at the library and back.
 * Unmounting would throw it away, and losing a prompt to a stray click is exactly the kind of small
 * betrayal that makes a tool feel unreliable.
 */

import { useState, type ReactNode } from 'react';
import s from './media.module.css';

/** His names, in his order. The library is first because it is the thing you came to look at. */
const TABS = [
  { id: 'library', label: 'Media Library' },
  { id: 'generate', label: 'Generate Images with AI' },
  { id: 'edit', label: 'Edit an Image' },
  { id: 'overlay', label: 'Add Text to an Image' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function MediaTabs({
  library,
  generate,
  edit,
  overlay,
}: {
  library: ReactNode;
  generate: ReactNode;
  edit: ReactNode;
  overlay: ReactNode;
}) {
  const [active, setActive] = useState<TabId>('library');
  const panels: Record<TabId, ReactNode> = { library, generate, edit, overlay };

  return (
    <div className={s.tabsWrap}>
      <div className={s.tabs} role="tablist" aria-label="Media">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            className={`${s.tab} ${active === t.id ? s.tabOn : ''}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {TABS.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          /* `hidden` rather than unmounted: see the note at the top about keeping a typed prompt. */
          hidden={active !== t.id}
          className={s.panel}
        >
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
