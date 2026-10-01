import "server-only";
import PDFDocument from "pdfkit";
import bwipjs from "bwip-js/node";
import { EMISSOR } from "./emissor";
import { formatarDataHora } from "./datas";
import { formatarCnpj, formatarNumero, formatarPlaca, numeroAgenda, numeroVale, rotuloMotivoCancelamento, rotuloNf, rotuloStatusVale } from "./formatos";
import { prisma } from "./prisma";

// A4 em pontos (1 pt = 1/72 pol). Fontes padrão do PDF (WinAnsi): acentos OK; evitar "→".
const A4 = { w: 595.28, h: 841.89 };
const MM = 72 / 25.4;
const COR = { tinta: "#0A1B29", cinza: "#5A6B7B", linha: "#9AA9B6", lima: "#A9E113" };

function paraBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on("data", (p: Buffer) => partes.push(p));
    doc.on("end", () => resolve(Buffer.concat(partes)));
    doc.on("error", reject);
    doc.end();
  });
}

/** Logotipo vetorial (selo lima com pallet estilizado) + nome da empresa. */
function logotipo(doc: PDFKit.PDFDocument, x: number, y: number) {
  doc.save().roundedRect(x, y, 30, 30, 7).fill(COR.lima);
  doc.fillColor(COR.tinta);
  for (const dy of [7, 13.5, 20]) doc.rect(x + 6, y + dy, 18, 3).fill();
  for (const dx of [7, 13.5, 20]) doc.rect(x + dx, y + 7, 3, 16).fill();
  doc.restore();
  doc.fillColor(COR.tinta).font("Helvetica-Bold").fontSize(11).text(EMISSOR.nomeFantasia, x + 38, y + 3, { lineBreak: false });
  doc.font("Helvetica").fontSize(7.5).fillColor(COR.cinza).text("Control Tower Pallet · Gestão de Pallets PBR", x + 38, y + 17, { lineBreak: false });
}

/**
 * Escreve numa linha só: reduz a fonte até caber (mínimo 6,5pt) e, se ainda
 * assim não couber, corta com reticências. Nunca invade o campo vizinho.
 */
function textoAjustado(doc: PDFKit.PDFDocument, texto: string, x: number, y: number, largura: number, tamanho: number, fonte = "Helvetica-Bold") {
  let t = tamanho;
  doc.font(fonte);
  while (t > 6.5 && doc.fontSize(t).widthOfString(texto) > largura) t -= 0.25;
  let final = texto;
  if (doc.fontSize(t).widthOfString(final) > largura) {
    while (final.length > 1 && doc.widthOfString(final + "…") > largura) final = final.slice(0, -1);
    final += "…";
  }
  doc.text(final, x, y, { lineBreak: false });
}

type ValePdf = NonNullable<Awaited<ReturnType<typeof buscarVale>>>;

function buscarVale(id: string) {
  return prisma.valePallet.findUnique({
    where: { id },
    include: {
      fornecedor: true,
      criadoPor: { select: { login: true, nome: true } },
      canceladoPor: { select: { login: true } },
      agenda: true,
    },
  });
}

