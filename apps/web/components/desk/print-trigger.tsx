"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Lance l'impression à l'ouverture (ticket thermique) ; boutons masqués à l'impression. */
export function PrintTrigger({ label, widths, current, base }: { label: string; widths: { value: string; label: string }[]; current: string; base: string }) {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-3 print:hidden">
      <Button onClick={() => window.print()} leadingIcon={<Printer aria-hidden className="size-5" />}>
        {label}
      </Button>
      <div className="flex gap-2">
        {widths.map((w) => (
          <Button key={w.value} asChild size="md" variant={w.value === current ? "tinted" : "plain"}>
            <Link href={`${base}?w=${w.value}`} replace>
              {w.label}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
