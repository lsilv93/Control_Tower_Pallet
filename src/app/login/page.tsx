import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { entrar } from "@/actions/auth";
import { FormAcao } from "@/components/FormAcao";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-[14px]">
      <div className="card entrada w-full max-w-sm p-7 sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-lima text-tinta shadow-[8px_8px_17px_rgba(0,4,8,.62),-6px_-6px_15px_rgba(52,90,120,.26)]">
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
