import { addToEmailSet, getEmailSet } from './email-set-store';

/**
 * PEOPLE WHO ARE NOT LEADS.
 *
 * Marrs: "we need a delete button because there are some here that I don't need, and I need
 * to be able to delete them or ignore them."
 *
 * Dismissing a Fireflies candidate has to be REMEMBERED, or it is not a dismissal: the scan
 * reads the same recent meetings every time, so anyone waved away would reappear on the next
 * press and the list would never get shorter. That is how a review list becomes something
 * nobody opens.
 *
 * The storage shape is shared with the digest's already-mentioned set; see email-set-store.
 */

const KEY = 'pam/config/crm-ignored.json';

export function getIgnored(owner: string): Promise<Set<string>> {
  return getEmailSet(KEY, owner);
}

export function ignoreEmails(owner: string, emails: string[]): Promise<void> {
  return addToEmailSet(KEY, owner, emails);
}
