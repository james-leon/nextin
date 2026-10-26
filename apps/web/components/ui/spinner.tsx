import { cn } from "@/lib/cn";

/** Indicateur d'activité iOS (8 branches). */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn("relative inline-block size-5", className)}>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute top-0 left-[calc(50%-1px)] h-[30%] w-[2px] origin-[50%_166%] rounded-full bg-current"
          style={{
            transform: `rotate(${i * 45}deg)`,
            opacity: 1 - i * 0.1,
            animation: "spinner-fade 0.8s linear infinite",
            animationDelay: `${-0.8 + i * 0.1}s`,
          }}
        />
      ))}
      <style>{`@keyframes spinner-fade{from{opacity:1}to{opacity:.15}}`}</style>
    </span>
  );
}
