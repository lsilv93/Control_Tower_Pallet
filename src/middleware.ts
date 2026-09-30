import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Toda rota exige sessão (token assinado e válido), exceto a tela de login.
export async function middleware(req: NextRequest) {
  const sessao = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const naLogin = req.nextUrl.pathname === "/login";

  if (!sessao && !naLogin) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  // Quem já está logado e abre /login é redirecionado pela própria página de login,
  // que consulta o banco (aqui no edge não dá para saber se o token foi revogado no Sair).
  // Páginas autenticadas não ficam em cache: após Sair, o botão Voltar não mostra dados.
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
