import { PaginaEnvio } from "@/components/PaginaEnvio";

export const metadata = { title: "Envio para Ponto de Cross" };

export default function Page() {
  return <PaginaEnvio tipo="CROSS" />;
}
