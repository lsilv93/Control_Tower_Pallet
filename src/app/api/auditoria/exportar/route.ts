import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { lerFiltrosAuditoria, rotuloAcao } from "@/lib/auditoria";
import { auditar, ROTULO_CONTA } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { gerarPdfAuditoria, type LinhaAuditoriaPdf } from "@/lib/pdf";
import { tem } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const MAXIMO = 20000;

/** Exporta a auditoria (mesmos filtros da tela) em Excel ou PDF. */
export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!tem(usuario, "auditoria")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const formato = sp.get("formato") === "pdf" ? "pdf" : "xlsx";
  const { filtros, where, descricao } = lerFiltrosAuditoria({ de: sp.get("de"), ate: sp.get("ate"), usuario: sp.get("usuario"), acao: sp.get("acao") });

  try {
    const registros = await prisma.auditoria.findMany({
      where,
      include: { usuario: { select: { login: true } } },
      orderBy: { criadoEm: "asc" },
      take: MAXIMO,
    });
    const linhas: LinhaAuditoriaPdf[] = registros.map((r) => ({
      dataHora: formatarDataHora(r.criadoEm),
      usuario: r.usuario?.login ?? "",
      acao: rotuloAcao(r.acao),
      origem: r.origem ? ROTULO_CONTA[r.origem] : "",
      destino: r.destino ? ROTULO_CONTA[r.destino] : "",
      quantidade: r.quantidade?.toString() ?? "",
      observacao: r.observacao ?? (r.detalhes ? JSON.stringify(r.detalhes) : ""),
    }));
    // A própria exportação também fica registrada (após a leitura, para não entrar no arquivo).
    await auditar(prisma, { acao: "EXPORTAR_AUDITORIA", entidade: "Auditoria", usuarioId: usuario.id, detalhes: { ...filtros, formato, registros: linhas.length } });
    const nome = `auditoria_${filtros.de}_a_${filtros.ate}`;

    if (formato === "pdf") {
      const pdf = await gerarPdfAuditoria(linhas, descricao, usuario.login);
      return new NextResponse(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nome}.pdf"`, "Cache-Control": "no-store" },
      });
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = `Control Tower Pallet (${usuario.login})`;
    const ws = wb.addWorksheet("Auditoria", { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = [
      { header: "Data/Hora", key: "dataHora", width: 20 },
      { header: "Usuário", key: "usuario", width: 14 },
      { header: "Tipo de ação", key: "acao", width: 38 },
      { header: "Estoque origem", key: "origem", width: 22 },
      { header: "Estoque destino", key: "destino", width: 22 },
      { header: "Quantidade", key: "quantidade", width: 12 },
      { header: "Observação / justificativa", key: "observacao", width: 70 },
    ];
    ws.addRows(linhas.map((l) => ({ ...l, quantidade: l.quantidade ? Number(l.quantidade) : "" })));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A1B29" } };
    if (linhas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nome}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ erro: "Falha ao exportar a auditoria." }, { status: 500 });
  }
}
