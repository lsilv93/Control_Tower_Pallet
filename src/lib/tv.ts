import "server-only";
import { enviosEmTransito, posicaoUnidades } from "./consultas";
import { diaLocal, fimDoDia, inicioDoDia } from "./datas";
import { prisma } from "./prisma";

/**
 * Acuracidade das remessas: 1 − Σ|recebido − declarado| / Σdeclarado, sobre as conferências
 * em que a unidade foi a remetente. Faltas e sobras reduzem a taxa. null = sem conferência.
 */
function acuracidade(declarado: number, divergencia: number) {
  return declarado > 0 ? Math.max(0, 1 - divergencia / declarado) : null;
}

/** Indicadores da Torre de Controle Nível Brasil (sem dados de fornecedores). */
export async function dadosTV() {
  const hoje = diaLocal();
  const [posicao, transito, conferencias, hoje_, ocorrencias] = await Promise.all([
    posicaoUnidades(),
    enviosEmTransito(),
    prisma.conferencia.findMany({ select: { remetenteId: true, totalDeclarado: true, recebidoBons: true, recebidoQuebrados: true, diferenca: true } }),
    prisma.conferencia.aggregate({ where: { criadoEm: { gte: inicioDoDia(hoje), lt: fimDoDia(hoje) } }, _sum: { recebidoBons: true, recebidoQuebrados: true }, _count: true }),
    prisma.valePallet.aggregate({ where: { tipo: "OCORRENCIA", ocorrencia: "FALTA", status: "PENDENTE" }, _sum: { quantidade: true }, _count: true }),
  ]);
  const hub = posicao.find((p) => p.unidade.hub) ?? null;

  // Acuracidade por remetente.
  const porRemetente = new Map<string, { enviados: number; recebidos: number; divergencia: number }>();
  for (const c of conferencias) {
    const a = porRemetente.get(c.remetenteId) ?? { enviados: 0, recebidos: 0, divergencia: 0 };
    a.enviados += c.totalDeclarado;
    a.recebidos += c.recebidoBons + c.recebidoQuebrados;
    a.divergencia += Math.abs(c.diferenca);
    porRemetente.set(c.remetenteId, a);
  }
  const totalAcur = [...porRemetente.values()].reduce((s, a) => ({ enviados: s.enviados + a.enviados, recebidos: s.recebidos + a.recebidos, divergencia: s.divergencia + a.divergencia }), { enviados: 0, recebidos: 0, divergencia: 0 });

  // Em trânsito para o Hub, por filial remetente.
  const paraHub = new Map<string, { bons: number; quebrados: number; vales: number }>();
  for (const v of transito) {
    if (!v.unidade?.hub) continue;
    const t = paraHub.get(v.cdId) ?? { bons: 0, quebrados: 0, vales: 0 };
    t.bons += v.quantidadeBons;
    t.quebrados += v.quantidadeQuebrados;
    t.vales += 1;
    paraHub.set(v.cdId, t);
  }

  const filiais = posicao
    .filter((p) => !p.unidade.hub)
    .map((p) => {
      const a = porRemetente.get(p.unidade.id);
      const t = paraHub.get(p.unidade.id);
      return {
        ...p,
        transitoHubBons: t?.bons ?? 0,
        transitoHubQuebrados: t?.quebrados ?? 0,
        valesHub: t?.vales ?? 0,
        enviadosConferidos: a?.enviados ?? 0,
        recebidosConferidos: a?.recebidos ?? 0,
        acuracidade: a ? acuracidade(a.enviados, a.divergencia) : null,
      };
    });

  const soma = (f: (p: (typeof posicao)[number]) => number) => posicao.reduce((s, p) => s + f(p), 0);
  return {
    hub,
    posicao,
    filiais,
    totais: {
      bons: soma((p) => p.vazios),
      quebrados: soma((p) => p.quebrados),
      transito: soma((p) => p.transito),
      unidades: posicao.length,
      crosses: posicao.filter((p) => p.unidade.tipo === "CROSS").length,
      foraHubBons: filiais.reduce((s, f) => s + f.vazios, 0),
      foraHubQuebrados: filiais.reduce((s, f) => s + f.quebrados, 0),
      transitoHubQuebrados: filiais.reduce((s, f) => s + f.transitoHubQuebrados, 0),
      transitoHubBons: filiais.reduce((s, f) => s + f.transitoHubBons, 0),
      valesHub: filiais.reduce((s, f) => s + f.valesHub, 0),
      ocorrenciasAbertas: ocorrencias._sum.quantidade ?? 0,
      valesOcorrencia: ocorrencias._count,
      recebidosHoje: (hoje_._sum.recebidoBons ?? 0) + (hoje_._sum.recebidoQuebrados ?? 0),
      conferenciasHoje: hoje_._count,
      acuracidade: acuracidade(totalAcur.enviados, totalAcur.divergencia),
      enviadosConferidos: totalAcur.enviados,
      recebidosConferidos: totalAcur.recebidos,
    },
  };
}

/** "Versão" global dos dados: muda a cada nova movimentação em qualquer unidade (refresh da TV). */
export async function versaoTV(): Promise<string> {
  const ultimo = await prisma.movimentacao.findFirst({ orderBy: { criadoEm: "desc" }, select: { id: true, criadoEm: true } });
  const vales = await prisma.valePallet.count();
  return ultimo ? `${ultimo.criadoEm.getTime()}-${ultimo.id}-${vales}` : `0-${vales}`;
}
