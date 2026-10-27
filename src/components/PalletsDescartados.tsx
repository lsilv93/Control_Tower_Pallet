import { Lock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, rotuloTipo } from "@/lib/formatos";
import { ContaTag } from "./Contas";
import { Painel, Tabela, Vazio } from "./ui";

/**
 * Pallets Descartados: registro imutável (o banco bloqueia UPDATE/DELETE no livro) de
 * cada descarte, inclusive os desmontados no reparo. Visão global vê todas as unidades.
 */
export async function PalletsDescartados({ cdId, global, limite = 50 }: { cdId: string; global: boolean; limite?: number }) {
  const where = { tipo: { in: ["DESCARTE" as const, "CANIBALIZACAO" as const] }, ...(global ? {} : { cdId }) };
  const [movs, total] = await Promise.all([
    prisma.movimentacao.findMany({
      where,
      include: { usuario: { select: { nome: true } }, cd: { select: { codigo: true } } },
      orderBy: { criadoEm: "desc" },
      take: limite,
    }),
    prisma.movimentacao.aggregate({ where, _sum: { quantidade: true } }),
  ]);
  return (
    <Painel
      titulo={
        <>
          <Lock className="h-4 w-4 text-t3" /> Pallets Descartados {global ? "(todas as unidades)" : ""}
        </>
      }
      acoes={<span className="text-[11px] text-t3">Total: <strong className="num text-t1" data-testid="total-descartados">{n(total._sum.quantidade ?? 0)}</strong></span>}
    >
      {movs.length === 0 ? (
        <Vazio>Nenhum descarte registrado.</Vazio>
      ) : (
        <Tabela>
          <table className="tabela" data-testid="pallets-descartados">
            <thead><tr><th>Data/hora</th>{global && <th>Unidade</th>}<th>Tipo</th><th>Estoque</th><th className="text-right">Qtd.</th><th>Justificativa</th><th>Usuário</th></tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td className="num whitespace-nowrap">{formatarDataHora(m.criadoEm)}</td>
                  {global && <td className="num">{m.cd.codigo}</td>}
                  <td>{rotuloTipo[m.tipo]}</td>
                  <td><ContaTag conta={m.origem} /></td>
                  <td className="num text-right font-semibold">{n(m.quantidade)}</td>
                  <td className="max-w-[260px] truncate" title={m.observacao ?? ""}>{m.observacao ?? "—"}</td>
                  <td>{m.usuario.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tabela>
      )}
      <p className="mt-3 text-[11px] text-t4">Registros imutáveis: o banco de dados bloqueia qualquer alteração ou exclusão.</p>
    </Painel>
  );
}
