import Link from "next/link";
import { FileSpreadsheet, FileText, Lock } from "lucide-react";
import { Fluxo, ContaTag } from "@/components/Contas";
import { Cabecalho, Painel, Tabela, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { lerFiltrosAuditoria, rotuloAcao } from "@/lib/auditoria";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Auditoria" };
const LIMITE = 300;

type Busca = { de?: string; ate?: string; usuario?: string; acao?: string };

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requirePermissao("auditoria");
  const { filtros, where, descricao } = lerFiltrosAuditoria(await searchParams);
  const [registros, total, usuarios, acoes, movimentado] = await Promise.all([
    prisma.auditoria.findMany({ where, include: { usuario: { select: { login: true, nome: true } } }, orderBy: { criadoEm: "desc" }, take: LIMITE }),
    prisma.auditoria.count({ where }),
    prisma.usuario.findMany({ select: { id: true, login: true, nome: true }, orderBy: { login: "asc" } }),
    prisma.auditoria.groupBy({ by: ["acao"], orderBy: { acao: "asc" } }),
    prisma.auditoria.aggregate({ where: { ...where, quantidade: { not: null } }, _sum: { quantidade: true } }),
  ]);
  const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString();

  return (
    <>
      <Cabecalho
        titulo="Auditoria"
        descricao="Log imutável de todas as inclusões, edições, exclusões, transferências e ajustes manuais. Registros não podem ser alterados nem apagados (bloqueio no banco de dados)."
      >
        <a href={`/api/auditoria/exportar?formato=xlsx&${qs}`} className="btn-primary"><FileSpreadsheet className="h-4 w-4" /> Exportar Excel</a>
        <a href={`/api/auditoria/exportar?formato=pdf&${qs}`} className="btn-secondary"><FileText className="h-4 w-4" /> Exportar PDF</a>
      </Cabecalho>

      <Painel className="mb-6">
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.6fr_auto] xl:items-end" action="/auditoria">
          <div>
            <label className="label" htmlFor="de">De</label>
            <input id="de" name="de" type="date" defaultValue={filtros.de} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ate">Até</label>
            <input id="ate" name="ate" type="date" defaultValue={filtros.ate} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="usuario">Usuário</label>
            <select id="usuario" name="usuario" defaultValue={filtros.usuario} className="input">
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.login} · {u.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="acao">Tipo de ação / movimentação</label>
            <select id="acao" name="acao" defaultValue={filtros.acao} className="input">
              <option value="">Todas</option>
              <option value="MOVIMENTACAO">Todas as movimentações de estoque</option>
              {acoes.map((a) => (
                <option key={a.acao} value={a.acao}>{rotuloAcao(a.acao)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="btn-primary">Filtrar</button>
            <Link href="/auditoria" className="btn-secondary">Limpar</Link>
          </div>
        </form>
      </Painel>

      <Painel
        titulo={
          <span className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-lima" /> {total} registro(s) · {formatarNumero(movimentado._sum.quantidade ?? 0)} pallet(s) movimentados
          </span>
        }
        acoes={<span className="text-[11px] text-t3">{descricao}{total > LIMITE ? ` · exibindo ${LIMITE} (exporte para ver todos)` : ""}</span>}
      >
        {registros.length === 0 ? (
          <Vazio>Nenhum registro para os filtros.</Vazio>
        ) : (
          <Tabela className="max-h-[40rem] overflow-auto">
            <table className="tabela">
              <thead className="sticky top-0">
                <tr><th>Data/Hora</th><th>Usuário</th><th>Tipo de ação</th><th>Estoque origem → destino</th><th className="text-right">Qtd.</th><th>Observação / justificativa</th></tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className={r.acao.startsWith("MOVIMENTACAO_AJUSTE") ? "bg-erro/[.06]" : undefined}>
                    <td className="num">{formatarDataHora(r.criadoEm)}</td>
                    <td>{r.usuario?.login ?? "—"}</td>
                    <td className="font-medium text-t1">{rotuloAcao(r.acao)}</td>
                    <td>
                      {r.origem && r.destino ? <Fluxo origem={r.origem} destino={r.destino} /> : r.origem ? <ContaTag conta={r.origem} /> : "—"}
                    </td>
                    <td className="num text-right font-semibold text-t1">{r.quantidade ?? "—"}</td>
                    <td className="max-w-md whitespace-normal text-t3">
                      {r.observacao ?? (r.detalhes ? <span className="num text-[11px]">{JSON.stringify(r.detalhes)}</span> : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tabela>
        )}
      </Painel>
    </>
  );
}
