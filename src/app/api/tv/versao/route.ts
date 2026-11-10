import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { versaoTV } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** Consulta leve usada pela Torre de Controle (liberada a todos os usuários): só devolve a versão; a tela recarrega quando ela muda. */
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  return NextResponse.json({ versao: await versaoTV() }, { headers: { "Cache-Control": "no-store" } });
}
