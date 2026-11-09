import { qrMatrix } from "@/lib/qr/matrix";

/** QR code vectoriel (rendu serveur), noir sur blanc quel que soit le thème pour rester lisible. */
export function QrImage({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, path } = qrMatrix(value, 2);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className={className} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
