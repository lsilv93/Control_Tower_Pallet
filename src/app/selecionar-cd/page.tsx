import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, LogOut, TriangleAlert } from "lucide-react";
import { sair, selecionarCD } from "@/actions/auth";
import { BotaoTema } from "@/components/BotaoTema";
import { FormAcao } from "@/components/FormAcao";
import { requireUsuario } from "@/lib/auth";
import { ehAdmin } from "@/lib/permissoes";
import { temaAtual } from "@/lib/tema";

export const metadata: Metadata = { title: "Selecionar CD" };
export const dynamic = "force-dynamic";

/**
 * Modal obrigatório de seleção do CD de operação (usuários com mais de um CD).
 * Com um único CD a seleção é automática e esta tela não aparece.
 */
export default async function SelecionarCDPage({ searchParams }: { searchParams: Promise<{ trocar?: string }> }) {
  const [u, tema, { trocar }] = await Promise.all([requireUsuario(), temaAtual(), searchParams]);
  if (u.cds.length === 1 || (u.cd && !trocar)) redirect("/");

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#000814]/60 p-[14px]">
      <div className="absolute right-[14px] top-[14px]">
        <BotaoTema inicial={tema} />
      </div>
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-cd" className="card entrada w-full max-w-md p-7 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="fill-lima flex h-12 w-12 items-center justify-center rounded-2xl">
            <Building2 className="h-6 w-6" />
          </span>
          <div>
            <h1 id="titulo-cd" className="text-[18px] font-semibold text-t1">Em qual CD você vai operar?</h1>
            <p className="text-[12px] text-t3">Olá, {u.nome.split(" ")[0]}. Todas as operações desta sessão serão registradas no CD escolhido.</p>
          </div>
        </div>

        {u.cds.length === 0 ? (
          <div className="poco-erro flex items-start gap-3 p-4 text-[12px] text-erro-claro">
            <TriangleAlert className="mt-0.5 h-4 w-4 flex-none" />
            <div>
              <p className="font-semibold">Nenhum CD disponível para o seu usuário.</p>
              <p className="mt-1">
                {ehAdmin(u) ? (
                  <>Cadastre um CD em <Link href="/cadastros/cds" className="font-semibold underline">Cadastros → CDs</Link>.</>
                ) : (
                  "Peça a um administrador para vincular um CD ao seu usuário."
                )}
              </p>
            </div>
          </div>
        ) : (
          <FormAcao acao={selecionarCD} botao="Operar neste CD" classeBotao="btn-primary w-full" limpar={false}>
            <fieldset className="space-y-2">
              <legend className="label">CD de operação *</legend>
              {u.cds.map((cd, i) => (
                <label key={cd.id} className="poco flex cursor-pointer items-center gap-3 px-4 py-3 text-[13px] has-[:checked]:ring-1 has-[:checked]:ring-lima">
                  <input type="radio" name="cdId" value={cd.id} required defaultChecked={u.cd ? u.cd.id === cd.id : i === 0} />
                  <span className="min-w-0">
                    <span className="num font-semibold text-t1">{cd.codigo}</span> <span className="text-t2">· {cd.nome}</span>
                    {cd.cidade && <span className="block text-[11px] text-t4">{cd.cidade}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
          </FormAcao>
        )}

        <div className="mt-5 flex items-center justify-between">
          {u.cd ? <Link href="/" className="btn-secondary btn-sm">Voltar para {u.cd.codigo}</Link> : <span />}
          <form action={sair}>
            <button className="btn-secondary btn-sm"><LogOut className="h-3.5 w-3.5" /> Sair</button>
          </form>
        </div>
      </div>
    </main>
  );
}
