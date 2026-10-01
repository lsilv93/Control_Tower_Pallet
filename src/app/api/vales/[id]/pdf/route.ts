import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { gerarPdfVale } from "@/lib/pdf";
import { tem } from "@/lib/permissoes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Download (ou visualização, com ?inline=1) do PDF do Vale-Pallet. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!(["vales", "entrada", "agendas", "excluir_vale"] as const).some((p) => tem(usuario, p))) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }
  try {
    const pdf = await gerarPdfVale((await params).id);
    if (!pdf) return NextResponse.json({ erro: "Vale não encontrado" }, { status: 404 });
    const inline = req.nextUrl.searchParams.get("inline") === "1";
    return new NextResponse(new Uint8Array(pdf.arquivo), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${pdf.nome}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Falha ao gerar o PDF do vale." }, { status: 500 });
  }
}
