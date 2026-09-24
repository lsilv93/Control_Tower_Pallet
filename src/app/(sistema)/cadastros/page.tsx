import { alternarCD, alternarUsuario, ajustarInventario, criarCD, criarUsuario, redefinirSenha } from "@/actions/cadastros";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Painel, Vazio } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import { formatarCnpj, formatarNumero } from "@/lib/formatos";

export const metadata = { title: "Cadastros" };

export default async function CadastrosPage() {
  const admin = await requireAdmin();
  const [cds, usuarios, fornecedores, saldos] = await Promise.all([
    prisma.centroDistribuicao.findMany({ orderBy: { codigo: "asc" } }),
    prisma.usuario.findMany({ orderBy: { nome: "asc" } }),
    prisma.fornecedor.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { vales: true } } } }),
    obterSaldos(),
  ]);

  return (
    <>
      <Cabecalho titulo="Cadastros" descricao="Centros de distribuição, usuários, fornecedores e ajustes de inventário (administrador)." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Painel titulo="Centros de Distribuição">
          <FormAcao acao={criarCD} className="mb-5 grid gap-3 sm:grid-cols-4" botao="Adicionar" classeBotao="btn-primary sm:col-span-4">
            <input name="codigo" className="input" placeholder="Código *" required maxLength={20} />
            <input name="nome" className="input sm:col-span-2" placeholder="Nome do CD *" required maxLength={120} />
            <input name="cidade" className="input" placeholder="Cidade" maxLength={120} />
          </FormAcao>
          {cds.length === 0 ? (
            <Vazio>Nenhum CD cadastrado.</Vazio>
          ) : (
            <div className="poco overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Código</th><th>Nome</th><th>Cidade</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {cds.map((cd) => (
                  <tr key={cd.id} className={cd.ativo ? undefined : "opacity-50"}>
                    <td className="num font-semibold text-t1">{cd.codigo}</td>
                    <td>{cd.nome}</td>
                    <td>{cd.cidade ?? "—"}</td>
                    <td>{cd.ativo ? "Ativo" : "Inativo"}</td>
                    <td className="text-right">
                      <FormAcao acao={alternarCD} className="inline" botao={cd.ativo ? "Inativar" : "Ativar"} classeBotao="btn-secondary btn-sm">
                        <input type="hidden" name="id" value={cd.id} />
                      </FormAcao>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Painel>

        <Painel titulo="Ajuste de inventário">
          <p className="mb-4 text-[12px] leading-relaxed text-t3">
            Use para lançar o saldo inicial ou corrigir divergências de contagem física. Saldo atual no pulmão:{" "}
            <strong className="num text-t1">{formatarNumero(saldos.pulmao)}</strong>.
          </p>
          <FormAcao acao={ajustarInventario} botao="Lançar ajuste" confirmar="Confirmar o ajuste de inventário?">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="sentido">Tipo</label>
                <select id="sentido" name="sentido" className="input">
                  <option value="ENTRADA">Entrada (+)</option>
                  <option value="SAIDA">Saída (−)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="qtdAjuste">Quantidade</label>
                <input id="qtdAjuste" name="quantidade" type="number" min={1} step={1} className="input" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="obsAjuste">Justificativa *</label>
              <input id="obsAjuste" name="observacao" className="input" required minLength={5} maxLength={500} />
            </div>
          </FormAcao>
        </Painel>

        <Painel titulo="Usuários" className="xl:col-span-2">
          <FormAcao acao={criarUsuario} className="mb-5 grid gap-3 sm:grid-cols-5" botao="Criar usuário" classeBotao="btn-primary sm:col-span-5">
            <input name="nome" className="input sm:col-span-2" placeholder="Nome completo *" required />
            <input name="login" className="input" placeholder="Login *" required />
            <input name="senha" type="password" className="input" placeholder="Senha inicial *" required minLength={6} autoComplete="new-password" />
            <select name="perfil" className="input" defaultValue="OPERADOR">
              <option value="OPERADOR">Operador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </FormAcao>
          <div className="poco overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Situação</th><th>Criado em</th><th>Redefinir senha</th><th /></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.ativo ? undefined : "opacity-50"}>
                    <td>{u.nome}</td>
                    <td className="font-mono">{u.login}</td>
                    <td>{u.perfil === "ADMIN" ? "Administrador" : "Operador"}</td>
                    <td>{u.ativo ? "Ativo" : "Inativo"}</td>
                    <td>{formatarDataHora(u.criadoEm)}</td>
                    <td>
                      <FormAcao acao={redefinirSenha} className="flex items-center gap-2" botao="OK" classeBotao="btn-secondary btn-sm">
                        <input type="hidden" name="id" value={u.id} />
                        <input name="senha" type="password" className="input !min-h-[36px] w-36 !py-1" placeholder="Nova senha" minLength={6} required autoComplete="new-password" />
                      </FormAcao>
                    </td>
                    <td className="text-right">
                      {u.id !== admin.id && (
                        <FormAcao acao={alternarUsuario} className="inline" botao={u.ativo ? "Inativar" : "Ativar"} classeBotao="btn-secondary btn-sm">
                          <input type="hidden" name="id" value={u.id} />
                        </FormAcao>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Painel>

        <Painel titulo="Fornecedores" className="xl:col-span-2">
          <p className="mb-3 text-[12px] text-t3">Fornecedores são cadastrados automaticamente na entrada (pelo CNPJ).</p>
          {fornecedores.length === 0 ? (
            <Vazio>Nenhum fornecedor cadastrado.</Vazio>
          ) : (
            <div className="poco overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Nome</th><th>CNPJ</th><th className="text-right">Vales emitidos</th><th>Cadastrado em</th></tr></thead>
                <tbody>
                  {fornecedores.map((f) => (
                    <tr key={f.id}>
                      <td>{f.nome}</td>
                      <td className="font-mono">{formatarCnpj(f.cnpj)}</td>
                      <td className="text-right">{f._count.vales}</td>
                      <td>{formatarDataHora(f.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Painel>
      </div>
    </>
  );
}
