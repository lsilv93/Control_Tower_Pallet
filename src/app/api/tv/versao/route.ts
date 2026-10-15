import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { tem } from "@/lib/permissoes";
import { versaoTV } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** Consulta leve usada pela Tela TV: só devolve a versão; a tela recarrega quando ela muda. */
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!tem(usuario, "tv") && !tem(usuario, "dashboard")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  if (!usuario.cd) return NextResponse.json({ erro: "Selecione o CD de operação" }, { status: 409 });
  return NextResponse.json({ versao: await versaoTV(usuario.cd.id) }, { headers: { "Cache-Control": "no-store" } });
}
