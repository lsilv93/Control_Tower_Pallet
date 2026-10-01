import { Download, FileText } from "lucide-react";
import { Fluxo } from "@/components/Contas";
import { Cabecalho, Indicador, Painel, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { fluxo } from "@/lib/consultas";
import { prisma } from "@/lib/prisma";
import { obterSaldos } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { lerFiltros } from "@/lib/filtros";
import { formatarNumero, numeroAgenda, numeroVale, rotuloTipo } from "@/lib/formatos";

export const metadata = { title: "Relatórios" };

const LIMITE = 500;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; tipo?: string }>;
}) {
  await requirePermissao("relatorios");
  const { de, ate, tipo, periodo, where } = lerFiltros(await searchParams);
  const [movs, total, porTipo, saldos, fluxoPeriodo] = await Promise.all([
    prisma.movimentacao.findMany({
      where,
      include: { usuario: true, cd: true, fornecedor: true, vale: true, agenda: true },
      orderBy: { criadoEm: "desc" },
      take: LIMITE,
    }),
    prisma.movimentacao.count({ where }),
    prisma.movimentacao.groupBy({ by: ["tipo"], where, _sum: { quantidade: true }, _count: { _all: true } }),
    obterSaldos(),
    fluxo({ inicio: periodo.gte, fim: periodo.lt }),
  ]);
  const qs = new URLSearchParams({ de, ate, ...(tipo ? { tipo } : {}) }).toString();
  const liquido = fluxoPeriodo.entradas - fluxoPeriodo.saidas;

  return (
    <>
      <Cabecalho titulo="Relatórios" descricao="Consulta e exportação de todas as movimentações, vales, agendas e trilha de auditoria.">
        <a href={`/api/exportar?${qs}`} className="btn-success">
          <Download className="h-4 w-4" /> Exportar Excel (.xlsx)
        </a>
        <a href={`/api/exportar?${qs}&formato=csv`} className="btn-secondary">
          <FileText className="h-4 w-4" /> Movimentações (.csv)
        </a>
      </Cabecalho>

      <form className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="de">De</label>
          <input id="de" name="de" type="date" defaultValue={de} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" defaultValue={ate} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="tipo">Tipo</label>
          <select id="tipo" name="tipo" defaultValue={tipo ?? ""} className="input">
            <option value="">Todos</option>
            {Object.entries(rotuloTipo).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Aplicar filtros</button>
      </form>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Estoque de Vazios (atual)" valor={formatarNumero(saldos.vazios)} />
        <Indicador titulo="Estoque do CD (atual)" valor={formatarNumero(saldos.cd)} cor="neutro" />
        <Indicador titulo="Estoque de Quebrados (atual)" valor={formatarNumero(saldos.quebrados)} cor="ouro" />
        <Indicador
          titulo="Variação líquida no período"
          valor={liquido > 0 ? `+${liquido}` : liquido}
          detalhe={`entradas ${fluxoPeriodo.entradas} · saídas ${fluxoPeriodo.saidas} · ${total} lançamento(s)`}
          cor="neutro"
        />
      </div>

      <Painel titulo="Resumo por tipo no período" className="mb-6">
        {porTipo.length === 0 ? (
          <Vazio>Sem movimentações no período.</Vazio>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {porTipo.map((g) => (
              <div key={g.tipo} className="poco flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[12px] font-medium">{rotuloTipo[g.tipo]}</p>
                  <p className="text-[11px] text-t3">{g._count._all} lançamento(s)</p>
                </div>
                <p className="text-xl font-semibold tabular-nums">{formatarNumero(g._sum?.quantidade ?? 0)}</p>
              </div>
            ))}
          </div>
        )}
      </Painel>

      <Painel
        titulo="Movimentações"
        acoes={total > LIMITE ? <span className="text-[11px] text-t3">Exibindo {LIMITE} de {total}. Exporte para ver todas.</span> : null}
      >
        {movs.length === 0 ? (
          <Vazio>Sem movimentações no período.</Vazio>
        ) : (
          <div className="poco max-h-[36rem] overflow-auto">
            <table className="tabela">
              <thead className="sticky top-0">
                <tr>
                  <th>Data/Hora</th><th>Tipo</th><th>Origem → Destino</th><th className="text-right">Qtd.</th>
                  <th>CD / Fornecedor</th><th>Documento</th><th>Usuário</th><th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td className="tabular-nums">{formatarDataHora(m.criadoEm)}</td>
                    <td>{rotuloTipo[m.tipo]}</td>
                    <td><Fluxo origem={m.origem} destino={m.destino} /></td>
                    <td className="text-right font-semibold tabular-nums text-t1">{m.quantidade}</td>
                    <td>{m.cd ? `${m.cd.codigo} - ${m.cd.nome}` : m.fornecedor?.nome ?? "—"}</td>
                    <td className="font-mono text-[11px]">
                      {[m.vale && numeroVale(m.vale.numero), m.agenda && numeroAgenda(m.agenda.numero)].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td>{m.usuario.login}</td>
                    <td className="max-w-xs truncate text-t3" title={m.observacao ?? ""}>{m.observacao ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>

      <p className="mt-6 text-[12px] text-t3">
        A trilha completa de auditoria (com origem, destino, quantidade e justificativa) está na tela{" "}
        <a href="/auditoria" className="font-semibold text-lima hover:underline">Auditoria</a>.
      </p>
    </>
  );
}
