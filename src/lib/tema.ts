import "server-only";
import { cookies } from "next/headers";
import type { Tema } from "@/components/BotaoTema";

export async function temaAtual(): Promise<Tema> {
  return (await cookies()).get("ctp_tema")?.value === "light" ? "light" : "dark";
}
