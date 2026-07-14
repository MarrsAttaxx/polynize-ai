import Link from 'next/link';
import { supabaseService } from '@/lib/supabase';
import { validateSalesBlueprint } from '@/lib/agents/sales-blueprint-schema';
import { BlueprintDoc } from '../BlueprintDoc';
import s from '../blueprint.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Shared, persisted view of a generated blueprint. Loads the stored envelope by
 * id and renders the same interactive document (including the chat editor, so a
 * client can play with it). Edits persist back to this same id.
 */
export default async function SharedBlueprintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let content: unknown = null;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const sb = supabaseService();
      const { data } = await sb.from('sales_blueprints').select('content').eq('id', id).maybeSingle();
      content = data?.content ?? null;
    } catch {
      content = null;
    }
  }

  const validation = content ? validateSalesBlueprint(content) : ({ ok: false } as const);

  if (!validation.ok) {
    return (
      <div className={s.wrap}>
        <div className={s.errStage}>
          <div className={s.errTag}>blueprint / not found</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>This blueprint is not available.</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 14, maxWidth: 440 }}>
            The link may be incomplete, or the map has not finished saving yet.
          </p>
          <Link href="/blueprint" className={s.restartLink}>
            Map a new bottleneck
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={s.wrap}>
      <BlueprintDoc initialData={validation.data} initialId={id} />
    </div>
  );
}
