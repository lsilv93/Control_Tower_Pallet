import type { TipoMovimentacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { numeroVale, rotuloTipo } from "@/lib/formatos";
import { Fluxo } from "./Contas";
import { Painel, Vazio } from "./ui";

/** Tabela com as últimas movimentações (trilha de auditoria: data/hora e usuário). */
export async function UltimasMovimentacoes({
  tipos,
  titulo = "Últimas movimentações",
  limite = 10,
  inicio,
  fim,
  fornecedorId,
}: {
  tipos?: TipoMovimentacao[];
  titulo?: string;
  limite?: number;
  inicio?: Date;
  fim?: Date;
  fornecedorId?: string;
}) {
  const movs = await prisma.movimentacao.findMany({
    where: {
      ...(tipos ? { tipo: { in: tipos } } : {}),
      ...(inicio && fim ? { criadoEm: { gte: inicio, lt: fim } } : {}),
      ...(fornecedorId ? { fornecedorId } : {}),
    },
    include: { usuario: true, cd: true, fornecedor: true, vale: true },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });

  return (
    <Painel titulo={titulo}>
      {movs.length === 0 ? (
        <Vazio>{inicio ? "Nenhuma movimentação no período." : "Nenhuma movimentação registrada."}</Vazio>
      ) : (
        <div className="poco overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Origem → Destino</th>
                <th className="text-right">Qtd.</th>
                <th>Referência</th>
                <th>Usuário</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td className="tabular-nums">{formatarDataHora(m.criadoEm)}</td>
                  <td>{rotuloTipo[m.tipo]}</td>
                  <td><Fluxo origem={m.origem} destino={m.destino} /></td>
                  <td className="num text-right font-semibold text-t1">{m.quantidade}</td>
                  <td>
                    {m.cd ? `${m.cd.codigo} - ${m.cd.nome}` : m.fornecedor?.nome ?? "—"}
                    {m.vale && <span className="ml-1 text-[11px] text-t4">({numeroVale(m.vale.numero)})</span>}
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
  );
}
