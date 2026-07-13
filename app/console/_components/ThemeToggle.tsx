'use client';

/**
 * Light/dark toggle for the console (item 2). Adds/removes `theme-light` on
 * <body> (the selector tactile.css uses) and persists to localStorage. The
 * pre-paint script in the root layout applies the saved choice before first
 * paint, so this component just reflects and flips it. Dark is the default.
 */

import { useEffect, useState } from 'react';
import s from './sign-in-gate.module.css';

export function ThemeToggle() {
  const [light, setLight] = useState(false);

  // Apply the saved theme on mount and REMOVE it on unmount, so `theme-light`
  // is scoped to the console: it turns on when the console shell mounts (covers
  // client-side nav in, where the pre-paint script does not run) and turns off
  // when you navigate out to the dark-only public site. The pre-paint script
  // (root layout) covers hard console loads.
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem('pam-theme') === 'light';
    } catch {
      /* storage disabled */
    }
    document.body.classList.toggle('theme-light', saved);
    setLight(saved);
    return () => {
      document.body.classList.remove('theme-light');
    };
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.body.classList.toggle('theme-light', next);
    try {
      localStorage.setItem('pam-theme', next ? 'light' : 'dark');
    } catch {
      /* private mode / storage disabled: the class still applies for this session */
    }
  };

  return (
    <button
      type="button"
      className={s.themeToggle}
      onClick={toggle}
      aria-pressed={light}
      title={light ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      {light ? (
        // Moon (switch to dark)
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      ) : (
        // Sun (switch to light)
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      )}
      <span>{light ? 'Dark' : 'Light'}</span>
    </button>
  );
}
