/**
 * Bring the OLD engagement-based leads into the CRM as contacts.
 *
 * Marrs chose "move them into the CRM as contacts" for the records the previous
 * /console/leads page showed: client engagements flagged engagement_status: 'lead'.
 *
 * WHY THIS IS A BUTTON AND NOT A MIGRATION. Those records do not live in a table. They
 * are parsed out of client engagement CONFIGS, so there is no SQL that could move them,
 * and a silent server-side import on first page load would be invisible: no way to see
 * what it did, and no way to decide it was wrong. Pressing a button and being told what
 * landed is the reversible version.
 *
 * IDEMPOTENT. It upserts on (owner, email), so running it twice does not duplicate
 * anyone, and it never overwrites a field with nothing: someone already worked in the CRM
 * keeps their stage, notes and next action.
 *
 *   POST {}   ->  { imported, skipped, alreadyThere, reasons }
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/console-auth';
import { listContacts, upsertContact } from '@/lib/crm/contact-store';
import { loadClientCardData } from '../../_lib/load-clients';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Everything lands in Polynize: these are inbound prospects for the business, not personal contacts. */
const OWNER = 'polynize';

export async function POST() {
  const user = await getCurrentUser();
  if (!user || user.scope.type !== 'team') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const [clients, existing] = await Promise.all([
      loadClientCardData(),
      listContacts(OWNER).catch(() => []),
    ]);
    const have = new Set(existing.map((c) => c.email.toLowerCase()));

    const leads = clients.filter((c) => c.engagementStatus === 'lead');

    let imported = 0;
    let alreadyThere = 0;
    const reasons: string[] = [];

    for (const lead of leads) {
      /**
       * An email is the only field the CRM cannot do without, since it is half the
       * primary key. Engagement configs carry up to three candidates, so try them in
       * order of how specifically they identify a person.
       */
      const email =
        lead.prospect?.email?.trim() || lead.leadEmail?.trim() || '';
      if (!email) {
        // Named, so he can see WHICH ones need a hand rather than only that some do.
        reasons.push(`${lead.name}: no email on the engagement, add it by hand`);
        continue;
      }

      if (have.has(email.toLowerCase())) {
        alreadyThere += 1;
        continue;
      }

      const notes = [
        `Imported from the old engagement roster (${lead.slug}).`,
        lead.prospect?.firstName ? `Prospect first name: ${lead.prospect.firstName}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      try {
        await upsertContact({
          owner: OWNER,
          email,
          // The engagement's name is the COMPANY, not the person: these configs are named
          // after the client. Putting it in `business` and leaving `name` empty is more
          // honest than inventing a person called EverStock.
          business: lead.name,
          name: lead.prospect?.firstName,
          stage: 'contacted',
          source: 'engagement',
          notes,
        });
        imported += 1;
        have.add(email.toLowerCase());
      } catch (err) {
        console.error(`[crm.import] ${lead.slug} failed:`, err);
        reasons.push(`${lead.name}: could not be saved`);
      }
    }

    return NextResponse.json({
      ok: true,
      found: leads.length,
      imported,
      alreadyThere,
      skipped: reasons.length,
      reasons,
    });
  } catch (err) {
    console.error('[crm.import] failed:', err);
    return NextResponse.json({ error: 'Could not read the old roster.' }, { status: 502 });
  }
}
