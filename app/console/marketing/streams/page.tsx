import { redirect } from 'next/navigation';

/**
 * THE OLD STREAM DASHBOARD, now the front page again (D45).
 *
 * This page existed because D40 replaced the stream cards with a flat board and the cards had to
 * go somewhere. Marrs put them back at the top, so /console/marketing IS this screen and having
 * two of them would be two places that disagree the first time one is edited.
 *
 * A redirect rather than a delete, because "Streams and setup" was linked from the board header
 * and is in his hands and his notes.
 */
export default function StreamsRedirect() {
  redirect('/console/marketing');
}
