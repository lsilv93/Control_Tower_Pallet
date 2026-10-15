import { salvarCD } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "./Cadastro";
import { FormAcao } from "./FormAcao";
import { Painel, Tabela, Vazio } from "./ui";
import { requirePermissaoGlobal } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const config = {
  CD: { singular: "CD", plural: "Centros de Distribuição", caminho: "/cadastros/cds", novo: "Novo CD" },
  CROSS: { singular: "Ponto de Cross", plural: "Pontos de Cross-Docking", caminho: "/cadastros/cross", novo: "Novo Ponto de Cross" },
} as const;

/** Cadastro de unidades: CDs (operam o sistema e recebem envios) e Pontos de Cross (só recebem envios). */
export async function PaginaUnidades({ tipo, editar, ok }: { tipo: "CD" | "CROSS"; editar?: string; ok?: string }) {
  await requirePermissaoGlobal("cds");
  const c = config[tipo];
  const [lista, editando] = await Promise.all([
    prisma.centroDistribuicao.findMany({
      where: { tipo },
      include: { _count: { select: { usuarios: true } } },
      orderBy: [{ ativo: "desc" }, { codigo: "asc" }],
    }),
    editar ? prisma.centroDistribuicao.findFirst({ where: { id: editar, tipo } }) : null,
  ]);

  return (
    <>
      <BannerOk mensagem={ok} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo={editando ? `Editar ${editando.codigo}` : c.novo}>
          <FormAcao key={editando?.id ?? "novo"} acao={salvarCD} botao={editando ? "Salvar alterações" : "Cadastrar"} limpar={false}>
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <input type="hidden" name="tipo" value={tipo} />
            <div className="grid grid-cols-[7rem_1fr] gap-4">
              <Campo nome="codigo" rotulo="Código" valor={editando?.codigo} obrigatorio maxLength={20} className="uppercase" />
              <Campo nome="nome" rotulo="Nome" valor={editando?.nome} obrigatorio maxLength={120} />
            </div>
            <Campo nome="cidade" rotulo="Localização (cidade/UF)" valor={editando?.cidade} maxLength={120} />
            <Campo nome="responsavel" rotulo="Responsável" valor={editando?.responsavel} maxLength={120} />
            <p className="text-[11px] text-t4">
              {tipo === "CD"
                ? "CDs operam o sistema (estoques próprios) e também podem ser destino de envios. Vincule os usuários em Usuários e Permissões."
                : "Pontos de Cross recebem envios e devolvem pallets; o saldo devedor fica com o CD que enviou."}
            </p>
            <RodapeForm editando={!!editando} caminho={c.caminho} />
          </FormAcao>
        </Painel>
        <Painel titulo={`${c.plural} (${lista.length})`} className="xl:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhum {c.singular} cadastrado.</Vazio>
          ) : (
            <Tabela>
              <table className="tabela">
                <thead>
                  <tr><th>Código</th><th>Nome</th><th>Localização</th><th>Responsável</th>{tipo === "CD" && <th className="text-right">Usuários</th>}<th>Situação</th><th /></tr>
                </thead>
                <tbody>
                  {lista.map((u) => (
                    <tr key={u.id} className={u.ativo ? undefined : "opacity-60"}>
                      <td className="num font-semibold text-t1">{u.codigo}</td>
                      <td>{u.nome}</td>
                      <td>{u.cidade ?? "—"}</td>
                      <td>{u.responsavel ?? "—"}</td>
                      {tipo === "CD" && <td className="num text-right">{u._count.usuarios}</td>}
                      <td><Situacao ativo={u.ativo} /></td>
                      <td><AcoesLinha tipo="cd" id={u.id} ativo={u.ativo} caminho={c.caminho} /></td>
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
