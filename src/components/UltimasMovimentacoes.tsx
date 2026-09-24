import type { TipoMovimentacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { numeroVale, rotuloTipo } from "@/lib/formatos";
import { Delta, Painel, Vazio } from "./ui";

/** Tabela com as últimas movimentações (trilha de auditoria: data/hora e usuário). */
export async function UltimasMovimentacoes({
  tipos,
  titulo = "Últimas movimentações",
  limite = 10,
}: {
  tipos?: TipoMovimentacao[];
  titulo?: string;
  limite?: number;
}) {
  const movs = await prisma.movimentacao.findMany({
    where: tipos ? { tipo: { in: tipos } } : undefined,
    include: { usuario: true, cd: true, fornecedor: true, vale: true },
    orderBy: { criadoEm: "desc" },
    take: limite,
  });
  const mostrarAvaria = movs.some((m) => m.deltaAvaria !== 0);

  return (
    <Painel titulo={titulo}>
      {movs.length === 0 ? (
        <Vazio>Nenhuma movimentação registrada.</Vazio>
      ) : (
        <div className="-m-5 overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Origem/Destino</th>
                <th className="text-right">Pulmão</th>
                {mostrarAvaria && <th className="text-right">Avariados</th>}
                <th>Usuário</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td className="tabular-nums">{formatarDataHora(m.criadoEm)}</td>
                  <td>{rotuloTipo[m.tipo]}</td>
                  <td>
                    {m.cd ? `${m.cd.codigo} - ${m.cd.nome}` : m.fornecedor?.nome ?? "—"}
                    {m.vale && <span className="ml-1 text-xs text-slate-400">({numeroVale(m.vale.numero)})</span>}
                  </td>
                  <td className="text-right"><Delta valor={m.deltaPulmao} /></td>
                  {mostrarAvaria && <td className="text-right"><Delta valor={m.deltaAvaria} /></td>}
                  <td>{m.usuario.login}</td>
                  <td className="max-w-xs truncate text-slate-500" title={m.observacao ?? ""}>{m.observacao ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Painel>
  );
}
