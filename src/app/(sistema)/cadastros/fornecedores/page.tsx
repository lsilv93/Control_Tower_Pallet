import { requirePermissaoGlobal } from "@/lib/auth";
import { salvarFornecedor } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, RodapeForm, Situacao } from "@/components/Cadastro";
import { CamposPadrao } from "@/components/CamposPadrao";
import { FormAcao } from "@/components/FormAcao";
import { Painel, Tabela, Vazio } from "@/components/ui";
import { formatarCnpj } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Fornecedores" };
const CAMINHO = "/cadastros/fornecedores";

export default async function FornecedoresPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  await requirePermissaoGlobal("cadastros");
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
            <CamposPadrao valores={editando ?? undefined} rotuloNome="Nome / Razão social" />
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
                  <tr><th>Nome</th><th>CNPJ</th><th>Contato responsável</th><th>Telefone / e-mail</th><th className="text-right">Vales</th><th className="text-right">Compras</th><th>Situação</th><th /></tr>
                </thead>
                <tbody>
                  {lista.map((f) => (
                    <tr key={f.id} className={f.ativo ? undefined : "opacity-60"}>
                      <td className="font-medium text-t1">{f.nome}</td>
                      <td className="num">{formatarCnpj(f.cnpj)}</td>
                      <td>{f.contato ?? "—"}</td>
                      <td>
                        <p className="num">{f.telefone ?? "—"}</p>
                        <p className="text-[11px] text-t4">{f.email}</p>
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
