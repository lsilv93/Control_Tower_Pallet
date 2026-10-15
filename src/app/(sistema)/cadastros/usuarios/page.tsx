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
    prisma.usuario.findMany({ include: { cds: { select: { codigo: true } } }, orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    editar ? prisma.usuario.findUnique({ where: { id: editar }, include: { cds: { select: { id: true } } } }) : null,
    prisma.centroDistribuicao.findMany({ where: { tipo: "CD" }, select: { id: true, codigo: true, nome: true, ativo: true }, orderBy: { codigo: "asc" } }),
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
            <fieldset className="poco p-4">
              <legend className="label !mb-2">CDs em que opera</legend>
              {cds.length === 0 ? (
                <p className="text-[11px] text-t3">Nenhum CD cadastrado. Cadastre em Centros de Distribuição.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {cds.map((cd) => (
                    <label key={cd.id} className={`flex cursor-pointer items-center gap-2 text-[12px] ${cd.ativo ? "text-t2" : "text-t4"}`}>
                      <input type="checkbox" name="cds" value={cd.id} defaultChecked={editando?.cds.some((c) => c.id === cd.id) ?? false} />
                      <span><span className="num font-semibold">{cd.codigo}</span> · {cd.nome}{cd.ativo ? "" : " (inativo)"}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] text-t4">
                1 CD: selecionado automaticamente no acesso, sem troca. Mais de 1: o usuário escolhe o CD ao entrar. Operador precisa de ao menos 1 CD;
                administrador sem CD marcado opera em todos.
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
                <tr><th>Nome</th><th>Login</th><th>Perfil</th><th>CDs</th><th>Acessos</th><th>Situação</th><th>Criado em</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className={u.ativo ? undefined : "opacity-60"}>
                    <td className="font-medium text-t1">{u.nome}</td>
                    <td className="num">{u.login}</td>
                    <td className={u.perfil === "MASTER" ? "font-semibold text-lima" : undefined}>{ROTULO_PERFIL[u.perfil]}</td>
                    <td className="num max-w-[10rem] whitespace-normal text-[11px]">
                      {u.cds.length ? u.cds.map((c) => c.codigo).join(", ") : u.perfil === "OPERADOR" ? <span className="text-erro">Nenhum</span> : <span className="text-t3">Todos</span>}
                    </td>
                    <td className="max-w-[16rem] whitespace-normal text-[11px] text-t3">
                      {u.perfil === "OPERADOR"
                        ? u.permissoes.length
                          ? PERMISSOES.filter((p) => u.permissoes.includes(p.chave)).map((p) => p.rotulo.split(" (")[0]).join(" · ")
                          : "Nenhuma tela liberada"
                        : u.perfil === "MASTER"
                          ? "Total + correção de inventário"
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
