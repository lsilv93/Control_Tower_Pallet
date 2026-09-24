import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { entrar } from "@/actions/auth";
import { FormAcao } from "@/components/FormAcao";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 rounded-xl bg-brand-600 p-3 text-white">
            <Boxes className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Control Tower Pallet</h1>
          <p className="text-sm text-slate-500">Sistema de Gestão de Pallets PBR</p>
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
