import { PaginaUnidades } from "@/components/PaginaUnidades";

export const metadata = { title: "Centros de Distribuição" };

export default async function CDsPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  const { editar, ok } = await searchParams;
  return <PaginaUnidades tipo="CD" editar={editar} ok={ok} />;
}
