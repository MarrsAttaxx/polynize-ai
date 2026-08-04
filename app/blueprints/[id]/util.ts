import type { Allocation } from '@/lib/types';

export const ALLOC_COLOR: Record<Allocation, string> = {
  human: 'var(--coral)',
  hybrid: 'var(--amber)',
  agent: 'var(--mint)',
};

const RGB: Record<Allocation, string> = {
  human: '255, 122, 107',
  hybrid: '240, 184, 107',
  agent: '105, 252, 203',
};

export function rgba(alloc: Allocation, alpha: number): string {
  return `rgba(${RGB[alloc]}, ${alpha})`;
}

export function firstNameOf(name: string | undefined, fallback = 'You'): string {
  return (name ?? '').trim().split(/\s+/)[0] || fallback;
}

export const BOOKING_URL = 'https://calendar.app.google/rw8Vpd7BkJh5wwig9';
