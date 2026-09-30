import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { numeroVale, rotuloMotivoCancelamento } from "@/lib/formatos";
import { Painel, Tabela, Vazio } from "./ui";

/** Histórico analítico das exclusões de vale: ID, data/hora, usuário, motivo e observação. */
export async function HistoricoExclusoes({
  limite = 20,
  titulo = "Histórico de vales excluídos",
  inicio,
  fim,
}: {
  limite?: number;
  titulo?: string;
  inicio?: Date;
  fim?: Date;
}) {
  const where = { status: "CANCELADO" as const, ...(inicio && fim ? { canceladoEm: { gte: inicio, lt: fim } } : {}) };
  const [excluidos, total] = await Promise.all([
    prisma.valePallet.findMany({
      where,
      include: { canceladoPor: { select: { login: true, nome: true } }, fornecedor: { select: { nome: true } } },
      orderBy: { canceladoEm: "desc" },
      take: limite,
    }),
    prisma.valePallet.count({ where }),
  ]);

  return (
    <Painel
      titulo={titulo}
      acoes={
        total > limite ? (
          <Link href="/vales/excluir" className="text-[11px] text-t3 hover:text-lima">
            Exibindo {limite} de {total} · ver todos
          </Link>
        ) : null
      }
    >
      {excluidos.length === 0 ? (
        <Vazio>{inicio ? "Nenhum vale excluído no período." : "Nenhum vale excluído."}</Vazio>
      ) : (
        <Tabela className="max-h-[26rem] overflow-auto">
          <table className="tabela">
            <thead className="sticky top-0">
              <tr>
                <th>ID do Vale</th>
                <th>Data/Hora Exclusão</th>
                <th>Usuário</th>
                <th>Motivo</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {excluidos.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link prefetch={false} href={`/imprimir/vale/${v.id}`} className="num font-semibold text-erro hover:underline">
                      {numeroVale(v.numero)}
                    </Link>
                    <p className="max-w-[12rem] truncate text-[11px] text-t4" title={v.fornecedor.nome}>
                      {v.fornecedor.nome} · {v.quantidade} pallet(s)
                    </p>
                  </td>
                  <td className="num">{formatarDataHora(v.canceladoEm)}</td>
                  <td>{v.canceladoPor?.login ?? "—"}</td>
                  <td className="font-medium text-t1">{v.motivoCancelamento ? rotuloMotivoCancelamento[v.motivoCancelamento] : "—"}</td>
                  <td className="max-w-xs whitespace-normal text-t3">{v.observacaoCancelamento ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tabela>
      )}
    </Painel>
  );
}
