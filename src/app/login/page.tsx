import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { entrar } from "@/actions/auth";
import { BotaoTema } from "@/components/BotaoTema";
import { FormAcao } from "@/components/FormAcao";
import { temaAtual } from "@/lib/tema";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const tema = await temaAtual();
  return (
    <main className="relative flex min-h-screen items-center justify-center p-[14px]">
      <div className="absolute right-[14px] top-[14px]">
        <BotaoTema inicial={tema} />
      </div>
      <div className="card entrada w-full max-w-sm p-7 sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl fill-lima">
            <Boxes className="h-7 w-7" />
          </div>
          <h1 className="text-[20px] font-semibold text-t1">Control Tower Pallet</h1>
          <p className="secao mt-1.5">Gestão de Pallets PBR</p>
        </div>
        <FormAcao acao={entrar} botao="Entrar" classeBotao="btn-primary w-full" limpar={false}>
          <div>
            <label className="label" htmlFor="login">Login</label>
            <input id="login" name="login" className="input" autoComplete="username" required autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="senha">Senha</label>
            <input id="senha" name="senha" type="password" className="input" autoComplete="current-password" required />
          </div>
        </FormAcao>
      </div>
    </main>
  );
}
