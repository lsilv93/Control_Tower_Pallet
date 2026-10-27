import { NextResponse } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { tem } from "@/lib/permissoes";
import { versaoTV } from "@/lib/tv";

export const dynamic = "force-dynamic";

/** Consulta leve usada pela TV Nível Brasil: só devolve a versão; a tela recarrega quando ela muda. */
export async function GET() {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!usuario.global || (!tem(usuario, "tv") && !tem(usuario, "dashboard"))) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  return NextResponse.json({ versao: await versaoTV() }, { headers: { "Cache-Control": "no-store" } });
}
