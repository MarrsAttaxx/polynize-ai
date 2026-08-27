'use client';

/**
 * Project timeline (Gantt v1) — spec §10.
 *
 * X = time, Y = timeline items (one row per distinct lane value).
 * Horizontal duration pills sized by duration_days. Dependency connectors
 * (SVG bezier overlay). Status colours. Today line (client-only to avoid
 * hydration mismatch). Form-based editing of start / duration /
 * dependencies / status / lane (team-scope), persisted via
 * POST /api/console/[slug]/timeline.
 *
 * [DEFERRED] Drag-to-reschedule with cascade. The data model fully
 * supports it (start, duration_days, dependencies, lane), so it lands as
 * a fast-follow without schema change. v1 ships form editing per the
 * spec's explicit allowance (§10.2 Judgment Call 8).
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectTimeline as Timeline, TimelineItem } from '@/lib/blueprint/load-v2';
import s from './timeline.module.css';

const DAY_WIDTH = 22;
const LABEL_COL = 180;
const LANE_HEIGHT = 40;
const _AXIS_HEIGHT = 32; // 24px axis + 8px margin

const MS_PER_DAY = 86400000;

function parseDay(iso: string): number {
  // Parse YYYY-MM-DD (or full ISO) to a UTC midnight epoch-day count.
  const d = new Date(iso);
  return Math.floor(d.getTime() / MS_PER_DAY);
}

function dayToDate(dayIndex: number): Date {
  return new Date(dayIndex * MS_PER_DAY);
}

function fmtShort(d: Date): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function ProjectTimeline({
  slug,
  timeline,
  canEdit,
}: {
  slug: string;
  timeline: Timeline;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<TimelineItem[]>(timeline.items);
  const [editing, setEditing] = useState<TimelineItem | null>(null);
  const [todayDay, setTodayDay] = useState<number | null>(null);

  useEffect(() => {
    // Client-only: compute today after mount to avoid hydration mismatch.
    setTodayDay(Math.floor(Date.now() / MS_PER_DAY));
  }, []);

  useEffect(() => {
    setItems(timeline.items);
  }, [timeline.items]);

  const geom = useMemo(() => {
    if (items.length === 0) {
      return { windowStart: 0, totalDays: 0, lanes: [] as number[] };
    }
    const starts = items.map((i) => parseDay(i.start));
    const ends = items.map((i) => parseDay(i.start) + Math.max(i.duration_days, 1));
    const windowStart = Math.min(...starts) - 2;
    const windowEnd = Math.max(...ends) + 2;
    const totalDays = windowEnd - windowStart;
    const lanes = Array.from(new Set(items.map((i) => i.lane))).sort(
      (a, b) => a - b
    );
    return { windowStart, totalDays, lanes };
  }, [items]);

  const trackWidth = geom.totalDays * DAY_WIDTH;
  const laneIndex = (lane: number) => geom.lanes.indexOf(lane);
  const xOf = (day: number) => (day - geom.windowStart) * DAY_WIDTH;
  const rowYOf = (lane: number) =>
    laneIndex(lane) * LANE_HEIGHT + LANE_HEIGHT / 2;

  // Weekly ticks.
  const ticks = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    for (let d = 0; d <= geom.totalDays; d += 7) {
      const day = geom.windowStart + d;
      out.push({ x: d * DAY_WIDTH, label: fmtShort(dayToDate(day)) });
    }
    return out;
  }, [geom]);

  // Dependency connectors.
  const connectors = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const paths: string[] = [];
    for (const item of items) {
      const itemLeft = xOf(parseDay(item.start));
      const itemY = rowYOf(item.lane);
      for (const depId of item.dependencies) {
        const dep = byId.get(depId);
        if (!dep) continue;
        const depRight =
          xOf(parseDay(dep.start)) + Math.max(dep.duration_days, 1) * DAY_WIDTH;
        const depY = rowYOf(dep.lane);
        const midX = Math.max((depRight + itemLeft) / 2, depRight + 6);
        paths.push(
          `M ${depRight} ${depY} C ${midX} ${depY} ${midX} ${itemY} ${itemLeft} ${itemY}`
        );
      }
    }
    return paths;
  }, [items, geom]);

  if (items.length === 0) {
    return (
      <p className={s.dragNote}>
        No timeline items yet. Infrastructure prerequisites and work plans
        appear here once scheduled.
      </p>
    );
  }

  const regionHeight = geom.lanes.length * LANE_HEIGHT;

  return (
    <div
      className={s.wrap}
      style={
        {
          '--label-col': `${LABEL_COL}px`,
        } as React.CSSProperties
      }
    >
      <div
        className={s.scroll}
        style={{ minWidth: LABEL_COL + trackWidth }}
      >
        {/* Time axis */}
        <div className={s.axis} style={{ width: trackWidth }}>
          {ticks.map((t, i) => (
            <span key={i} className={s.tick} style={{ left: t.x }}>
              {t.label}
            </span>
          ))}
        </div>

        {/* Lanes region */}
        <div style={{ position: 'relative', height: regionHeight }}>
          {/* Dependency connectors overlay */}
          <svg
            className={s.connectors}
            width={trackWidth}
            height={regionHeight}
            style={{ width: trackWidth, height: regionHeight }}
          >
            {connectors.map((d, i) => (
              <path key={i} d={d} className={s.connectorPath} />
            ))}
          </svg>

          {/* Today line */}
          {todayDay !== null &&
            todayDay >= geom.windowStart &&
            todayDay <= geom.windowStart + geom.totalDays && (
              <div
                className={s.today}
                style={{ left: LABEL_COL + xOf(todayDay) }}
              >
                <span className={s.todayLabel}>today</span>
              </div>
            )}

          {/* One row per lane; items placed in their lane's track */}
          {geom.lanes.map((lane) => {
            const laneItems = items.filter((i) => i.lane === lane);
            return (
              <div key={lane} className={s.lane}>
                <div className={s.laneLabel}>
                  <span
                    className={`${s.typeDot} ${typeDotClass(laneItems[0]?.item_type)}`}
                    aria-hidden
                  />
                  {laneItems.map((i) => i.label).join(' · ')}
                </div>
                <div className={s.laneTrack} style={{ width: trackWidth }}>
                  {laneItems.map((item) =>
                    item.item_type === 'milestone' ||
                    item.duration_days === 0 ? (
                      <button
                        key={item.id}
                        type="button"
                        className={s.milestone}
                        style={{ left: xOf(parseDay(item.start)) }}
                        title={`${item.label} — ${item.start}`}
                        onClick={() => canEdit && setEditing(item)}
                        aria-label={item.label}
                      />
                    ) : (
                      <button
                        key={item.id}
                        type="button"
                        className={`${s.bar} ${barClass(item.status)}`}
                        style={{
                          left: xOf(parseDay(item.start)),
                          width: Math.max(item.duration_days, 1) * DAY_WIDTH,
                        }}
                        onClick={() => canEdit && setEditing(item)}
                        title={`${item.label} — ${item.start}, ${item.duration_days}d`}
                      >
                        {item.status === 'in_progress' &&
                          item.progress_pct > 0 && (
                            <span
                              className={s.barProgressFill}
                              style={{ width: `${item.progress_pct}%` }}
                              aria-hidden
                            />
                          )}
                        <span style={{ position: 'relative' }}>
                          {item.label}
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={s.legend}>
        <span className={s.legendItem}>
          <span
            className={s.legendSwatch}
            style={{ background: 'var(--bp-electric)' }}
          />
          infrastructure
        </span>
        <span className={s.legendItem}>
          <span
            className={s.legendSwatch}
            style={{ background: 'var(--bp-mint)' }}
          />
          work plan
        </span>
        <span className={s.legendItem}>
          <span
            className={s.legendSwatch}
            style={{ background: 'var(--bp-amber)', borderRadius: '50%' }}
          />
          milestone
        </span>
      </div>

      {canEdit && (
        <p className={s.dragNote}>
          Click an item to edit its dates and dependencies. Drag-to-reschedule
          is a fast-follow.
        </p>
      )}

      {editing && (
        <TimelineEditPanel
          slug={slug}
          item={editing}
          allItems={items}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setItems(updated);
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function typeDotClass(type: TimelineItem['item_type'] | undefined): string {
  if (type === 'infrastructure') return s.typeInfra;
  if (type === 'milestone') return s.typeMilestone;
  return s.typeWork;
}

function barClass(status: TimelineItem['status']): string {
  switch (status) {
    case 'in_progress':
      return s.barInProgress;
    case 'complete':
      return s.barComplete;
    case 'blocked':
      return s.barBlocked;
    default:
      return s.barNotStarted;
  }
}

// ============================================================
// Edit panel
// ============================================================

function TimelineEditPanel({
  slug,
  item,
  allItems,
  onClose,
  onSaved,
}: {
  slug: string;
  item: TimelineItem;
  allItems: TimelineItem[];
  onClose: () => void;
  onSaved: (updated: TimelineItem[]) => void;
}) {
  const [start, setStart] = useState(item.start.slice(0, 10));
  const [duration, setDuration] = useState(String(item.duration_days));
  const [status, setStatus] = useState<TimelineItem['status']>(item.status);
  const [lane, setLane] = useState(String(item.lane));
  const [progress, setProgress] = useState(String(item.progress_pct));
  const [deps, setDeps] = useState<string[]>(item.dependencies);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const others = allItems.filter((i) => i.id !== item.id);

  async function save() {
    setSaving(true);
    setError(null);
    const updatedItem: TimelineItem = {
      ...item,
      start,
      duration_days: Math.max(0, parseInt(duration, 10) || 0),
      status,
      lane: Math.max(0, parseInt(lane, 10) || 0),
      progress_pct: Math.min(100, Math.max(0, parseInt(progress, 10) || 0)),
      dependencies: deps,
    };
    const updated = allItems.map((i) => (i.id === item.id ? updatedItem : i));
    try {
      const res = await fetch(`/api/console/${slug}/timeline`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: updated }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Save failed (${res.status})`);
        setSaving(false);
        return;
      }
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div
      className={s.editBackdrop}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={s.editPanel}>
        <div className={s.editHead}>
          <h3 className={s.editTitle}>{item.label}</h3>
          <button
            type="button"
            className={s.btnGhost}
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '4px 10px' }}
          >
            ×
          </button>
        </div>

        <div className={s.editField}>
          <label className={s.editLabel} htmlFor="tl-start">
            Start date
          </label>
          <input
            id="tl-start"
            type="date"
            className={s.editInput}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>

        <div className={s.editField}>
          <label className={s.editLabel} htmlFor="tl-duration">
            Duration (days)
          </label>
          <input
            id="tl-duration"
            type="number"
            min={0}
            className={s.editInput}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        <div className={s.editField}>
          <label className={s.editLabel} htmlFor="tl-status">
            Status
          </label>
          <select
            id="tl-status"
            className={s.editSelect}
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as TimelineItem['status'])
            }
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="complete">Complete</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div className={s.editField}>
          <label className={s.editLabel} htmlFor="tl-progress">
            Progress %
          </label>
          <input
            id="tl-progress"
            type="number"
            min={0}
            max={100}
            className={s.editInput}
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
          />
        </div>

        <div className={s.editField}>
          <label className={s.editLabel} htmlFor="tl-lane">
            Lane (row order)
          </label>
          <input
            id="tl-lane"
            type="number"
            min={0}
            className={s.editInput}
            value={lane}
            onChange={(e) => setLane(e.target.value)}
          />
        </div>

        {others.length > 0 && (
          <div className={s.editField}>
            <span className={s.editLabel}>Depends on</span>
            <div className={s.editDeps}>
              {others.map((o) => (
                <label key={o.id} className={s.editDepRow}>
                  <input
                    type="checkbox"
                    checked={deps.includes(o.id)}
                    onChange={(e) => {
                      setDeps((prev) =>
                        e.target.checked
                          ? [...prev, o.id]
                          : prev.filter((d) => d !== o.id)
                      );
                    }}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className={s.editError}>{error}</p>}

        <div className={s.editActions}>
          <button type="button" className={s.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={s.btnPrimary}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
