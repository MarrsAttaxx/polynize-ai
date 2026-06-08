/**
 * Registry of content shoot-sheet templates, keyed by URL slug "<show>/<episode>".
 *
 * Each value is a complete, standalone HTML document (the provided single-file
 * sheet, with persistence baked in). Adding a new episode is: author its HTML
 * template, register it here, and it gets its own content_shoot_sheets row on
 * first save. No rebuild.
 */

import { ep00Html } from './ep00';

export const SHEETS: Record<string, string> = {
  'pam/ep00': ep00Html,
};

export function getSheetHtml(show: string, episode: string): string | null {
  return SHEETS[`${show}/${episode}`] ?? null;
}

export function isKnownSheet(show: string, episode: string): boolean {
  return `${show}/${episode}` in SHEETS;
}
