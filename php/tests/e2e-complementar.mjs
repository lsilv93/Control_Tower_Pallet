// E2E complementar da versão PHP: compra por NF-e, recebimento de fornecedor (com/sem NF),
// agenda (leitor óptico, validação e cancelamento), exclusão de vale, senha, relatórios e exportações.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3200";
const q = (sql) => execFileSync("mysql", [`-u${process.env.DB_USER ?? "pallet"}`, `-p${process.env.DB_PASS ?? "pallet"}`, process.env.DB_NAME ?? "pallet", "-N", "-B", "-e", sql], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
q("UPDATE CentroDistribuicao SET recebimentoFornecedor = 1 WHERE codigo = 'CDJC'");
const browser = await chromium.launch();
const resultados = [];
const errosJs = [];
async function etapa(nome, fn) {
  try { await fn(); resultados.push(["OK", nome]); console.log("OK  ", nome); }
  catch (e) { resultados.push(["FALHA", nome]); console.log("FALHA", nome, "\n   ", e.message.split("\n").slice(0, 4).join("\n    ")); }
}
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
p.setDefaultTimeout(15000);
p.on("pageerror", (e) => errosJs.push(e.message));
p.on("dialog", (d) => d.accept());
await p.goto(`${BASE}/login`);
await p.fill("#login", "admin"); await p.fill("#senha", "admin123"); await p.click("button[type=submit]");
await p.waitForURL(/selecionar-cd/);
await p.locator("label", { hasText: "CDJC" }).first().click();
await p.click("button:has-text('Operar nesta unidade')");
await p.waitForURL((u) => !u.pathname.startsWith("/selecionar"));
const saldo = async () => Number((await p.locator("[data-testid=saldo-vazios]").innerText()).replace(/\D/g, ""));
const chaveNova = () => p.evaluate(async () => (await CTP.acao("/acao/pallets/simular-nfe", new FormData())).chave);

await etapa("Compra: NF de fornecedor novo abre cadastro rápido, registra e soma ao estoque", async () => {
  await p.goto(`${BASE}/pallets/adicionar`);
  const antes = await saldo();
  await p.click("[data-simular=novo]");
  await p.waitForSelector("[role=dialog] >> text=ainda não está cadastrado");
  assert.match(await p.locator("[role=dialog] p.input").innerText(), /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  await p.fill("[role=dialog] input[name=sigla]", "FNOVO");
  await p.fill("[role=dialog] input[name=nome]", "Fornecedor Novo Ltda");
  await p.click("[role=dialog] button[type=submit]");
  await p.waitForSelector("#quantidadeCompra");
  assert.match(await p.locator("[data-nf]").innerText(), /Fornecedor Novo Ltda/);
  await p.fill("#quantidadeCompra", "50");
  await p.click("button:has-text('Registrar compra')");
  await p.waitForSelector("[data-ultima]:not([hidden]) >> text=Compra registrada: 50 pallet(s)");
  assert.equal(await saldo(), antes + 50);
});

await etapa("Compra: mesma NF não pode ser lançada duas vezes", async () => {
  const chave = q("SELECT chaveAcesso FROM Compra ORDER BY criadoEm DESC LIMIT 1");
  await p.fill("#leitura", chave);
  await p.click("button:has-text('Identificar')");
  await p.waitForSelector("[data-erro]:not([hidden]) >> text=já foi lançada");
});

let valeNf;
await etapa("Recebimento fornecedor com NF: CNPJ novo → cadastro → gera vale e abre impressão", async () => {
  await p.goto(`${BASE}/fornecedor/entrada`);
  const enviar = p.locator("form[data-recebimento-fornecedor] button[type=submit]");
  assert.equal(await enviar.isDisabled(), true);
  assert.match(await enviar.innerText(), /Leia a NF/);
  const chave = await chaveNova();
  await p.fill("#chave", chave); // 44 dígitos: identifica sem Enter
  await p.waitForSelector("[role=dialog] >> text=não está cadastrado");
  await p.fill("[role=dialog] input[name=sigla]", "FREC");
  await p.fill("[role=dialog] input[name=nome]", "Fornecedor Recebimento SA");
  await p.click("[role=dialog] button[type=submit]");
  await p.waitForSelector("text=Fornecedor encontrado no cadastro");
  assert.equal(await enviar.isDisabled(), false);
  await p.fill("#quantidade", "40");
  await p.selectOption("#transportadoraId", { index: 1 });
  await p.fill("#placa", "abc1d23");
  await enviar.click();
  await p.waitForURL(/\/imprimir\/vale\/.+\?auto=1/);
  valeNf = p.url().split("/imprimir/vale/")[1].split("?")[0];
  assert.match(await p.locator("body").innerText(), /VALE-PALLET PBR[\s\S]*Fornecedor Recebimento SA/);
});

await etapa("Recebimento fornecedor: NF já recebida é recusada", async () => {
  await p.goto(`${BASE}/fornecedor/entrada`);
  const chave = q(`SELECT chaveNfe FROM ValePallet WHERE id = '${valeNf}'`);
  await p.fill("#chave", chave);
  await p.waitForSelector("[data-erro]:not([hidden]) >> text=Esta NF já foi recebida");
});

let valeSemNf;
await etapa("Recebimento fornecedor Sem Nota Fiscal: lista de fornecedores e destaque no vale", async () => {
  await p.goto(`${BASE}/fornecedor/entrada`);
  await p.check("[data-sem-nf]");
  assert.equal(await p.locator("[data-bloco-nf]").isHidden(), true);
  await p.selectOption("#fornecedorId", { label: "FNOVO - Fornecedor Novo Ltda" });
  await p.fill("#quantidade", "12");
  await p.selectOption("#transportadoraId", { index: 1 });
  await p.fill("#placa", "ABC1234");
  await p.click("form[data-recebimento-fornecedor] button[type=submit]");
  await p.waitForURL(/\/imprimir\/vale\//);
  valeSemNf = p.url().split("/imprimir/vale/")[1].split("?")[0];
  assert.match(await p.locator("body").innerText(), /SEM NOTA FISCAL/);
});

await etapa("Agenda: leitor óptico seleciona o vale e gera a agenda de retirada", async () => {
  await p.goto(`${BASE}/vales`);
  const cod = await p.locator(`tr[data-id='${valeNf}']`).getAttribute("data-codigo");
  await p.fill("[data-leitor-vale] input", cod);
  await p.press("[data-leitor-vale] input", "Enter");
  await p.waitForSelector(`[data-leitor-msg]:not([hidden]) >> text=${cod} selecionado para a agenda`);
  assert.match(await p.locator("[data-resumo]").innerText(), /1 vale\(s\) · 40 pallet\(s\)/);
  await p.click("[data-agendar]");
  await p.click("button:has-text('Confirmar agendamento')");
  await p.waitForSelector("[data-form-agendar] >> text=Retirada agendada");
  assert.equal(q(`SELECT status FROM ValePallet WHERE id = '${valeNf}'`), "AGENDADO");
});

await etapa("Agenda: cancelar devolve os vales para Pendente; nova agenda e validação dão baixa", async () => {
  await p.goto(`${BASE}/agendas`);
  await p.click("button:has-text('Cancelar')");
  await p.waitForURL(/agendas\?ok=.*cancelada/);
  assert.equal(q(`SELECT status FROM ValePallet WHERE id = '${valeNf}'`), "PENDENTE");
  await p.goto(`${BASE}/vales`);
  await p.check(`tr[data-id='${valeNf}'] input[name=valeIds]`);
  await p.click("[data-agendar]");
  await p.click("button:has-text('Confirmar agendamento')");
  await p.waitForSelector("[data-form-agendar] >> text=Retirada agendada");
  await p.goto(`${BASE}/`);
  const antes = await saldo();
  await p.goto(`${BASE}/agendas`);
  await p.click("button:has-text('Validar e dar baixa')");
  await p.waitForURL(/agendas\?ok=/);
  assert.equal(q(`SELECT status FROM ValePallet WHERE id = '${valeNf}'`), "FINALIZADO");
  await p.goto(`${BASE}/`);
  assert.equal(await saldo(), antes - 40);
});

await etapa("Excluir vale: motivo obrigatório, estorna e fica no histórico", async () => {
  const cod = "VP-" + q(`SELECT LPAD(numero, 6, '0') FROM ValePallet WHERE id = '${valeSemNf}'`);
  await p.goto(`${BASE}/vales/excluir?vale=${cod}`);
  await p.selectOption("#motivo", { index: 1 });
  await p.click("button:has-text('Excluir vale')");
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(800);
  assert.equal(q(`SELECT status FROM ValePallet WHERE id = '${valeSemNf}'`), "CANCELADO");
  await p.goto(`${BASE}/vales/excluir`);
  assert.match(await p.locator("body").innerText(), new RegExp(cod));
});

await etapa("Consulta e detalhe do vale; PDF do vale (2 vias) disponível", async () => {
  await p.goto(`${BASE}/vales/consulta`);
  assert.ok((await p.locator("table").innerText()).includes("Fornecedor Recebimento SA"));
  const r = await p.goto(`${BASE}/vales/${valeNf}`);
  assert.equal(r.status(), 200);
  const pdf = await p.request.get(`${BASE}/api/vales/${valeNf}/pdf`);
  assert.equal(pdf.status(), 200);
  assert.equal(pdf.headers()["content-type"], "application/pdf");
  assert.ok((await pdf.body()).subarray(0, 5).toString() === "%PDF-");
});

await etapa("Relatórios e auditoria: telas, Excel, CSV e PDF", async () => {
  await p.goto(`${BASE}/relatorios`);
  assert.match(await p.locator("body").innerText(), /Resumo por tipo no período[\s\S]*Compra de pallets/);
  await p.goto(`${BASE}/auditoria`);
  assert.match(await p.locator("body").innerText(), /registro\(s\)/);
  for (const [u, tipo, magia] of [
    ["/api/exportar", "spreadsheetml", "PK"], ["/api/exportar?formato=csv", "text/csv", "﻿Data"],
    ["/api/auditoria/exportar?formato=xlsx", "spreadsheetml", "PK"], ["/api/auditoria/exportar?formato=pdf", "application/pdf", "%PDF"],
  ]) {
    const r = await p.request.get(BASE + u);
    assert.equal(r.status(), 200, u);
    assert.ok(r.headers()["content-type"].includes(tipo), u);
    assert.ok((await r.body()).toString("utf8").startsWith(magia), u);
  }
});

await etapa("Alterar senha: valida a atual e passa a valer a nova", async () => {
  await p.goto(`${BASE}/conta`);
  await p.fill("#atual", "errada"); await p.fill("#nova", "novaSenha1"); await p.fill("#confirmacao", "novaSenha1");
  await p.click("form[data-acao='/acao/auth/alterar-senha'] button[type=submit]");
  await p.waitForSelector("[role=status] >> text=/incorreta/i");
  await p.fill("#atual", "admin123"); await p.fill("#nova", "novaSenha1"); await p.fill("#confirmacao", "novaSenha1");
  await p.click("form[data-acao='/acao/auth/alterar-senha'] button[type=submit]");
  await p.waitForSelector("[role=status] >> text=/alterada/i");
  q("UPDATE Usuario SET senhaHash = (SELECT h FROM (SELECT senhaHash h FROM Usuario WHERE login = 'hub') t) WHERE login = 'admin'");
});

await etapa("Nenhum erro de JavaScript nas telas", async () => assert.deepEqual(errosJs, []));
await browser.close();
const falhas = resultados.filter((r) => r[0] !== "OK");
console.log(`\n${resultados.length - falhas.length}/${resultados.length} etapas OK`);
process.exit(falhas.length ? 1 : 0);
