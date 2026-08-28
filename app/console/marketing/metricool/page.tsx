import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/console-auth';
import { STREAMS } from '@/lib/marketing/streams';
import { isMetricoolConfigured, listBrands, type MetricoolBrand } from '@/lib/marketing/metricool-client';
import { getBrandMap, type BrandMap } from '@/lib/marketing/metricool-config-store';
import { getChannelSchedule } from '@/lib/marketing/channel-schedule';
import { MetricoolSettings } from './MetricoolSettings';
import { BackLink } from '@/app/console/marketing/_components/BackLink';
import s from './metricool.module.css';

export const dynamic = 'force-dynamic';

/**
 * Connect Metricool (D24, publishing Step 2). Lists the account's brands (which
 * also verifies the token works) and maps each stream to a brand, so a stream's
 * posts publish under the right Metricool account. Team-scope only.
 */
export default async function MetricoolPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.scope.type === 'client') {
    redirect(`/console/${user.scope.slug}/blueprint`);
  }

  const configured = isMetricoolConfigured();
  let brands: MetricoolBrand[] = [];
  let error: string | null = null;
  let map: BrandMap = {};
  /**
   * THE LANE SCHEDULES, which is now the only slot table (D79).
   *
   * This page used to edit `posting-schedule.slots`, a second per-stream list that nothing read any
   * more: the wave and "Add to queue" both take their times from here. Editing the dead one is why
   * the timezone Marrs set had no effect on what shipped.
   */
  let lanes: Record<
    string,
    { timezone: string; channels: Record<string, string[]>; modes: Record<string, 'auto' | 'manual'> }
  > = {};

  if (configured) {
    try {
      brands = await listBrands();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not reach Metricool.';
    }
    try {
      map = await getBrandMap();
    } catch {
      map = {};
    }
    /**
     * Read per lane rather than in one call, because each lane is its own object in the store and a
     * missing one has to fall back to that lane's defaults (his LinkedIn manual, Kristin in
     * California) rather than to an empty row that would look like "no posting times set".
     */
    lanes = Object.fromEntries(
      await Promise.all(
        STREAMS.map(async (st) => {
          try {
            const cfg = await getChannelSchedule(st.id);
            return [st.id, { timezone: cfg.timezone, channels: cfg.channels, modes: cfg.modes }] as const;
          } catch {
            return [st.id, { timezone: 'Australia/Sydney', channels: {}, modes: {} }] as const;
          }
        })
      )
    );
  }

  return (
    <div className={s.root}>
      <header className={s.head}>
        <BackLink fallbackHref="/console/marketing/calendar" className={s.back} />
        <span className={s.eyebrow}>connect · metricool</span>
        <h1 className={s.title}>Metricool</h1>
        <p className={s.sub}>
          Match each stream to its Metricool brand, so a stream&rsquo;s posts publish under the
          right account. Posting to your channels runs through Metricool.
        </p>
      </header>

      {!configured ? (
        <div className={s.notice}>
          <p className={s.noticeTitle}>Not connected yet</p>
          <p>
            Add <code>METRICOOL_USER_TOKEN</code> and <code>METRICOOL_USER_ID</code> in Vercel
            (Production + Preview), then redeploy. This page will then list your Metricool brands.
          </p>
        </div>
      ) : error ? (
        <div className={s.noticeError}>
          <p className={s.noticeTitle}>Connected, but Metricool returned an error</p>
          <p className={s.errText}>{error}</p>
          <p>Check the token and user id are correct and the account has API access.</p>
        </div>
      ) : brands.length === 0 ? (
        <div className={s.notice}>
          <p className={s.noticeTitle}>Connected, but no brands came back</p>
          <p>The token works but the account shows no brands. Confirm your Metricool brands exist.</p>
        </div>
      ) : (
        <MetricoolSettings
          streams={[...STREAMS]}
          brands={brands}
          initialMap={map}
          initialLanes={lanes}
        />
      )}
    </div>
  );
}
