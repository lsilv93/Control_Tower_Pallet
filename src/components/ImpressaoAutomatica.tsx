"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function ImpressaoAutomatica({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <button type="button" className="btn-primary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> Imprimir
    </button>
  );
}
