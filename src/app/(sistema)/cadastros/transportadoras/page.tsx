import { salvarTransportadora } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "@/components/Cadastro";
import { FormAcao } from "@/components/FormAcao";
import { Painel, Tabela, Vazio } from "@/components/ui";
import { formatarCnpj } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Transportadoras" };
const CAMINHO = "/cadastros/transportadoras";

export default async function TransportadorasPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  const { editar, ok } = await searchParams;
  const [lista, editando] = await Promise.all([
    prisma.transportadora.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    editar ? prisma.transportadora.findUnique({ where: { id: editar } }) : null,
  ]);

  return (
    <>
      <BannerOk mensagem={ok} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo={editando ? `Editar ${editando.nome}` : "Nova transportadora"}>
          <FormAcao key={editando?.id ?? "nova"} acao={salvarTransportadora} botao={editando ? "Salvar alterações" : "Cadastrar"} limpar={false}>
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <Campo nome="nome" rotulo="Nome / Razão social" valor={editando?.nome} obrigatorio maxLength={200} />
            <Campo nome="cnpj" rotulo="CNPJ" valor={editando ? formatarCnpj(editando.cnpj) : ""} obrigatorio placeholder="00.000.000/0000-00" className="num" />
            <Campo nome="contato" rotulo="Contato" valor={editando?.contato} maxLength={120} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo nome="telefone" rotulo="Telefone" valor={editando?.telefone} type="tel" maxLength={40} />
              <Campo nome="email" rotulo="E-mail" valor={editando?.email} type="email" maxLength={160} />
            </div>
            <RodapeForm editando={!!editando} caminho={CAMINHO} />
          </FormAcao>
        </Painel>
        <Painel titulo={`Transportadoras (${lista.length})`} className="xl:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhuma transportadora cadastrada.</Vazio>
          ) : (
            <Tabela>
              <table className="tabela">
                <thead>
                  <tr><th>Nome</th><th>CNPJ</th><th>Contato</th><th>Situação</th><th /></tr>
                </thead>
                <tbody>
                  {lista.map((t) => (
                    <tr key={t.id} className={t.ativo ? undefined : "opacity-60"}>
                      <td className="font-medium text-t1">{t.nome}</td>
                      <td className="num">{formatarCnpj(t.cnpj)}</td>
                      <td>
                        <p>{t.contato ?? "—"}</p>
                        <p className="text-[11px] text-t4">{[t.telefone, t.email].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td><Situacao ativo={t.ativo} /></td>
                      <td><AcoesLinha tipo="transportadora" id={t.id} ativo={t.ativo} caminho={CAMINHO} /></td>
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
