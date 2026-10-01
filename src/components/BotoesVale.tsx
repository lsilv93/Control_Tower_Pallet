import Link from "next/link";
import clsx from "clsx";
import { Download, Printer } from "lucide-react";

/** Ações do vale: baixar PDF (servidor) e imprimir (layout A4 em 2 vias). */
export function BotoesVale({ id, compacto }: { id: string; compacto?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <a href={`/api/vales/${id}/pdf`} className={clsx("btn-primary", compacto && "btn-sm")} download>
        <Download className="h-4 w-4" /> Baixar PDF
      </a>
      <Link prefetch={false} href={`/imprimir/vale/${id}?auto=1`} target="_blank" className={clsx("btn-secondary", compacto && "btn-sm")}>
        <Printer className="h-4 w-4" /> Imprimir
      </Link>
    </span>
  );
}
