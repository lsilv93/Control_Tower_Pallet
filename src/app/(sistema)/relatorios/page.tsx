import { Download, FileText } from "lucide-react";
import { Cabecalho, Delta, Indicador, Painel, Vazio } from "@/components/ui";
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
  const { de, ate, tipo, periodo, where } = lerFiltros(await searchParams);
  const [movs, total, porTipo, saldos, auditoria] = await Promise.all([
    prisma.movimentacao.findMany({
      where,
      include: { usuario: true, cd: true, fornecedor: true, vale: true, agenda: true },
      orderBy: { criadoEm: "desc" },
      take: LIMITE,
    }),
    prisma.movimentacao.count({ where }),
    prisma.movimentacao.groupBy({ by: ["tipo"], where, _sum: { quantidade: true, deltaPulmao: true }, _count: true }),
    obterSaldos(),
    prisma.auditoria.findMany({ where: { criadoEm: periodo }, include: { usuario: true }, orderBy: { criadoEm: "desc" }, take: 50 }),
  ]);
  const qs = new URLSearchParams({ de, ate, ...(tipo ? { tipo } : {}) }).toString();
  const liquido = porTipo.reduce((s, g) => s + (g._sum.deltaPulmao ?? 0), 0);

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
        <Indicador titulo="Saldo atual no pulmão" valor={formatarNumero(saldos.pulmao)} />
        <Indicador titulo="Avariados em estoque" valor={formatarNumero(saldos.avaria)} cor="erro" />
        <Indicador titulo="Pendente com fornecedores" valor={formatarNumero(saldos.pendenteFornecedores)} cor="ouro" />
        <Indicador titulo="Variação líquida no período" valor={liquido > 0 ? `+${liquido}` : liquido} detalhe={`${total} movimentação(ões)`} cor="neutro" />
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
                  <p className="text-[11px] text-t3">{g._count} lançamento(s)</p>
                </div>
                <p className="text-xl font-semibold tabular-nums">{formatarNumero(g._sum.quantidade ?? 0)}</p>
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
                  <th>Data/Hora</th><th>Tipo</th><th className="text-right">Qtd.</th><th className="text-right">Pulmão</th>
                  <th className="text-right">Avariados</th><th>CD / Fornecedor</th><th>Documento</th><th>Usuário</th><th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td className="tabular-nums">{formatarDataHora(m.criadoEm)}</td>
                    <td>{rotuloTipo[m.tipo]}</td>
                    <td className="text-right tabular-nums">{m.quantidade}</td>
                    <td className="text-right"><Delta valor={m.deltaPulmao} /></td>
                    <td className="text-right"><Delta valor={m.deltaAvaria} /></td>
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

      <Painel titulo="Trilha de auditoria (últimos 50 registros do período)" className="mt-6">
        {auditoria.length === 0 ? (
          <Vazio>Sem registros.</Vazio>
        ) : (
          <div className="poco max-h-[24rem] overflow-auto">
            <table className="tabela">
              <thead className="sticky top-0"><tr><th>Data/Hora</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr></thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id}>
                    <td className="tabular-nums">{formatarDataHora(a.criadoEm)}</td>
                    <td>{a.usuario?.login ?? "—"}</td>
                    <td className="font-mono text-[11px]">{a.acao}</td>
                    <td>{a.entidade}</td>
                    <td className="max-w-md truncate font-mono text-[11px] text-t3">{a.detalhes ? JSON.stringify(a.detalhes) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </>
  );
}
