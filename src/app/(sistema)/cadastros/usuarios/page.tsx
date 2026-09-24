import { salvarUsuario } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "@/components/Cadastro";
import { FormAcao } from "@/components/FormAcao";
import { Painel, Tabela } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatarDataHora } from "@/lib/datas";
import { podeAdicionarPallets } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Usuários" };
const CAMINHO = "/cadastros/usuarios";

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  const admin = await requireAdmin();
  const { editar, ok } = await searchParams;
  const [lista, editando] = await Promise.all([
    prisma.usuario.findMany({ orderBy: [{ ativo: "desc" }, { nome: "asc" }] }),
    editar ? prisma.usuario.findUnique({ where: { id: editar } }) : null,
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
            <div>
              <label className="label" htmlFor="perfil">Nível de permissão *</label>
              <select id="perfil" name="perfil" className="input" defaultValue={editando?.perfil ?? "OPERADOR"}>
                <option value="OPERADOR">Operador</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <label className="poco flex cursor-pointer items-start gap-3 p-4">
              <input type="checkbox" name="podeAdicionarPallets" defaultChecked={editando?.podeAdicionarPallets ?? false} className="mt-0.5 flex-none" />
              <span>
                <span className="block text-[12px] font-semibold text-t1">Pode adicionar pallets</span>
                <span className="block text-[11px] text-t3">Compra e ajuste de inventário. Administradores já têm esse acesso.</span>
              </span>
            </label>
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
                <tr><th>Nome</th><th>Login</th><th>Permissão</th><th>Adicionar pallets</th><th>Situação</th><th>Criado em</th><th /></tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id} className={u.ativo ? undefined : "opacity-60"}>
                    <td className="font-medium text-t1">{u.nome}</td>
                    <td className="num">{u.login}</td>
                    <td>{u.perfil === "ADMIN" ? "Administrador" : "Operador"}</td>
                    <td>{podeAdicionarPallets(u) ? <span className="font-semibold text-lima">Sim</span> : <span className="text-t4">Não</span>}</td>
                    <td><Situacao ativo={u.ativo} /></td>
                    <td className="num">{formatarDataHora(u.criadoEm)}</td>
                    <td><AcoesLinha tipo="usuario" id={u.id} ativo={u.ativo} caminho={CAMINHO} podeInativar={u.id !== admin.id} /></td>
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