function via(doc: PDFKit.PDFDocument, vale: ValePdf, topo: number, nomeVia: string, barras: Buffer) {
  const x0 = 14 * MM;
  const largura = A4.w - 28 * MM;
  let y = topo + 8 * MM;

  // Identificação da via
  doc.lineWidth(1.2).strokeColor(COR.tinta).rect(x0, y, largura, 16).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COR.tinta).text(nomeVia.toUpperCase(), x0, y + 4.5, { width: largura, align: "center", characterSpacing: 2.5 });
  y += 24;

  // Cabeçalho: logotipo + emissor | código de barras + número
  logotipo(doc, x0, y);
  doc.font("Helvetica-Bold").fontSize(7).fillColor(COR.cinza).text("REMETENTE (EMISSOR)", x0, y + 36);
  const larguraEmissor = largura - 180;
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COR.tinta).text(`${EMISSOR.razaoSocial} · CNPJ ${EMISSOR.cnpj}`, x0, y + 45, { width: larguraEmissor, lineBreak: false });
  textoAjustado(doc, `${EMISSOR.endereco}, ${EMISSOR.cidade}, CEP ${EMISSOR.cep}`, x0, y + 55, larguraEmissor, 7, "Helvetica");

  const xd = x0 + largura - 165;
  doc.font("Helvetica-Bold").fontSize(15).fillColor(COR.tinta).text("VALE-PALLET PBR", xd, y, { width: 165, align: "right" });
  doc.image(barras, xd + 10, y + 20, { width: 155, height: 30 });
  doc.font("Courier-Bold").fontSize(12).text(numeroVale(vale.numero), xd, y + 53, { width: 165, align: "right", characterSpacing: 2 });
  y += 70;
  doc.moveTo(x0, y).lineTo(x0 + largura, y).lineWidth(1.5).stroke();
  y += 8;

  // Grade de dados
  const campo = (rotulo: string, valor: string, x: number, w: number, yy: number, h = 26) => {
    doc.lineWidth(0.6).strokeColor(COR.linha).rect(x, yy, w, h).stroke();
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor(COR.cinza).text(rotulo.toUpperCase(), x + 5, yy + 4, { width: w - 10 });
    doc.fillColor(COR.tinta);
    textoAjustado(doc, valor, x + 5, yy + 13, w - 10, 9.5);
  };
  const c = largura / 4;
  campo("Fornecedor", vale.fornecedor.nome, x0, c * 3, y);
  campo("CNPJ", formatarCnpj(vale.fornecedor.cnpj), x0 + c * 3, c, y);
  y += 26;
  campo("Transportadora", vale.transportadora, x0, c * 2, y);
  campo("Placa do veículo", formatarPlaca(vale.placa), x0 + c * 2, c, y);
  campo("Nota fiscal", rotuloNf(vale), x0 + c * 3, c, y);
  y += 26;
  campo("Data/hora de emissão", formatarDataHora(vale.criadoEm), x0, c * 2, y);
  campo("Emitido por", vale.criadoPor.login, x0 + c * 2, c, y);
  campo("Status atual", rotuloStatusVale[vale.status], x0 + c * 3, c, y);
  y += 26;
  const situacao =
    vale.status === "CANCELADO"
      ? `Cancelado em ${formatarDataHora(vale.canceladoEm)} por ${vale.canceladoPor?.login ?? "-"} · ${vale.motivoCancelamento ? rotuloMotivoCancelamento[vale.motivoCancelamento] : ""}`
      : vale.status === "FINALIZADO"
        ? `Baixado em ${formatarDataHora(vale.finalizadoEm)}${vale.agenda ? ` · ${numeroAgenda(vale.agenda.numero)}` : ""}`
        : vale.status === "AGENDADO" && vale.agenda
          ? `Retirada agendada para ${formatarDataHora(vale.agenda.dataPrevista)} · ${numeroAgenda(vale.agenda.numero)}`
          : "Pendente de devolução ao fornecedor";
  campo("ID único do documento", `${numeroVale(vale.numero)} · ${vale.id}`, x0, c * 2, y);
  campo("Situação", situacao, x0 + c * 2, c * 2, y);
  y += 32;

  // Quantidade e tipo
  doc.lineWidth(1.5).strokeColor(COR.tinta).rect(x0, y, largura, 30).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COR.tinta).text("QUANTIDADE E TIPO DE PALLETS RECEBIDOS", x0 + 10, y + 6);
  doc.font("Helvetica").fontSize(8).fillColor(COR.cinza).text("Pallet PBR (padrão 1,00 x 1,20 m)", x0 + 10, y + 17);
  doc.font("Helvetica-Bold").fontSize(20).fillColor(COR.tinta).text(formatarNumero(vale.quantidade), x0, y + 6, { width: largura - 12, align: "right" });
  y += 38;

  // Destaque obrigatório quando o recebimento foi feito sem nota fiscal
  if (vale.semNotaFiscal) {
    doc.lineWidth(2).strokeColor(COR.tinta).rect(x0, y, largura, 24).stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COR.tinta).text(
      'ATENÇÃO: OPERAÇÃO REALIZADA NA OPÇÃO "SEM NOTA FISCAL"',
      x0 + 8, y + 4.5, { width: largura - 16, lineBreak: false },
    );
    doc.font("Helvetica").fontSize(7).fillColor(COR.tinta).text(
      "Recebimento registrado sem documento fiscal vinculado. Conferir a origem dos pallets antes da devolução.",
      x0 + 8, y + 14, { width: largura - 16, lineBreak: false },
    );
    y += 30;
  }
  if (vale.observacao) {
    doc.fillColor(COR.tinta);
    textoAjustado(doc, `Observações: ${vale.observacao}`, x0, y, largura, 7.5, "Helvetica");
    y += 12;
  }
  doc.font("Helvetica").fontSize(6.8).fillColor(COR.cinza).text(
    "Declaramos o recebimento da quantidade de pallets PBR acima, registrada como crédito do fornecedor, a ser devolvida mediante agenda de retirada. Apresente este vale no momento da retirada.",
    x0, y, { width: largura },
  );

  // Assinaturas
  const ya = topo + A4.h / 2 - 18 * MM;
  const wa = (largura - 40) / 2;
  doc.lineWidth(0.8).strokeColor(COR.tinta);
  doc.moveTo(x0, ya).lineTo(x0 + wa, ya).stroke();
  doc.moveTo(x0 + wa + 40, ya).lineTo(x0 + largura, ya).stroke();
  if (vale.conferente) {
    doc.fillColor(COR.tinta);
    const nome = vale.conferente;
    doc.font("Helvetica-Bold").fontSize(8);
    doc.text(nome, x0, ya - 12, { width: wa, align: "center", lineBreak: false });
  }
  doc.font("Helvetica").fontSize(7.5).fillColor(COR.tinta);
  doc.text("Conferente / Recebedor", x0, ya + 4, { width: wa, align: "center" });
  doc.text("Motorista / Transportador", x0 + wa + 40, ya + 4, { width: wa, align: "center" });

  if (vale.status === "CANCELADO") {
    doc.save().rotate(-18, { origin: [A4.w / 2, topo + A4.h / 4] });
    doc.font("Helvetica-Bold").fontSize(54).fillColor("#C62828").fillOpacity(0.18).text("CANCELADO", 0, topo + A4.h / 4 - 30, { width: A4.w, align: "center" });
    doc.restore();
  }
}

