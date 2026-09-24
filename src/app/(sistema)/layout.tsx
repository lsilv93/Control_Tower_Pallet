import { Menu } from "@/components/Menu";
import { requireUsuario } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  return (
    <div className="min-h-screen">
      <Menu usuario={usuario} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
