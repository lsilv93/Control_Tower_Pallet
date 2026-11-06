import { salvarUsuario } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "@/components/Cadastro";
import { FormAcao } from "@/components/FormAcao";
import { Painel, Tabela } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { CamposPermissao } from "@/components/CamposPermissao";
import { ehMaster, PERMISSOES, ROTULO_PERFIL } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Usuários" };
const CAMINHO = "/cadastros/usuarios";

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  const admin = await requireAdmin();
  const { editar, ok } = await searchParams;
  const [lista, editando, cds] = await Promise.all([
    prisma.usuario.findMany({
      include: { unidade: { select: { codigo: true } }, unidades: { select: { unidade: { select: { codigo: true, tipo: true, hub: true } } }, orderBy: { unidade: { codigo: "asc" } } } },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    }),
    editar ? prisma.usuario.findUnique({ where: { id: editar }, include: { unidades: { select: { unidadeId: true } } } }) : null,
    prisma.centroDistribuicao.findMany({ select: { id: true, codigo: true, nome: true, ativo: true, tipo: true, hub: true }, orderBy: [{ hub: "desc" }, { tipo: "asc" }, { codigo: "asc" }] }),
  ]);

  return (
    <>
      <BannerOk mensagem={ok} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo={editando ? `Editar ${editando.login}` : "Novo usuário"}>
          <FormAcao key={editando?.id ?? "novo"} acao={salvarUsuario} botao={editando ? "Salvar alterações" : "Criar usuário"} limpar={false}>
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <Campo nome="nome" rotulo="Nome completo" valor={editando?.nome} obrigatorio maxLength={120} />
            <Campo nome="login" rotulo="Login" valor={editando?.login} obrigatorio maxLength={40} autoComplete="off" />
            <CamposPermissao
              perfilInicial={editando?.perfil ?? "OPERADOR"}
              permissoesIniciais={editando?.permissoes ?? ["dashboard"]}
              podeMaster={ehMaster(admin)}
            />
            <fieldset className="poco p-4" data-testid="unidades-usuario">
              <legend className="label float-left !mb-3 w-full">Unidades vinculadas (CDs e Pontos de Cross) *</legend>
              <div className="clear-both grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2">
                {cds.map((cd) => (
                  <label key={cd.id} className={`flex cursor-pointer items-center gap-2 text-[12px] ${cd.ativo ? "text-t2" : "text-t4"}`}>
                    <input
                      type="checkbox"
                      name="unidadeIds"
                      value={cd.id}
                      defaultChecked={editando ? editando.unidades.some((v) => v.unidadeId === cd.id) || editando.unidadeId === cd.id : false}
                    />
                    <span>
                      <span className="num font-semibold">{cd.codigo}</span> · {cd.tipo === "CROSS" ? "Cross" : cd.hub ? "Hub" : "CD"}
                      {cd.ativo ? "" : " (inativa)"}
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-t4">
                Operadores veem e operam somente as unidades marcadas (podem ser vários CDs e/ou Pontos de Cross; com mais de uma, o usuário
                escolhe a unidade ao entrar e alterna pelo menu). Master e Administrador têm acesso a todas as unidades (Nível Brasil). Operando um
                Ponto de Cross, valem as restrições de Cross: painel, recebimento/conferência, retorno ao CD, lançar quebrado e ocorrências.
              </p>
            </fieldset>
            <Campo
              nome="senha"
              rotulo={editando ? "Nova senha (deixe em branco para manter)" : "Senha inicial"}
              obrigatorio={!editando}
              type="password"
              minLength={6}
              autoComplete="new-password"
            />
            <RodapeForm editando={!!editando} caminho={CAMINHO} />
          </FormAcao>
        </Painel>
        <Painel titulo={`Usuários (${lista.length})`} className="xl:col-span-2">
          <Tabela>
            <table className="tabela">
              <thead>
                <tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Unidades</th><th>Acessos</th><th>Situação</th><th>Criado em</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className={u.ativo ? undefined : "opacity-60"}>
                    <td className="font-medium text-t1">{u.nome}</td>
                    <td className="num">{u.login}</td>
                    <td className={u.perfil === "MASTER" ? "font-semibold text-lima" : undefined}>{ROTULO_PERFIL[u.perfil]}</td>
                    <td className="num whitespace-nowrap text-[11px]">
                      <span className="block max-w-[12rem] whitespace-normal font-semibold text-t1">
                        {(u.unidades.length ? u.unidades.map((v) => v.unidade.codigo) : [u.unidade.codigo]).join(", ")}
                      </span>
                      {u.perfil !== "OPERADOR" && <span className="block text-lima">Todas as unidades</span>}
                    </td>
                    <td className="max-w-[16rem] whitespace-normal text-[11px] text-t3">
                      {u.perfil === "OPERADOR"
                        ? u.permissoes.length
                          ? PERMISSOES.filter((p) => u.permissoes.includes(p.chave)).map((p) => p.rotulo.split(" (")[0]).join(" · ")
                          : "Nenhuma tela liberada"
                        : u.perfil === "MASTER"
                          ? "Total + configurações"
                          : "Total"}
                    </td>
                    <td><Situacao ativo={u.ativo} /></td>
                    <td className="num">{formatarDataHora(u.criadoEm)}</td>
                    <td>
                      {(ehMaster(admin) || u.perfil !== "MASTER") && (
                        <AcoesLinha tipo="usuario" id={u.id} ativo={u.ativo} caminho={CAMINHO} podeInativar={u.id !== admin.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tabela>
        </Painel>
      </div>
    </>
  );
}
