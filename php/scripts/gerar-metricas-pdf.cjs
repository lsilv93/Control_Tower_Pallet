// Gera app/Lib/pdf_metricas.php: larguras (1/1000 em) das fontes padrão do PDF por código WinAnsi
// (32..255), medidas com o próprio pdfkit. Ferramenta de desenvolvimento (rodar da raiz do repo).
const PDFDocument = require("pdfkit");
const fs = require("fs");
const doc = new PDFDocument();
const dec = new TextDecoder("windows-1252");
const fontes = ["Helvetica", "Helvetica-Bold", "Courier", "Courier-Bold"];
let out = "<?php\ndeclare(strict_types=1);\n// Gerado por scripts/gerar-metricas-pdf.cjs — larguras WinAnsi (32..255) por 1000 unidades.\nconst PDF_METRICAS = [\n";
for (const f of fontes) {
  doc.font(f).fontSize(1000);
  const w = [];
  for (let c = 32; c <= 255; c++) {
    const ch = dec.decode(new Uint8Array([c]));
    w.push(Math.round(doc.widthOfString(ch)));
  }
  out += `    '${f}' => [${w.join(",")}],\n`;
}
out += "];\n";
fs.writeFileSync("php/app/Lib/pdf_metricas.php", out);
console.log("ok");
