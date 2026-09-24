import clsx from "clsx";
import type { Farol } from "@/lib/farol";

export function Cabecalho({ titulo, descricao, children }: { titulo: string; descricao?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Painel({
  titulo,
  acoes,
  children,
  className,
}: {
  titulo?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("card min-w-0", className)}>
      {(titulo || acoes) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold text-slate-800">{titulo}</h2>
          {acoes}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const coresIndicador = {
  azul: "bg-brand-50 text-brand-600",
  verde: "bg-emerald-50 text-emerald-600",
  vermelho: "bg-red-50 text-red-600",
  laranja: "bg-amber-50 text-amber-600",
  roxo: "bg-violet-50 text-violet-600",
  cinza: "bg-slate-100 text-slate-600",
} as const;

export function Indicador({
  titulo,
  valor,
  detalhe,
  icone,
  cor = "azul",
  destaque = false,
}: {
  titulo: string;
  valor: string | number;
  detalhe?: React.ReactNode;
  icone?: React.ReactNode;
  cor?: keyof typeof coresIndicador;
  destaque?: boolean;
}) {
  return (
    <div className={clsx("card flex items-start gap-4 p-5", destaque && "ring-2 ring-brand-500")}>
      {icone && <div className={clsx("rounded-lg p-2.5", coresIndicador[cor])}>{icone}</div>}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{titulo}</p>
        <p className={clsx("font-bold tabular-nums text-slate-900", destaque ? "text-4xl" : "text-2xl")}>{valor}</p>
        {detalhe && <p className="mt-0.5 text-xs text-slate-500">{detalhe}</p>}
      </div>
    </div>
  );
}

const estiloFarol: Record<Farol, { bola: string; texto: string; rotulo: string }> = {
  VERMELHO: { bola: "bg-red-500 shadow-red-300", texto: "text-red-700 bg-red-50", rotulo: "Crítico" },
  AMARELO: { bola: "bg-amber-400 shadow-amber-200", texto: "text-amber-700 bg-amber-50", rotulo: "Atenção" },
  VERDE: { bola: "bg-emerald-500 shadow-emerald-200", texto: "text-emerald-700 bg-emerald-50", rotulo: "Normal" },
};

export function FarolBadge({ farol }: { farol: Farol }) {
  const e = estiloFarol[farol];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", e.texto)}>
      <span className={clsx("h-2.5 w-2.5 rounded-full shadow", e.bola)} />
      {e.rotulo}
    </span>
  );
}

const estiloStatus: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800",
  AGENDADO: "bg-blue-100 text-blue-800",
  FINALIZADO: "bg-emerald-100 text-emerald-800",
  ABERTA: "bg-blue-100 text-blue-800",
  VALIDADA: "bg-emerald-100 text-emerald-800",
  CANCELADA: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status, rotulo }: { status: string; rotulo: string }) {
  return (
    <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", estiloStatus[status] ?? "bg-slate-100")}>
      {rotulo}
    </span>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
}

export function Delta({ valor }: { valor: number }) {
  if (valor === 0) return <span className="text-slate-400">0</span>;
  return (
    <span className={clsx("font-semibold tabular-nums", valor > 0 ? "text-emerald-600" : "text-red-600")}>
      {valor > 0 ? `+${valor}` : valor}
    </span>
  );
}
