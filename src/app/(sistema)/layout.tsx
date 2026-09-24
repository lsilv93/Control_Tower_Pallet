import { Menu } from "@/components/Menu";
import { requireUsuario } from "@/lib/auth";
import { temaAtual } from "@/lib/tema";

export const dynamic = "force-dynamic";

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const [usuario, tema] = await Promise.all([requireUsuario(), temaAtual()]);
  return (
    <div className="min-h-screen">
      <Menu usuario={usuario} tema={tema} />
      <main className="lg:pl-[268px]">
        <div className="entrada mx-auto max-w-7xl px-[14px] py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
