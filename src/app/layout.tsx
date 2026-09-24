import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Control Tower Pallet", template: "%s · Control Tower Pallet" },
  description: "Sistema de Gestão de Pallets PBR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
