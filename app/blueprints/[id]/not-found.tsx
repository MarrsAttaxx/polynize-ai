import Link from 'next/link';
import s from './blueprint.module.css';

export default function BlueprintNotFound() {
  return (
    <div className={s.body}>
      <main className={s.final} style={{ paddingTop: 140 }}>
        <h1 className={s.finalTitle}>
          Blueprint not found<span className={s.mint}>.</span>
        </h1>
        <p className={s.finalLede}>
          That link may have expired or been mistyped. Build your own: answer eight questions and
          see every capability scored against what good looks like.
        </p>
        <div className={s.ctas}>
          <Link className={`${s.cta} ${s.ctaPrimary}`} href="/blueprint">
            build_my_blueprint →
          </Link>
          <Link className={`${s.cta} ${s.ctaSecondary}`} href="/">
            ← back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
