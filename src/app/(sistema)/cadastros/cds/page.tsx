import { salvarCD } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "@/components/Cadastro";
import { FormAcao } from "@/components/FormAcao";
import { Painel, Tabela, Vazio } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Centros de Distribuição" };
const CAMINHO = "/cadastros/cds";

export default async function CDsPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  await requireAdmin();
  const { editar, ok } = await searchParams;
  const [lista, editando] = await Promise.all([
    prisma.centroDistribuicao.findMany({ orderBy: [{ ativo: "desc" }, { codigo: "asc" }] }),
    editar ? prisma.centroDistribuicao.findUnique({ where: { id: editar } }) : null,
  ]);

  return (
    <>
      <BannerOk mensagem={ok} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo={editando ? `Editar ${editando.codigo}` : "Novo CD"}>
          <FormAcao key={editando?.id ?? "novo"} acao={salvarCD} botao={editando ? "Salvar alterações" : "Cadastrar"} limpar={false}>
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <div className="grid grid-cols-[7rem_1fr] gap-4">
              <Campo nome="codigo" rotulo="Código" valor={editando?.codigo} obrigatorio maxLength={20} className="uppercase" />
              <Campo nome="nome" rotulo="Nome" valor={editando?.nome} obrigatorio maxLength={120} />
            </div>
            <Campo nome="cidade" rotulo="Localização (cidade/UF)" valor={editando?.cidade} maxLength={120} />
            <Campo nome="responsavel" rotulo="Responsável" valor={editando?.responsavel} maxLength={120} />
            <RodapeForm editando={!!editando} caminho={CAMINHO} />
          </FormAcao>
        </Painel>
        <Painel titulo={`Centros de Distribuição (${lista.length})`} className="xl:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhum CD cadastrado.</Vazio>
          ) : (
            <Tabela>
              <table className="tabela">
                <thead>
                  <tr><th>Código</th><th>Nome</th><th>Localização</th><th>Responsável</th><th>Situação</th><th /></tr>
                </thead>
                <tbody>
                  {lista.map((cd) => (
                    <tr key={cd.id} className={cd.ativo ? undefined : "opacity-60"}>
                      <td className="num font-semibold text-t1">{cd.codigo}</td>
                      <td>{cd.nome}</td>
                      <td>{cd.cidade ?? "—"}</td>
                      <td>{cd.responsavel ?? "—"}</td>
                      <td><Situacao ativo={cd.ativo} /></td>
                      <td><AcoesLinha tipo="cd" id={cd.id} ativo={cd.ativo} caminho={CAMINHO} /></td>
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
