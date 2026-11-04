// FIXA logo (design/design-system.md, "Brand"). The A is a roof; the signal dot
// takes the crossbar's place: the building noticing a problem first.

const WORDMARK_PATH = "M10 90V10h40M10 48h32M76 10v80M100 10l48 80M148 10l-48 80M168 90l32-80 32 80";
const MARK_PATH = "M30 88 60 30l30 58";

/** The wordmark. Inherits text colour for the letters; the dot uses the signal colour. */
export function FixaWordmark({ className, title = "Fixa" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 244 100" className={className} role="img" aria-label={title}>
      <path d={WORDMARK_PATH} fill="none" stroke="currentColor" strokeWidth={15} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={200} cy={66} r={8.5} fill="var(--signal)" />
    </svg>
  );
}

/** The app mark: roof + signal dot on a primary tile. Decorative unless a title is given. */
export function FixaMark({ className, title, round = false }: { className?: string; title?: string; round?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width={120} height={120} rx={round ? 60 : 28} fill="var(--primary)" />
      <path d={MARK_PATH} fill="none" stroke="#fff" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={60} cy={72} r={8} fill="var(--signal)" />
    </svg>
  );
}

/** Mark + wordmark, for the dashboard sidebar and auth screens. */
export function FixaLockup({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <FixaMark className="size-8" />
      <FixaWordmark className="h-6 w-auto text-foreground" />
    </span>
  );
}
