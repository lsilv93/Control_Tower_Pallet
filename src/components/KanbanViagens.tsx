import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, MapPin, TriangleAlert, Truck } from "lucide-react";
import { REGRAS_VIAGEM, farolViagem, type Farol } from "@/lib/farol";
import { formatarNumero as n, numeroConferencia, numeroVale } from "@/lib/formatos";

export type Viagem = {
  id: string;
  numero: number;
  cdId: string;
  quantidade: number;
  quantidadeBons: number;
  quantidadeQuebrados: number;
  criadoEm: Date;
  cd: { codigo: string };
  unidade: { codigo: string } | null;
};

export type ViagemDivergente = Viagem & {
  conferencia: {
    numero: number;
    criadoEm: Date;
    diferenca: number;
    ocorrencias: { numero: number; ocorrencia: "FALTA" | "SOBRA" | null; quantidade: number; aguardando: { codigo: string } | null }[];
  } | null;
};

const COR: Record<Farol, string> = { VERDE: "#22c55e", AMARELO: "#eab308", VERMELHO: "#ef4444" };
const COLUNAS: { chave: Farol | "DIVERGENCIA"; titulo: string; detalhe: string }[] = [
  { chave: "VERDE", titulo: "No prazo", detalhe: `até ${REGRAS_VIAGEM.amareloHoras}h de viagem` },
  { chave: "AMARELO", titulo: "Atenção", detalhe: `${REGRAS_VIAGEM.amareloHoras}h a ${REGRAS_VIAGEM.vermelhoHoras}h de viagem` },
  { chave: "VERMELHO", titulo: "Atrasado", detalhe: `SLA de ${REGRAS_VIAGEM.vermelhoHoras}h estourado` },
  { chave: "DIVERGENCIA", titulo: "Recebido com divergência", detalhe: "aguardando a ocorrência" },
];

/** Escala de cores da rota (verde → amarelo → vermelho) em posições absolutas do trajeto. */
const GRADIENTE = `linear-gradient(90deg, ${COR.VERDE} 0%, ${COR.VERDE} ${(REGRAS_VIAGEM.amareloHoras / REGRAS_VIAGEM.vermelhoHoras) * 100 - 8}%, ${COR.AMARELO} ${(REGRAS_VIAGEM.amareloHoras / REGRAS_VIAGEM.vermelhoHoras) * 100 + 8}%, #f97316 82%, ${COR.VERMELHO} 100%)`;

function corNaPosicao(p: number) {
  return farolViagem(p * REGRAS_VIAGEM.vermelhoHoras);
}

const dataHora = (d: Date) =>
  d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", "");

const duracao = (horas: number) => {
  const h = Math.floor(horas);
  if (h < 1) return `${Math.max(1, Math.round(horas * 60))} min`;
  if (h < 48) return `${h}h${String(Math.floor((horas - h) * 60)).padStart(2, "0")}`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
};

/**
 * Linha de progresso da viagem: nós do despacho ao SLA (destino), trecho percorrido com a
 * escala verde → amarelo → vermelho, caminhão na posição atual e o restante em cinza.
 */
function LinhaViagem({ horas, chegou }: { horas: number; chegou?: boolean }) {
  const sla = REGRAS_VIAGEM.vermelhoHoras;
  const p = chegou ? 1 : Math.min(horas / sla, 1);
  const farol = chegou ? "VERMELHO" : farolViagem(horas);
  const nos = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="pt-1" role="img" aria-label={chegou ? "Recebido no destino com divergência" : `Em viagem há ${duracao(horas)}; SLA de ${sla}h`}>
      <div className="relative mx-2 h-7">
        {/* trilho restante */}
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--groove)]" />
        {/* trecho percorrido */}
        <div className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" style={{ width: `${p * 100}%`, backgroundImage: GRADIENTE, backgroundSize: `${p > 0 ? 100 / p : 100}% 100%` }} />
        {nos.map((x) => {
          const atingido = x <= p + 0.001;
          const cor = COR[corNaPosicao(x)];
          return (
            <span
              key={x}
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ left: `${x * 100}%`, borderColor: atingido ? cor : "var(--groove)", background: atingido ? cor : "var(--groove)", boxShadow: atingido && x === 1 ? `0 0 0 3px ${cor}33` : undefined }}
            />
          );
        })}
        <span className={clsx("absolute top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg", farol === "VERMELHO" && !chegou && "animate-pulse")} style={{ left: `${p * 100}%`, background: COR[farol] }}>
          {chegou ? <MapPin className="h-4 w-4 text-black" /> : <Truck className="h-4 w-4 text-black" />}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-t4">
        <span>Despacho</span>
        <span>{REGRAS_VIAGEM.amareloHoras}h</span>
        <span>Destino · SLA {sla}h</span>
      </div>
    </div>
  );
}