/** PDF do Vale-Pallet: A4 com duas vias (Martin Brower / Fornecedor) e linha de recorte. */
export async function gerarPdfVale(id: string): Promise<{ arquivo: Buffer; nome: string } | null> {
  const vale = await buscarVale(id);
  if (!vale) return null;
  const codigo = numeroVale(vale.numero);
  const barras = await bwipjs.toBuffer({ bcid: "code128", text: codigo, scale: 4, height: 12, includetext: false, paddingwidth: 12, paddingheight: 2, backgroundcolor: "FFFFFF" });

  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Vale-Pallet ${codigo}`, Author: EMISSOR.nomeFantasia } });
  via(doc, vale, 0, "Via Martin Brower", barras);
  // linha de recorte
  doc.save().dash(4, { space: 4 }).lineWidth(0.6).strokeColor(COR.linha).moveTo(0, A4.h / 2).lineTo(A4.w, A4.h / 2).stroke().restore();
  doc.font("Helvetica").fontSize(6.5).fillColor(COR.cinza).text("recorte aqui", 0, A4.h / 2 - 3.5, { width: A4.w, align: "center" });
  via(doc, vale, A4.h / 2, "Via Fornecedor", barras);
  return { arquivo: await paraBuffer(doc), nome: `${codigo}.pdf` };
}

export type LinhaAuditoriaPdf = {
  dataHora: string;
  usuario: string;
  acao: string;
  origem: string;
  destino: string;
  quantidade: string;
  observacao: string;
};

/** Relatório de auditoria em PDF (A4 paisagem, com cabeçalho repetido por página). */
export async function gerarPdfAuditoria(linhas: LinhaAuditoriaPdf[], filtros: string, geradoPor: string): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 28, bufferPages: true, info: { Title: "Relatório de Auditoria" } });
  const W = doc.page.width - 56;
  const colunas: { k: keyof LinhaAuditoriaPdf; t: string; w: number; a?: "right" }[] = [
    { k: "dataHora", t: "Data/Hora", w: 0.12 },
    { k: "usuario", t: "Usuário", w: 0.08 },
    { k: "acao", t: "Tipo de ação", w: 0.18 },
    { k: "origem", t: "Estoque origem", w: 0.12 },
    { k: "destino", t: "Estoque destino", w: 0.12 },
    { k: "quantidade", t: "Qtd.", w: 0.06, a: "right" },
    { k: "observacao", t: "Observação / justificativa", w: 0.32 },
  ];

  const cabecalho = () => {
    logotipo(doc, 28, 24);
    doc.font("Helvetica-Bold").fontSize(14).fillColor(COR.tinta).text("Relatório de Auditoria", 0, 26, { width: doc.page.width - 28, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor(COR.cinza).text(filtros, 0, 44, { width: doc.page.width - 28, align: "right" });
    let x = 28;
    const y = 70;
    doc.rect(28, y, W, 16).fill(COR.tinta);
    for (const col of colunas) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF").text(col.t.toUpperCase(), x + 4, y + 5, { width: col.w * W - 8, align: col.a ?? "left", lineBreak: false });
      x += col.w * W;
    }
    return y + 18;
  };

  let y = cabecalho();
  linhas.forEach((l, i) => {
    const obsAltura = doc.font("Helvetica").fontSize(7.5).heightOfString(l.observacao || "-", { width: 0.32 * W - 8 });
    const h = Math.max(14, obsAltura + 6);
    if (y + h > doc.page.height - 36) {
      doc.addPage();
      y = cabecalho();
    }
    if (i % 2 === 0) doc.rect(28, y - 2, W, h).fill("#EEF3F7");
    let x = 28;
    for (const col of colunas) {
      doc.font(col.k === "acao" ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor(COR.tinta)
        .text(l[col.k] || "-", x + 4, y + 1, { width: col.w * W - 8, align: col.a ?? "left", lineBreak: col.k === "observacao" });
      x += col.w * W;
    }
    y += h;
  });
  if (!linhas.length) doc.font("Helvetica").fontSize(10).fillColor(COR.cinza).text("Nenhum registro para os filtros selecionados.", 28, y + 10);

  // Rodapé com paginação
  const paginas = doc.bufferedPageRange();
  for (let i = 0; i < paginas.count; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(7).fillColor(COR.cinza).text(
      `Gerado em ${formatarDataHora(new Date())} por ${geradoPor} · ${linhas.length} registro(s) · Página ${i + 1} de ${paginas.count}`,
      28, doc.page.height - 22, { width: W, align: "center", lineBreak: false },
    );
  }
  return paraBuffer(doc);
}
