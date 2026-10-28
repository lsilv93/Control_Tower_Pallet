import { FormAjusteSaldo } from "./FormAjusteSaldo";
import { Abas, Cabecalho, Painel, Tabela, Vazio } from "./ui";
import { requireAdmin } from "@/lib/auth";
import { estoquesPorUnidade } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, MOTIVOS_INCLUSAO } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";
import { ContaTag } from "./Contas";

/** Ajustes manuais de saldo (administrador): inclusão e remoção em qualquer CD ou Ponto de Cross. */
export async function PaginaAjusteSaldo({ modo }: { modo: "inclusao" | "remocao" }) {
  const u = await requireAdmin();
  const tipo = modo === "inclusao" ? "INCLUSAO_MANUAL" : "REMOCAO_MANUAL";
  const [unidades, estoques, historico] = await Promise.all([
    prisma.centroDistribuicao.findMany({ where: { ativo: true }, select: { id: true, codigo: true, nome: true, tipo: true }, orderBy: [{ hub: "desc" }, { tipo: "asc" }, { codigo: "asc" }] }),
    estoquesPorUnidade(),
    prisma.movimentacao.findMany({
      where: { tipo },
      include: { usuario: { select: { nome: true } }, cd: { select: { codigo: true } } },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
  ]);
  const comSaldo = unidades.map((x) => ({ ...x, vazios: estoques.get(x.id)?.vazios ?? 0, quebrados: estoques.get(x.id)?.quebrados ?? 0 }));
  const motivo = (m: string | null) => (m && m in MOTIVOS_INCLUSAO ? MOTIVOS_INCLUSAO[m as keyof typeof MOTIVOS_INCLUSAO] : "—");

  return (
    <>
      <Cabecalho
        titulo="Ajuste de Saldo"
        descricao="Exclusivo de administradores. Inclusão manual de Pallets PBR ou Pallets Quebrados (Compra, Devolução, Ajuste Estoque ou Inventário) e remoção com justificativa, em qualquer CD ou Ponto de Cross. O saldo nunca fica negativo e tudo é registrado na auditoria."
      />
      <Abas
        ativo={`/estoque/${modo}`}
        itens={[
          { href: "/estoque/inclusao", rotulo: "Inclusão manual" },
          { href: "/estoque/remocao", rotulo: "Remoção manual" },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo={modo === "inclusao" ? "Incluir pallets" : "Remover pallets"} className="lg:col-span-2">
          <FormAjusteSaldo key={modo} modo={modo} unidades={comSaldo} unidadeInicial={u.cd?.id} />
        </Painel>
        <Painel titulo={modo === "inclusao" ? "Últimas inclusões" : "Últimas remoções"} className="lg:col-span-3">
          {historico.length === 0 ? (
            <Vazio>Nenhum lançamento.</Vazio>
          ) : (
            <Tabela>
              <table className="tabela" data-testid="historico-ajustes">
                <thead><tr><th>Data/hora</th><th>Unidade</th><th>Estoque</th><th className="text-right">Qtd.</th>{modo === "inclusao" && <th>Motivo</th>}<th>Observação</th><th>Usuário</th></tr></thead>
                <tbody>
                  {historico.map((m) => (
                    <tr key={m.id}>
                      <td className="num whitespace-nowrap">{formatarDataHora(m.criadoEm)}</td>
                      <td className="num">{m.cd.codigo}</td>
                      <td><ContaTag conta={modo === "inclusao" ? m.destino : m.origem} /></td>
                      <td className="num text-right font-semibold">{modo === "inclusao" ? "+" : "−"}{n(m.quantidade)}</td>
                      {modo === "inclusao" && <td>{motivo(m.motivo)}</td>}
                      <td className="max-w-[260px] truncate" title={m.observacao ?? ""}>{m.observacao}</td>
                      <td>{m.usuario.nome}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tabela>
          )}
        </Painel>
      </div>
    </>
  );
}
