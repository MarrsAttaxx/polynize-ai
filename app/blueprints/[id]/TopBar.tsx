import s from './blueprint.module.css';
import { BOOKING_URL } from './util';
import { TrackedLink } from '@/app/_components/TrackedLink';

type Props = {
  docRef: string;
};

export function TopBar({ docRef }: Props) {
  return (
    <header className={s.top}>
      <a href="/">polynize</a>
      <span>BP-{docRef}</span>
      <div className={s.topRight}>
        <TrackedLink
          className={s.topBtn}
          href={BOOKING_URL}
          external
          event="booking_click"
          eventProps={{ surface: 'blueprint_topbar' }}
        >
          book a call
        </TrackedLink>
      </div>
    </header>
  );
}