function Cartao({ v, cdAtual, agora, divergente }: { v: Viagem | ViagemDivergente; cdAtual: string; agora: number; divergente?: boolean }) {
  const horas = (agora - v.criadoEm.getTime()) / 3_600_000;
  const farol = farolViagem(horas);
  const codigo = numeroVale(v.numero, "ENVIO");
  const conf = divergente ? (v as ViagemDivergente).conferencia : null;
  return (
    <article className="poco space-y-2.5 p-3.5" data-testid={`viagem-${codigo}`}>
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link prefetch={false} href={`/vales/${v.id}`} className="num text-[13px] font-semibold text-lima hover:underline">{codigo}</Link>
          <p className="num mt-0.5 flex items-center gap-1 text-[12px] text-t2">
            {v.cd.codigo} <ArrowRight className="h-3 w-3 flex-none text-t3" aria-label="para" /> {v.unidade?.codigo ?? "—"}
            <span className={clsx("pill ml-1 !px-1.5 !py-0 text-[10px]", v.cdId === cdAtual ? "bg-t2/10 text-t2" : "bg-lima/10 text-lima")}>{v.cdId === cdAtual ? "Enviado" : "A receber"}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="num text-[20px] font-semibold leading-none text-t1">{n(v.quantidade)}</p>
          <p className="text-[10px] text-t4">{n(v.quantidadeBons)} PBR · {n(v.quantidadeQuebrados)} quebr.</p>
        </div>
      </header>
      <LinhaViagem horas={horas} chegou={divergente} />
      <dl className="space-y-0.5 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-t4">Despacho</dt>
          <dd className="num whitespace-nowrap text-t2">{dataHora(v.criadoEm)}</dd>
        </div>
        {conf ? (
          <div className="flex justify-between gap-2">
            <dt className="text-t4">Recebido</dt>
            <dd className="num whitespace-nowrap text-t2">{dataHora(conf.criadoEm)}</dd>
          </div>
        ) : (
          <div className="flex justify-between gap-2">
            <dt className="text-t4">Em viagem há</dt>
            <dd className="num whitespace-nowrap font-semibold" style={{ color: COR[farol] }}>{duracao(horas)}</dd>
          </div>
        )}
      </dl>
      {conf ? (
        <Link href="/ocorrencias?f=pendentes" className="flex items-start gap-1.5 rounded-lg bg-erro/10 px-2.5 py-1.5 text-[11px] text-erro hover:underline" data-testid="status-viagem">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span>
            Recebido com divergência · Conferência {numeroConferencia(conf.numero)} ({conf.diferenca > 0 ? "+" : ""}{n(conf.diferenca)})
            {conf.ocorrencias.map((o) => ` · ${numeroVale(o.numero, "OCORRENCIA")} aguardando ${o.aguardando?.codigo ?? "—"}`).join("")}
          </span>
        </Link>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: COR[farol] }} data-testid="status-viagem">
          <span className="ponto ponto-pulsante" style={{ background: COR[farol] }} /> Em Viagem / Aguardando Recebimento
        </p>
      )}
    </article>
  );
}

/**
 * Kanban de viagens do Painel: vales de envio em viagem envolvendo a unidade (enviados por ela
 * ou destinados a ela), em colunas pelo farol do SLA de viagem. Ao ser conferido sem divergência
 * o vale sai do quadro automaticamente; com divergência fica na última coluna até a ocorrência
 * ser encerrada.
 */
export function KanbanViagens({ viagens, divergentes, cdAtual, agora }: { viagens: Viagem[]; divergentes: ViagemDivergente[]; cdAtual: string; agora: number }) {
  const porColuna = (c: Farol | "DIVERGENCIA") => (c === "DIVERGENCIA" ? divergentes : viagens.filter((v) => farolViagem((agora - v.criadoEm.getTime()) / 3_600_000) === c));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="kanban-viagens">
      {COLUNAS.map((c) => {
        const itens = porColuna(c.chave);
        const cor = c.chave === "DIVERGENCIA" ? "#f43f5e" : COR[c.chave];
        return (
          <section key={c.chave} className="flex min-w-0 flex-col rounded-2xl border border-[var(--groove)] p-3" data-testid={`kanban-col-${c.chave}`}>
            <header className="mb-3 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: cor, boxShadow: `0 0 10px ${cor}` }} />
                <span>
                  <span className="block text-[12px] font-semibold uppercase tracking-[0.1em] text-t1">{c.titulo}</span>
                  <span className="block text-[10px] text-t4">{c.detalhe}</span>
                </span>
              </span>
              <span className="num rounded-full bg-[var(--groove)] px-2 py-0.5 text-[12px] font-semibold text-t1">{itens.length}</span>
            </header>
            {itens.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--groove)] px-3 py-5 text-center text-[11px] text-t4">Nenhum vale</p>
            ) : (
              <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-0.5">
                {itens.map((v) => (
                  <Cartao key={v.id} v={v} cdAtual={cdAtual} agora={agora} divergente={c.chave === "DIVERGENCIA"} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
