/**
 * The publish channels (platforms) a piece can go out on. One source of truth for
 * labels, so the Output-plan chips, the calendar, and the per-platform copy step
 * never drift. `id` is what lands in calendar_entries.channel (migration 0009).
 */

export type ChannelId =
  | 'linkedin'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'substack'
  | 'newsletter';

export const CHANNELS: { id: ChannelId; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'x', label: 'X' },
  { id: 'substack', label: 'Substack' },
  { id: 'newsletter', label: 'Newsletter' },
];

/** Human label for a channel id, falling back to a title-cased raw id. */
export function channelLabel(id: string): string {
  return (
    CHANNELS.find((c) => c.id === id)?.label ??
    id.charAt(0).toUpperCase() + id.slice(1)
  );
}

/**
 * Map our channel id to Metricool's `network` name (see docs/pam-console/metricool-api.md).
 * Returns null for channels Metricool does not publish (Substack, Newsletter), which
 * are handled outside the Metricool call. Note X is still `twitter` in Metricool.
 */
export function metricoolNetwork(id: string): string | null {
  switch (id) {
    case 'linkedin':
      return 'linkedin';
    case 'instagram':
      return 'instagram';
    case 'tiktok':
      return 'tiktok';
    case 'youtube':
      return 'youtube';
    case 'x':
      return 'twitter';
    case 'substack':
    case 'newsletter':
      return null;
    default:
      return null;
  }
}
