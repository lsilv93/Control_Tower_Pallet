import Link from "next/link";
import clsx from "clsx";
import type { Farol } from "@/lib/farol";

export function Cabecalho({ titulo, descricao, children }: { titulo: string; descricao?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-t1">{titulo}</h1>
        {descricao && <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-t3">{descricao}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

/** Card saliente (nível externo). Título fica direto no card, fora dos painéis afundados. */
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
    <section className={clsx("card min-w-0 p-5 sm:p-[22px]", className)}>
      {(titulo || acoes) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-t1">{titulo}</h2>
          {acoes}
        </div>
      )}
      {children}
    </section>
  );
}

/** Painel afundado para tabelas dentro de um card. */
export function Tabela({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("poco overflow-x-auto", className)}>{children}</div>;
}

const coresIndicador = {
  lima: "text-lima",
  ouro: "text-ouro",
  erro: "text-erro",
  neutro: "text-t2",
} as const;
export type CorIndicador = keyof typeof coresIndicador;

/** KPI: rótulo 10px maiúsculo espaçado, valor mono; ícone em poço afundado. */
export function Indicador({
  titulo,
  valor,
  detalhe,
  icone,
  cor = "lima",
  destaque = false,
}: {
  titulo: string;
  valor: string | number;
  detalhe?: React.ReactNode;
  icone?: React.ReactNode;
  cor?: CorIndicador;
  destaque?: boolean;
}) {
  return (
    <div className="card-sm relative flex min-w-0 items-start gap-4 overflow-hidden p-5">
      {destaque && icone && (
        <div className="pointer-events-none absolute -bottom-6 -right-4 text-lima opacity-[0.07] [&_svg]:h-32 [&_svg]:w-32">
          {icone}
        </div>
      )}
      {icone && (
        <div className={clsx("poco flex h-11 w-11 flex-none items-center justify-center !rounded-2xl", coresIndicador[cor])}>
          {icone}
        </div>
      )}
      <div className="relative min-w-0">
        <p className="label !mb-1">{titulo}</p>
        <p className={clsx("num font-semibold leading-tight", destaque ? "text-[40px] text-lima" : "text-[26px] text-t1")}>
          {valor}
        </p>
        {detalhe && <p className="mt-1 text-[11px] leading-snug text-t3">{detalhe}</p>}
      </div>
    </div>
  );
}

const estiloFarol: Record<Farol, { cor: string; fundo: string; rotulo: string }> = {
  VERMELHO: { cor: "text-erro", fundo: "bg-erro/10", rotulo: "Crítico" },
  AMARELO: { cor: "text-ouro", fundo: "bg-ouro/10", rotulo: "Atenção" },
  VERDE: { cor: "text-lima", fundo: "bg-lima/10", rotulo: "Normal" },
};

export function Ponto({ farol, pulsante }: { farol: Farol; pulsante?: boolean }) {
  return <span className={clsx("ponto", estiloFarol[farol].cor, pulsante && "ponto-pulsante")} aria-hidden />;
}

export function FarolBadge({ farol }: { farol: Farol }) {
  const e = estiloFarol[farol];
  return (
    <span className={clsx("pill", e.cor, e.fundo)}>
      <span className={clsx("ponto", farol === "VERMELHO" && "ponto-pulsante")} style={farol === "VERMELHO" ? { animationName: "pulso-erro" } : undefined} />
      {e.rotulo}
    </span>
  );
}

/** Legenda do farol (substitui emoji). */
export function LegendaFarol({ itens }: { itens: [Farol, string][] }) {
  return (
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-t3">
      {itens.map(([f, texto]) => (
        <span key={f} className="inline-flex items-center gap-1.5">
          <Ponto farol={f} /> {texto}
        </span>
      ))}
    </p>
  );
}

const estiloStatus: Record<string, string> = {
  PENDENTE: "text-ouro bg-ouro/10",
  AGENDADO: "text-t2 bg-t2/10",
  FINALIZADO: "text-lima bg-lima/10",
  ABERTA: "text-lima bg-lima/10",
  VALIDADA: "text-lima bg-lima/10",
  CANCELADA: "text-t4 bg-t4/10",
};

export function StatusBadge({ status, rotulo }: { status: string; rotulo: string }) {
  return (
    <span className={clsx("pill", estiloStatus[status] ?? "text-t2")}>
      <span className="ponto" />
      {rotulo}
    </span>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="poco px-5 py-8 text-center text-[12px] text-t3">{children}</p>;
}

export function Delta({ valor }: { valor: number }) {
  if (valor === 0) return <span className="num text-t4">0</span>;
  return <span className={clsx("num font-semibold", valor > 0 ? "text-lima" : "text-erro")}>{valor > 0 ? `+${valor}` : valor}</span>;
}

/** Abas de navegação: trilha afundada com pílulas; ativa em lima. */
export function Abas({ itens, ativo }: { itens: { href: string; rotulo: string; icone?: React.ReactNode }[]; ativo: string }) {
  return (
    <nav className="abas mb-6">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} className={clsx("aba", i.href === ativo && "aba-ativa")} aria-current={i.href === ativo ? "page" : undefined}>
          {i.icone}
          {i.rotulo}
        </Link>
      ))}
    </nav>
  );
}
