import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Toda rota exige sessão, exceto a tela de login.
export async function middleware(req: NextRequest) {
  const sessao = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const naLogin = req.nextUrl.pathname === "/login";

  if (!sessao && !naLogin) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (sessao && naLogin) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
