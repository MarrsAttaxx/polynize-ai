'use client';

/**
 * Opens the browser print dialog (Print / Save as PDF). The print stylesheet
 * in sow.module.css strips all Console chrome and this button itself, renders
 * the document paginated, and prints unfilled HUMAN fields as blank underscore
 * lines instead of NEEDS INPUT badges.
 */

import s from '../sow.module.css';

export function SowPrintButton() {
  return (
    <button
      type="button"
      className={s.printBtn}
      onClick={() => window.print()}
    >
      Print / Save as PDF
    </button>
  );
}
