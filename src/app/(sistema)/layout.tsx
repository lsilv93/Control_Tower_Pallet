import { redirect } from "next/navigation";
import { Menu } from "@/components/Menu";
import { requireUsuario } from "@/lib/auth";
import { temaAtual } from "@/lib/tema";

export const dynamic = "force-dynamic";

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const [usuario, tema] = await Promise.all([requireUsuario(), temaAtual()]);
  // Visão global sem unidade escolhida: modal obrigatório de seleção da unidade de operação.
  if (!usuario.cd && usuario.cds.length > 0) redirect("/selecionar-cd");
  return (
    <div className="min-h-screen">
      <Menu
        usuario={{ nome: usuario.nome, login: usuario.login, perfil: usuario.perfil, permissoes: usuario.permissoes, unidade: usuario.unidade, global: usuario.global, visaoBrasil: usuario.visaoBrasil }}
        cd={usuario.cd}
        podeTrocarCD={usuario.cds.length > 1}
        tema={tema}
      />
      <main className="lg:pl-[268px]">
        <div className="entrada mx-auto max-w-7xl px-[14px] py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
