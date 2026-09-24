import type { Metadata } from "next";
import "./globals.css";
import { temaAtual } from "@/lib/tema";

export const metadata: Metadata = {
  title: { default: "Control Tower Pallet", template: "%s · Control Tower Pallet" },
  description: "Sistema de Gestão de Pallets PBR",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = await temaAtual();
  return (
    <html lang="pt-BR" data-theme={tema}>
      <body>{children}</body>
    </html>
  );
}
