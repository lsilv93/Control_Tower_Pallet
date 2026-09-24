import { salvarFornecedor } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "@/components/Cadastro";
import { FormAcao } from "@/components/FormAcao";
import { Painel, Tabela, Vazio } from "@/components/ui";
import { formatarCnpj } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Fornecedores" };
const CAMINHO = "/cadastros/fornecedores";

export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  const { editar, ok } = await searchParams;
  const [lista, editando] = await Promise.all([
    prisma.fornecedor.findMany({
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      include: { _count: { select: { vales: true, compras: true } } },
    }),
    editar ? prisma.fornecedor.findUnique({ where: { id: editar } }) : null,
  ]);

  return (
    <>
      <BannerOk mensagem={ok} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo={editando ? `Editar ${editando.nome}` : "Novo fornecedor"}>
          <FormAcao key={editando?.id ?? "novo"} acao={salvarFornecedor} botao={editando ? "Salvar alterações" : "Cadastrar"} limpar={false}>
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <Campo nome="nome" rotulo="Nome / Razão social" valor={editando?.nome} obrigatorio maxLength={200} />
            <Campo nome="cnpj" rotulo="CNPJ" valor={editando ? formatarCnpj(editando.cnpj) : ""} obrigatorio placeholder="00.000.000/0000-00" />
            <Campo nome="endereco" rotulo="Endereço" valor={editando?.endereco} maxLength={200} />
            <div className="grid grid-cols-[1fr_5rem] gap-4">
              <Campo nome="cidade" rotulo="Cidade" valor={editando?.cidade} maxLength={120} />
              <Campo nome="uf" rotulo="UF" valor={editando?.uf} maxLength={2} className="uppercase" />
            </div>
            <Campo nome="contato" rotulo="Contato" valor={editando?.contato} maxLength={120} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo nome="telefone" rotulo="Telefone" valor={editando?.telefone} type="tel" maxLength={40} />
              <Campo nome="email" rotulo="E-mail" valor={editando?.email} type="email" maxLength={160} />
            </div>
            <RodapeForm editando={!!editando} caminho={CAMINHO} />
          </FormAcao>
        </Painel>
        <Painel titulo={`Fornecedores (${lista.length})`} className="xl:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhum fornecedor cadastrado.</Vazio>
          ) : (
            <Tabela>
              <table className="tabela">
                <thead>
                  <tr><th>Nome</th><th>CNPJ</th><th>Localização</th><th className="text-right">Vales</th><th className="text-right">Compras</th><th>Situação</th><th /></tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id} className={f.ativo ? undefined : "opacity-60"}>
                      <td>
                        <p className="font-medium text-t1">{f.nome}</p>
                        <p className="text-[11px] text-t4">{[f.contato, f.telefone, f.email].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="num">{formatarCnpj(f.cnpj)}</td>
                      <td>
                        <p>{[f.cidade, f.uf].filter(Boolean).join("/") || "—"}</p>
                        <p className="max-w-[14rem] truncate text-[11px] text-t4">{f.endereco}</p>
                      </td>
                      <td className="num text-right">{f._count.vales}</td>
                      <td className="num text-right">{f._count.compras}</td>
                      <td><Situacao ativo={f.ativo} /></td>
                      <td><AcoesLinha tipo="fornecedor" id={f.id} ativo={f.ativo} caminho={CAMINHO} /></td>
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
