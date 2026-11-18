/**
 * « C'est votre tour » (maquette v2 01) : écran vert plein, par-dessus tout (y compris le jeu), jusqu'à « J'arrive ».
 * Le son et la vibration sont déclenchés par « Mon ticket » (`signalAttention`) ; cet écran n'affiche que le message.
 */
export function CalledScreen({
  title,
  code,
  counter,
  service,
  action,
  onDismiss,
}: {
  title: string;
  code: string;
  /** « Allez au cabinet 2 » ; null si le poste n'est pas connu. */
  counter: string | null;
  service: string;
  action: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="called-title"
      aria-describedby={counter ? "called-counter" : undefined}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2.5 bg-called px-6 pt-[env(safe-area-inset-top)] pb-[max(env(safe-area-inset-bottom),1.5rem)] text-center text-white motion-safe:animate-fade-in"
    >
      <p id="called-title" className="text-headline">
        {title}
      </p>
      <p className="font-rounded text-[5.25rem] leading-none font-bold">{code}</p>
      {counter ? (
        <p id="called-counter" className="mt-1.5 text-title2 font-semibold">
          {counter}
        </p>
      ) : null}
      <p className="text-subheadline">{service}</p>
      <button
        type="button"
        autoFocus
        onClick={onDismiss}
        className="pressable mt-7 h-[3.125rem] w-full max-w-sm rounded-[12px] bg-white text-headline text-called"
      >
        {action}
      </button>
    </div>
  );
}
