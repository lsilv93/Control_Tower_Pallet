import "server-only";
import { enviosEmTransito, posicaoUnidades, type LinhaUnidade } from "./consultas";
import { diaLocal, fimDoDia, idadeEmDias, inicioDoDia } from "./datas";
import { farolUnidade, type FarolUnidade } from "./farol";
import { prisma } from "./prisma";

/**
 * Acuracidade das remessas: 1 − Σ|recebido − declarado| / Σdeclarado, sobre as conferências
 * em que a unidade foi a remetente. Faltas e sobras reduzem a taxa. null = sem conferência.
 */
function acuracidade(declarado: number, divergencia: number) {
  return declarado > 0 ? Math.max(0, 1 - divergencia / declarado) : null;
}

export type LinhaTV = LinhaUnidade &
  FarolUnidade & {
    total: number;
    enviadosConferidos: number;
    recebidosConferidos: number;
    acuracidade: number | null;
    ocorrenciasPendentes: number;
    diasTransitoMaisAntigo: number | null;
    transitoHubQuebrados: number;
    cdsAtendidos: string[];
  };

/** Indicadores da Torre de Controle Nível Brasil (gestão à vista; sem dados de fornecedores). */
export async function dadosTV() {
  const hoje = diaLocal();
  const [posicao, transito, conferencias, hojeConf, ocorrencias, vinculos] = await Promise.all([
    posicaoUnidades(),
    enviosEmTransito(),
    prisma.conferencia.findMany({ select: { remetenteId: true, totalDeclarado: true, recebidoBons: true, recebidoQuebrados: true, diferenca: true } }),
    prisma.conferencia.aggregate({ where: { criadoEm: { gte: inicioDoDia(hoje), lt: fimDoDia(hoje) } }, _sum: { recebidoBons: true, recebidoQuebrados: true }, _count: true }),
    prisma.valePallet.findMany({ where: { tipo: "OCORRENCIA", status: "PENDENTE" }, select: { cdId: true, unidadeId: true, quantidade: true, criadoEm: true } }),
    prisma.crossCD.findMany({ select: { crossId: true, cd: { select: { codigo: true } } }, orderBy: { cd: { codigo: "asc" } } }),
  ]);

  // Acuracidade por remetente.
  const porRemetente = new Map<string, { enviados: number; recebidos: number; divergencia: number }>();
  for (const c of conferencias) {
    const a = porRemetente.get(c.remetenteId) ?? { enviados: 0, recebidos: 0, divergencia: 0 };
    a.enviados += c.totalDeclarado;
    a.recebidos += c.recebidoBons + c.recebidoQuebrados;
    a.divergencia += Math.abs(c.diferenca);
    porRemetente.set(c.remetenteId, a);
  }
  const geral = [...porRemetente.values()].reduce((s, a) => ({ enviados: s.enviados + a.enviados, recebidos: s.recebidos + a.recebidos, divergencia: s.divergencia + a.divergencia }), { enviados: 0, recebidos: 0, divergencia: 0 });

  // SLA: vale em trânsito mais antigo envolvendo a unidade (enviado por ela ou destinado a ela).
  const maisAntigo = new Map<string, Date>();
  const quebradosAoHub = new Map<string, number>();
  for (const v of transito) {
    for (const id of [v.cdId, v.unidadeId]) {
      if (!id) continue;
      const atual = maisAntigo.get(id);
      if (!atual || v.criadoEm < atual) maisAntigo.set(id, v.criadoEm);
    }
    if (v.unidade?.hub) quebradosAoHub.set(v.cdId, (quebradosAoHub.get(v.cdId) ?? 0) + v.quantidadeQuebrados);
  }
  // Ocorrências pendentes por unidade envolvida (remetente ou recebedora).
  const pendentes = new Map<string, { n: number; desde: Date }>();
  for (const o of ocorrencias) {
    for (const id of [o.cdId, o.unidadeId]) {
      if (!id) continue;
      const p = pendentes.get(id);
      pendentes.set(id, { n: (p?.n ?? 0) + 1, desde: p && p.desde < o.criadoEm ? p.desde : o.criadoEm });
    }
  }
  const atende = new Map<string, string[]>();
  for (const v of vinculos) atende.set(v.crossId, [...(atende.get(v.crossId) ?? []), v.cd.codigo]);

  const linhas: LinhaTV[] = posicao.map((p) => {
    const a = porRemetente.get(p.unidade.id);
    const antigo = maisAntigo.get(p.unidade.id);
    const oc = pendentes.get(p.unidade.id);
    const diasTransitoMaisAntigo = antigo ? idadeEmDias(antigo) : null;
    const total = p.vazios + p.quebrados;
    return {
      ...p,
      total,
      enviadosConferidos: a?.enviados ?? 0,
      recebidosConferidos: a?.recebidos ?? 0,
      acuracidade: a ? acuracidade(a.enviados, a.divergencia) : null,
      ocorrenciasPendentes: oc?.n ?? 0,
      diasTransitoMaisAntigo,
      transitoHubQuebrados: quebradosAoHub.get(p.unidade.id) ?? 0,
      cdsAtendidos: atende.get(p.unidade.id) ?? [],
      ...farolUnidade({
        tipo: p.unidade.tipo,
        diasTransitoMaisAntigo,
        saldo: total,
        ocorrenciasPendentes: oc?.n ?? 0,
        diasOcorrenciaMaisAntiga: oc ? idadeEmDias(oc.desde) : null,
      }),
    };
  });
  const cds = linhas.filter((l) => l.unidade.tipo === "CD");
  const crosses = linhas.filter((l) => l.unidade.tipo === "CROSS");
  const soma = (ls: LinhaTV[], f: (l: LinhaTV) => number) => ls.reduce((s, l) => s + f(l), 0);
  const subtotal = (ls: LinhaTV[]) => ({ bons: soma(ls, (l) => l.vazios), quebrados: soma(ls, (l) => l.quebrados), transito: soma(ls, (l) => l.transito) });

  return {
    hub: cds.find((l) => l.unidade.hub) ?? null,
    cds,
    crosses,
    totais: {
      bons: soma(linhas, (l) => l.vazios),
      quebrados: soma(linhas, (l) => l.quebrados),
      transito: soma(linhas, (l) => l.transito),
      cds: subtotal(cds),
      crosses: subtotal(crosses),
      quebradosAoHub: soma(linhas, (l) => l.transitoHubQuebrados),
      ocorrenciasPendentes: ocorrencias.length,
      ocorrenciasQuantidade: ocorrencias.reduce((s, o) => s + o.quantidade, 0),
      recebidosHoje: (hojeConf._sum.recebidoBons ?? 0) + (hojeConf._sum.recebidoQuebrados ?? 0),
      conferenciasHoje: hojeConf._count,
      acuracidade: acuracidade(geral.enviados, geral.divergencia),
      enviadosConferidos: geral.enviados,
      recebidosConferidos: geral.recebidos,
      farois: { VERMELHO: linhas.filter((l) => l.farol === "VERMELHO").length, AMARELO: linhas.filter((l) => l.farol === "AMARELO").length, VERDE: linhas.filter((l) => l.farol === "VERDE").length },
    },
  };
}

/** "Versão" global dos dados: muda a cada nova movimentação, vale ou resposta de ocorrência (refresh da TV). */
export async function versaoTV(): Promise<string> {
  const [ultimo, vales, interacoes] = await Promise.all([
    prisma.movimentacao.findFirst({ orderBy: { criadoEm: "desc" }, select: { id: true, criadoEm: true } }),
    prisma.valePallet.count(),
    prisma.ocorrenciaInteracao.count(),
  ]);
  return `${ultimo ? `${ultimo.criadoEm.getTime()}-${ultimo.id}` : "0"}-${vales}-${interacoes}`;
}
