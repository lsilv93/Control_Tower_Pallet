import { PaginaUnidades } from "@/components/PaginaUnidades";

export const metadata = { title: "Pontos de Cross" };

export default async function CrossPage({ searchParams }: { searchParams: Promise<{ editar?: string; ok?: string }> }) {
  const { editar, ok } = await searchParams;
  return <PaginaUnidades tipo="CROSS" editar={editar} ok={ok} />;
}
