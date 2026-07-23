/**
 * The Polynize brand palette (from design_handoff/designs/shared/tokens.css), the
 * only colours offered for text overlays so output stays on-brand. Shared by the
 * overlay UI (dropdowns) and the overlay route (server-side validation).
 */

export type BrandColor = { id: string; name: string; hex: string };

export const BRAND_COLORS: BrandColor[] = [
  { id: 'white', name: 'White', hex: '#ffffff' },
  { id: 'cream', name: 'Cream', hex: '#f4ece4' },
  { id: 'mint', name: 'Mint', hex: '#69fccb' },
  { id: 'coral', name: 'Coral', hex: '#ff7a6b' },
  { id: 'amber', name: 'Amber', hex: '#f0b86b' },
  { id: 'gold', name: 'Gold', hex: '#f0e1b6' },
  { id: 'ink', name: 'Ink (dark)', hex: '#0a0a0f' },
];

export const BRAND_HEXES = new Set(BRAND_COLORS.map((c) => c.hex));
