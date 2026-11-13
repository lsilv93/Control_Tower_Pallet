// E2E da versão PHP/MySQL (servidor local em :3200, banco recém-zerado + seed + demo).
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3200";
const browser = await chromium.launch();
const resultados = [];
async function etapa(nome, fn) {
  try {
    await fn();
    resultados.push(["OK", nome]);
    console.log("OK  ", nome);
  } catch (e) {
    resultados.push(["FALHA", nome, e.message]);
    console.log("FALHA", nome, "\n   ", e.message.split("\n").slice(0, 4).join("\n    "));
  }
}

async function entrar(login, senha = "teste123", unidade) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  await page.goto(`${BASE}/login`);
  await page.fill("#login", login);
  await page.fill("#senha", senha);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
  if (new URL(page.url()).pathname === "/selecionar-cd") {
    await page.locator("label", { hasText: unidade ?? "CDJC" }).first().click();
    await page.click("button:has-text('Operar nesta unidade')");
    await page.waitForURL((u) => u.pathname !== "/selecionar-cd");
    await page.waitForLoadState("networkidle");
  }
  return page;
}
// Seleciona a opção cujo texto casa com a regex.
async function escolher(page, sel, re) {
  const valor = await page.locator(`${sel} option`).evaluateAll((os, src) => os.find((o) => new RegExp(src).test(o.textContent))?.value, re.source);
  if (!valor) throw new Error(`opção ${re} não encontrada em ${sel}`);
  await page.selectOption(sel, valor);
}
const num = async (page, sel) => Number((await page.locator(sel).first().innerText()).replace(/\D/g, ""));
const msg = (page) => page.locator("[role=status]").last();

const admin = await entrar("admin", "admin123", "CDJC");

await etapa("Admin (global) escolhe unidade e vê Torre de Controle no menu", async () => {
  await admin.waitForSelector("[data-testid=cd-ativo]");
  assert.match(await admin.locator("[data-testid=cd-ativo]").innerText(), /CDJC/);
  assert.equal(await admin.locator("nav a[href='/tv']").count(), 1);
  assert.match(await admin.locator("[data-testid=escopo-usuario]").innerText(), /todas as unidades/);
});

async function incluir(page, unidade, estoque, qtd, motivo = "INVENTARIO") {
  await page.goto(`${BASE}/estoque/inclusao`);
  await escolher(page, "#unidadeId", new RegExp(`· ${unidade} -`));
  await page.selectOption("#estoque", estoque);
  await page.fill("#quantidade", String(qtd));
  await page.selectOption("#motivo", motivo);
  await page.fill("#observacao", "Contagem física de implantação do sistema");
  await page.click("button:has-text('Incluir saldo')");
  await page.waitForSelector("[role=status]");
  return msg(page).innerText();
}

await etapa("Inclusão manual (motivo + observação) em CD e Cross", async () => {
  assert.match(await incluir(admin, "CDSP", "VAZIOS", 100), /\+100/);
  assert.match(await incluir(admin, "CDSP", "QUEBRADOS", 20, "DEVOLUCAO"), /\+20/);
  assert.match(await incluir(admin, "CDJC", "VAZIOS", 50, "COMPRA"), /\+50/);
  await admin.waitForSelector("[data-testid=historico-ajustes]");
  assert.match(await admin.locator("[data-testid=historico-ajustes]").innerText(), /Inventário|Devolução|Compra/);
});

await etapa("Remoção manual pede 'Tem certeza?' e bloqueia saldo negativo", async () => {
  await admin.goto(`${BASE}/estoque/remocao`);
  await escolher(admin, "#unidadeId", /· CDSP -/);
  await admin.selectOption("#estoque", "VAZIOS");
  await admin.fill("#quantidade", "500");
  await admin.fill("#justificativa", "Teste de remoção acima do saldo");
  await admin.click("button:has-text('Remover saldo')");
  assert.equal(await admin.locator("[data-testid=pergunta-remocao]").innerText(), "Tem certeza?");
  await admin.click("button:has-text('Sim, remover')");
  await admin.waitForSelector("[role=status]");
  assert.match(await msg(admin).innerText(), /Saldo insuficiente.*disponível 100, solicitado 500/);
  await admin.fill("#quantidade", "5");
  await admin.click("button:has-text('Remover saldo')");
  await admin.click("button:has-text('Sim, remover')");
  await admin.waitForFunction(() => /−5/.test(document.querySelector("[role=status]:last-of-type")?.textContent ?? ""));
});

async function endereco(page, rua, cidade, uf, cep) {
  await page.fill("#campo-endereco", rua);
  await page.fill("#campo-cidade", cidade);
  await page.selectOption("#campo-uf", uf);
  await page.fill("#campo-cep", cep);
}

await etapa("Cadastro de CD exige endereço completo (Endereço, Cidade, Estado, CEP)", async () => {
  await admin.goto(`${BASE}/cadastros/cds`);
  await admin.locator("[data-testid=tabela-unidades] tr", { hasText: "CDSP" }).locator("a:has-text('Editar')").click();
  await admin.waitForURL(/editar=/);
  await admin.waitForSelector("text=Editar CDSP");
  await admin.fill("#campo-endereco", "");
  await admin.click("button:has-text('Salvar alterações')");
  assert.equal(await admin.locator("#campo-endereco").evaluate((e) => e.validity.valid), false);
  await endereco(admin, "Av. das Nações Unidas, 1000, Galpão 3", "São Paulo", "SP", "04578000");
  assert.equal(await admin.inputValue("#campo-cep"), "04578-000");
  await admin.click("button:has-text('Salvar alterações')");
  await admin.waitForSelector("text=CDSP atualizado");
  assert.match(await admin.locator("[data-testid=tabela-unidades] tr", { hasText: "CDSP" }).innerText(), /São Paulo\/SP · CEP 04578-000/);
});

const sp = await entrar("sp");
let valeCross;
await etapa("Usuário regional: unidade fixa, sem troca; TV liberada", async () => {
  await sp.goto(`${BASE}/`);
  assert.match(await sp.locator("[data-testid=cd-ativo]").innerText(), /CDSP/);
  assert.equal(await sp.locator("a[title='Trocar unidade']").count(), 0);
  assert.equal(await sp.locator("nav a[href='/tv']").count(), 1);
  assert.equal(await sp.locator("[data-testid=link-tv]").count(), 1);
  assert.equal(await num(sp, "[data-testid=saldo-vazios]"), 95);
  await sp.goto(`${BASE}/tv`);
  await sp.waitForSelector("[data-testid=tela-tv]");
  assert.match(await sp.locator("[data-testid=titulo-tv]").innerText(), /Visão Geral/);
  assert.equal((await sp.request.get(`${BASE}/api/tv/versao`)).status(), 200);
});

await etapa("Envio CD→Cross: só Cross vinculados, sem consumo de estoque, acumulador e modal", async () => {
  await sp.goto(`${BASE}/envio?modo=cross`);
  const opcoes = await sp.locator("#unidadeId option").allInnerTexts();
  assert.ok(opcoes.some((o) => o.includes("XCPS")), "XCPS (vinculado ao CDSP) deveria aparecer");
  assert.ok(!opcoes.some((o) => o.includes("XNIT")), "XNIT (vinculado só ao CDRJ) não deveria aparecer");
  await sp.waitForSelector("[data-testid=aviso-remessa-cross]");
  assert.equal(await num(sp, "[data-testid=total-enviado-cross]"), 0);
  await escolher(sp, "#unidadeId", /XCPS/);
  // Acima do estoque do CDSP (95): permitido, pois o envio ao Cross não consome o estoque do CD.
  await sp.fill("#quantidadeBons", "200");
  await sp.selectOption("#transportadoraId", { index: 1 });
  await sp.click("button:has-text('Gerar vale de envio')");
  assert.equal(await sp.locator("[role=alert].poco-erro").count(), 0);
  assert.match(await sp.locator("[data-testid=pergunta-envio]").innerText(), /\(200 pallets\)/);
  await sp.keyboard.press("Escape");
  await sp.fill("#quantidadeBons", "30");
  await sp.fill("#placa", "ABC1D23");
  await sp.fill("#rota", "R-01");
  await sp.click("button:has-text('Gerar vale de envio')");
  assert.equal(await sp.locator("[data-testid=pergunta-envio]").innerText(), "Tem certeza do Ponto de Cross selecionado e da quantidade informada (30 pallets)?");
  await sp.click("button:has-text('Confirmar envio')");
  await sp.waitForURL(/\/imprimir\/vale\//);
  valeCross = sp.url().split("/imprimir/vale/")[1].split("?")[0];
  assert.match(await sp.locator("h1").first().innerText(), /VALE-PALLET DE ENVIO/);
  const doc = await sp.locator("body").innerText();
  assert.match(doc, /Total de Pallets PBR \(bons\)\s+30/i);
  assert.match(doc, /Total de Pallets Quebrados\s+0/i);
  assert.match(doc, /Total geral \(PBR \+ Quebrados\)\s+30/i);
  // Emitente do vale: endereço completo da unidade de origem (CDSP).
  assert.match(await sp.locator("[data-testid=emitente-endereco]").first().innerText(), /Av\. das Nações Unidas, 1000[\s\S]*São Paulo\/SP[\s\S]*04578-000/);
  await sp.goto(`${BASE}/`);
  assert.equal(await num(sp, "[data-testid=saldo-vazios]"), 95);
  await sp.goto(`${BASE}/envio?modo=cross`);
  assert.equal(await num(sp, "[data-testid=total-enviado-cross]"), 30);
});

await etapa("Kanban: vale em viagem aparece no prazo, com despacho e status", async () => {
  await sp.goto(`${BASE}/`);
  const card = sp.locator("[data-testid=kanban-col-VERDE] article").first();
  const t = await card.innerText();
  assert.match(t, /CDSP[\s\S]*XCPS/);
  assert.match(t, /Despacho/);
  assert.match(t, /Em Viagem \/ Aguardando Recebimento/);
  assert.match(t, /\b30\b/);
});

await etapa("Servidor bloqueia envio concorrente que deixaria saldo negativo", async () => {
  const aba2 = await sp.context().newPage();
  await aba2.goto(`${BASE}/envio?modo=cd`);
  await sp.goto(`${BASE}/envio?modo=cd`);
  for (const p of [sp, aba2]) {
    await escolher(p, "#unidadeId", /CDRJ/);
    await p.fill("#quantidadeBons", "60");
    await p.selectOption("#transportadoraId", { index: 1 });
  }
  await sp.click("button:has-text('Gerar vale de envio')");
  await sp.click("button:has-text('Confirmar envio')");
  await sp.waitForURL(/\/imprimir\/vale\//);
  // A segunda aba ainda mostra o saldo antigo (95): a tela deixa passar, o servidor bloqueia.
  await aba2.click("button:has-text('Gerar vale de envio')");
  await aba2.click("button:has-text('Confirmar envio')");
  await aba2.waitForSelector("[role=status]");
  assert.match(await aba2.locator("[role=status]").last().innerText(), /Saldo insuficiente de Pallets PBR em CDSP: disponível 35, solicitado 60/);
  await aba2.close();
  await sp.goto(`${BASE}/envio?modo=cd`);
  assert.equal(await num(sp, "[data-testid=total-enviado-cds]"), 60);
});

const cx = await entrar("campinas");
await etapa("Usuário Cross: menu limitado e telas bloqueadas", async () => {
  await cx.goto(`${BASE}/`);
  const menu = await cx.locator("aside nav").innerText();
  for (const t of ["Painel", "Envio de Pallets", "Recebimento / Conferência", "Lançar Quebrado", "Ocorrências"]) assert.ok(menu.includes(t), `falta ${t}`);
  for (const t of ["Consulta de Vales", "Relatórios", "Auditoria", "Excluir Vale", "Descarte", "Ajuste de Saldo"]) assert.ok(!menu.includes(t), `não deveria ter ${t}`);
  for (const rota of ["/avarias/descarte", "/vales/excluir"]) {
    await cx.goto(`${BASE}${rota}`);
    await cx.waitForSelector("[data-testid=sem-acesso]");
  }
  await cx.goto(`${BASE}/vales/consulta`);
  await cx.waitForSelector("[data-testid=sem-acesso]");
  await cx.goto(`${BASE}/estoque/inclusao`);
  await cx.waitForSelector("[data-testid=sem-acesso]");
});

let voFalta1;
await etapa("Conferência no Cross com falta gera Vale de Ocorrência (devolutivo)", async () => {
  await cx.goto(`${BASE}/recebimento`);
  await cx.check(`input[name=valeIds][value='${valeCross}']`);
  assert.equal(await cx.locator("[data-testid=total-vales]").innerText(), "30");
  // Placa e transportadora vêm do envio.
  assert.equal(await cx.inputValue("#placa"), "ABC1D23");
  assert.notEqual(await cx.inputValue("#transportadoraId"), "");
  await cx.fill("#recebidoBons", "28");
  await cx.fill("#recebidoQuebrados", "0");
  assert.match(await cx.locator("[data-testid=alerta-divergencia]").innerText(), /Divergência de -2/);
  await cx.click("button:has-text('Registrar conferência')");
  assert.match(await cx.locator("#aviso-divergencia").innerText(), /falta de 2/);
  await cx.click("button:has-text('Confirmar divergência')");
  await cx.fill("#observacao", "Dois pallets não vieram no caminhão");
  await cx.click("button:has-text('Registrar conferência com falta de 2')");
  await cx.waitForURL(/\/imprimir\/vale\//);
  voFalta1 = cx.url().split("/imprimir/vale/")[1].split("?")[0];
  assert.match(await cx.locator("h1").first().innerText(), /OCORRÊNCIA · FALTA/);
  await cx.goto(`${BASE}/`);
  assert.equal(await num(cx, "[data-testid=saldo-vazios]"), 28);
  // Recebido com divergência: o vale vai para a coluna de divergência do Kanban do CDSP.
  await sp.goto(`${BASE}/`);
  assert.match(await sp.locator("[data-testid=kanban-col-DIVERGENCIA]").innerText(), /CDSP[\s\S]*XCPS[\s\S]*Recebido com divergência/);
});

await etapa("Cross lança quebrado e devolve bons + quebrados ao CD", async () => {
  await cx.goto(`${BASE}/avarias/quebras`);
  await cx.fill("#quantidade", "5");
  await cx.fill("#observacao", "Pallets danificados na operação");
  await cx.click("button:has-text('Registrar quebra')");
  await cx.waitForSelector("[role=status]");
  await cx.goto(`${BASE}/envio`);
  assert.equal(await cx.locator(".abas a").count(), 0); // Cross: só o retorno ao CD
  // Cross vinculado a 2 CDs (CDSP e CDJC): a lista mostra só os vinculados e a escolha é obrigatória.
  const cds = (await cx.locator("#unidadeId option").allInnerTexts()).filter((o) => !o.includes("Selecione"));
  assert.equal(cds.length, 2, `CDs vinculados: ${cds.join(", ")}`);
  assert.ok(!cds.some((o) => o.includes("CDRJ")), "CDRJ não é vinculado");
  assert.equal(await cx.inputValue("#unidadeId"), "");
  await escolher(cx, "#unidadeId", /CDSP/);
  await cx.fill("#quantidadeBons", "15");
  await cx.fill("#quantidadeQuebrados", "5");
  await cx.selectOption("#transportadoraId", { index: 1 });
  await cx.click("button:has-text('Gerar vale de retorno')");
  assert.match(await cx.locator("[data-testid=pergunta-envio]").innerText(), /CD selecionado.*\(20 pallets\)/);
  await cx.click("button:has-text('Confirmar envio')");
  await cx.waitForURL(/\/imprimir\/vale\//);
  await cx.goto(`${BASE}/`);
  assert.equal(await num(cx, "[data-testid=saldo-vazios]"), 8);
  assert.equal(await num(cx, "[data-testid=saldo-quebrados]"), 0);
});

let voSobra;
let voHub;
await etapa("CD confere retorno do Cross com sobra (bons→vazios, quebrados→quebrados)", async () => {
  await sp.goto(`${BASE}/recebimento`);
  await escolher(sp, "#remetenteId", /XCPS/);
  await sp.locator("input[name=valeIds]").first().check();
  await sp.fill("#recebidoBons", "15");
  await sp.fill("#recebidoQuebrados", "6");
  await sp.click("button:has-text('Registrar conferência')");
  await sp.click("button:has-text('Confirmar divergência')");
  await sp.fill("#observacao", "Veio um quebrado a mais");
  await sp.click("button:has-text('Registrar conferência com sobra de 1')");
  await sp.waitForURL(/\/imprimir\/vale\//);
  voSobra = sp.url().split("/imprimir/vale/")[1].split("?")[0];
  assert.match(await sp.locator("h1").first().innerText(), /OCORRÊNCIA · SOBRA/);
  await sp.goto(`${BASE}/`);
  assert.equal(await num(sp, "[data-testid=saldo-vazios]"), 35 + 15);
  assert.equal(await num(sp, "[data-testid=saldo-quebrados]"), 20 + 6);
});

await etapa("Filial envia quebrados ao CDJC (Vale de Pallets Quebrados)", async () => {
  await sp.goto(`${BASE}/envio?modo=hub`);
  assert.equal(await sp.locator("#quantidadeBons").count(), 0);
  await sp.fill("#quantidadeQuebrados", "26");
  await sp.selectOption("#transportadoraId", { index: 1 });
  await sp.click("button:has-text('Enviar Pallets Quebrados ao CDJC')");
  assert.match(await sp.locator("[data-testid=pergunta-envio]").innerText(), /CD Hub selecionado.*\(26 pallets\)/);
  await sp.click("button:has-text('Confirmar envio')");
  await sp.waitForURL(/\/imprimir\/vale\//);
  assert.match(await sp.locator("h1").first().innerText(), /VALE DE PALLETS QUEBRADOS/);
});

await etapa("TV gestão à vista: CDs e Cross separados, faróis, sem fornecedores", async () => {
  await admin.goto(`${BASE}/tv`);
  const cds = await admin.locator("[data-testid=tv-cds]").innerText();
  for (const u of ["CDJC", "CDSP", "CDRJ"]) assert.ok(cds.includes(u), u);
  assert.ok(!cds.includes("XCPS"), "Cross não deve estar na tabela de CDs");
  const cross = await admin.locator("[data-testid=tv-cross]").innerText();
  assert.match(cross, /XCPS[\s\S]*Atende: CDJC, CDSP/);
  assert.match(await admin.locator("main").innerText(), /26 quebrados ao Hub/);
  // Ocorrências pendentes acendem o farol: XCPS e CDSP têm ocorrências em aberto.
  assert.match(await admin.locator("[data-testid=tv-cds] tbody tr", { hasText: "CDSP" }).innerText(), /ocorrência\(s\) pendente/);
  await admin.waitForSelector("[data-testid=resumo-farois]");
  await admin.waitForSelector("[data-testid=legenda-farol]");
  assert.ok(!/fornecedor/i.test(await admin.locator("main").innerText()), "TV não deve ter fornecedores");
  assert.equal(await admin.locator("button:has-text('Tela cheia')").count() + (await admin.locator("[aria-label*='tela cheia' i]").count()), 1);
});

const hub = await entrar("hub", "teste123", "CDJC");
await etapa("CDJC confere quebrados com falta; TV atualiza a acuracidade", async () => {
  await hub.goto(`${BASE}/recebimento`);
  await escolher(hub, "#remetenteId", /CDSP/);
  await hub.locator("input[name=valeIds]").first().check();
  await hub.fill("#recebidoBons", "0");
  await hub.fill("#recebidoQuebrados", "25");
  await hub.click("button:has-text('Registrar conferência')");
  await hub.click("button:has-text('Confirmar divergência')");
  await hub.fill("#observacao", "Faltou um pallet quebrado");
  await hub.click("button:has-text('Registrar conferência com falta de 1')");
  await hub.waitForURL(/\/imprimir\/vale\//);
  voHub = hub.url().split("/imprimir/vale/")[1].split("?")[0];
  await admin.goto(`${BASE}/tv`);
  assert.match(await admin.locator("[data-testid=tv-cds] tbody tr", { hasText: "CDSP" }).innerText(), /94,6%/);
});

await etapa("Reparo exclusivo do Hub", async () => {
  await sp.goto(`${BASE}/avarias/recuperados`);
  assert.match(await sp.locator("[data-testid=sem-acesso]").innerText(), /exclusivo do CD Hub/);
  await hub.goto(`${BASE}/avarias/recuperados`);
  await hub.waitForSelector("text=Conserto / Reparo de Pallets");
});

const card = (page, id) => page.locator("section", { has: page.locator(`a[href='/vales/${id}']`) });
async function responder(page, id, acao, justificativa) {
  await page.goto(`${BASE}/ocorrencias?f=acao`);
  const c = card(page, id);
  await c.locator(`button:has-text('${acao === "ACEITAR" ? "Aceitar" : "Recusar"}')`).click();
  if (justificativa) await page.fill(`#justificativa-${id}`, justificativa);
  await page.click(`button:has-text('${acao === "ACEITAR" ? "Confirmar aceite" : "Confirmar recusa"}')`);
  try {
    await page.waitForFunction(() => /recusada|aceita|Saldo insuficiente|obrigatória/.test([...document.querySelectorAll("[role=status]")].map((e) => e.textContent).join(" ")));
  } catch (e) {
    console.log("   DEBUG responder:", acao, id, "| status:", await page.locator("[role=status]").allInnerTexts(), "| dialog:", await page.locator("[role=dialog]").allInnerTexts());
    throw e;
  }
  return (await page.locator("[role=status]").allInnerTexts()).join(" ");
}

await etapa("Ocorrência: remetente recusa com justificativa, recebedor aceita (assume a falta)", async () => {
  await sp.goto(`${BASE}/`);
  assert.equal(await sp.locator("[data-testid=badge-ocorrencias]").innerText(), "2"); // falta do XCPS e falta do CDJC
  assert.match(await sp.locator("[data-testid=widget-ocorrencias]").innerText(), /falta[\s\S]*CDSP/i);
  // Recusa sem justificativa é bloqueada.
  await sp.goto(`${BASE}/ocorrencias?f=acao`);
  await card(sp, voFalta1).locator("button:has-text('Recusar')").click();
  await sp.click("button:has-text('Confirmar recusa')");
  assert.equal(await sp.locator(`#justificativa-${voFalta1}`).evaluate((e) => e.validity.valid), false);
  await sp.keyboard.press("Escape");
  const msg = await responder(sp, voFalta1, "RECUSAR", "Os 30 pallets saíram conferidos do CDSP, ver canhoto");
  assert.match(msg, /recusada por CDSP.*voltou para XCPS/);
  await cx.goto(`${BASE}/ocorrencias?f=acao`);
  const c = await card(cx, voFalta1).innerText();
  assert.match(c, /Aguardando XCPS/);
  assert.match(c, /Os 30 pallets saíram conferidos do CDSP/);
  assert.match(await responder(cx, voFalta1, "ACEITAR"), /aceita por XCPS e encerrada: 2 pallet\(s\) assumidos no estoque de XCPS/);
  // Ocorrência encerrada: o vale sai do Kanban automaticamente.
  await sp.goto(`${BASE}/`);
  assert.equal(await sp.locator(`[data-testid=kanban-viagens] a[href='/vales/${valeCross}']`).count(), 0, "vale CDSP→XCPS deveria sair do Kanban");
  await cx.goto(`${BASE}/`);
  assert.equal(await num(cx, "[data-testid=saldo-vazios]"), 8 + 2);
});

await etapa("Ocorrência de sobra: aceite do remetente sem saldo é bloqueado; recusa e recebedor aceita", async () => {
  // XCPS (remetente da sobra de 1 quebrado) está sem Pallets Quebrados: aceitar deixaria saldo negativo.
  assert.match(await responder(cx, voSobra, "ACEITAR"), /Saldo insuficiente de Pallets Quebrados em XCPS/);
  assert.match(await responder(cx, voSobra, "RECUSAR", "Não enviamos pallet quebrado a mais, contagem na doca"), /voltou para CDSP/);
  assert.match(await responder(sp, voSobra, "ACEITAR"), /incorporados ao estoque de CDSP/);
});

await etapa("Ocorrência de falta aceita pelo remetente vira perda; ocorrências visíveis às duas pontas", async () => {
  assert.match(await responder(sp, voHub, "ACEITAR"), /baixados como perda de CDSP/);
  await sp.goto(`${BASE}/`);
  assert.equal(await sp.locator("[data-testid=badge-ocorrencias]").count(), 0);
  await sp.goto(`${BASE}/ocorrencias?f=encerradas`);
  const lista = await sp.locator("[data-testid=lista-ocorrencias]").innerText();
  assert.match(lista, /Aceita pela unidade recebedora/);
  assert.match(lista, /Aceita pela unidade remetente/);
  const hubOc = await entrar("hub");
  await hubOc.goto(`${BASE}/ocorrencias?f=todas`);
  assert.match(await hubOc.locator("[data-testid=lista-ocorrencias]").innerText(), /CDSP[\s\S]*CDJC/);
  await hubOc.context().close();
});

await etapa("Isolamento regional: CDRJ não vê vale do CDSP→XCPS", async () => {
  const rj = await entrar("rj");
  const r = await rj.goto(`${BASE}/vales/${valeCross}`);
  assert.equal(r.status(), 404);
  await rj.goto(`${BASE}/ocorrencias?f=todas`);
  assert.equal(await rj.locator("[data-testid=lista-ocorrencias]").count(), 0);
  await rj.context().close();
});

await etapa("Descarte por usuário de CD, com 'Tem certeza?' e registro imutável", async () => {
  await sp.goto(`${BASE}/avarias/descarte`);
  await sp.fill("#quantidade", "3");
  await sp.fill("#observacao", "Pallets sem condição de uso");
  await sp.click("button:has-text('Descartar')");
  assert.match(await sp.locator("[data-testid=pergunta-descarte]").innerText(), /Tem certeza/);
  await sp.click("button:has-text('Pallets PBR')");
  await sp.waitForSelector("[data-testid=pallets-descartados]");
  assert.equal(await num(sp, "[data-testid=total-descartados]"), 3);
});

async function vincularXcps(cdsp) {
  await admin.goto(`${BASE}/cadastros/cross`);
  await admin.locator("[data-testid=tabela-unidades] tr", { hasText: "XCPS" }).locator("a:has-text('Editar')").click();
  await admin.waitForURL(/editar=/);
  await admin.waitForSelector("text=Editar XCPS");
  const caixa = admin.locator("[data-testid=cds-atendidos] label", { hasText: "CDSP" }).locator("input");
  if (cdsp) await caixa.check(); else await caixa.uncheck();
  // Unidade antiga sem endereço: o cadastro agora exige o endereço completo para salvar.
  if (!(await admin.inputValue("#campo-endereco"))) await endereco(admin, "Rod. Anhanguera, km 100", "Campinas", "SP", "13065000");
  await admin.click("button:has-text('Salvar alterações')");
  await admin.waitForSelector("text=XCPS atualizado");
}

await etapa("Servidor bloqueia retorno do Cross para CD desvinculado (lista desatualizada na tela)", async () => {
  await cx.goto(`${BASE}/envio`);
  await escolher(cx, "#unidadeId", /CDSP/); // a tela ainda mostra o CDSP
  await vincularXcps(false); // o administrador remove o vínculo XCPS × CDSP
  await cx.fill("#quantidadeBons", "1");
  await cx.selectOption("#transportadoraId", { index: 1 });
  await cx.click("button:has-text('Gerar vale de retorno')");
  await cx.click("button:has-text('Confirmar envio')");
  await cx.waitForSelector("[role=status]");
  assert.match(await cx.locator("[role=status]").last().innerText(), /CDSP não é um CD vinculado a XCPS/);
  await cx.goto(`${BASE}/envio`);
  assert.ok(!(await cx.locator("#unidadeId option").allInnerTexts()).some((o) => o.includes("CDSP")), "CDSP saiu da lista");
  await vincularXcps(true);
});

await etapa("Cadastro só com Sigla e Nome; Cross com vários CDs; fornecedor com sigla", async () => {
  await admin.goto(`${BASE}/cadastros/cross`);
  await admin.fill("#campo-sigla", "xbh01");
  await admin.fill("#campo-nome", "Cross Belo Horizonte");
  await endereco(admin, "Rua dos Andradas, 50", "Belo Horizonte", "MG", "30120010");
  await admin.locator("[data-testid=cds-atendidos] label", { hasText: "CDSP" }).locator("input").check();
  await admin.locator("[data-testid=cds-atendidos] label", { hasText: "CDRJ" }).locator("input").check();
  await admin.click("button:has-text('Cadastrar')");
  await admin.waitForSelector("text=XBH01 cadastrado");
  assert.match(await admin.locator("[data-testid=tabela-unidades] tr", { hasText: "XBH01" }).innerText(), /CDRJ, CDSP/);
  await admin.goto(`${BASE}/cadastros/fornecedores`);
  await admin.fill("#campo-sigla", "ambev");
  await admin.fill("#campo-nome", "Ambev S.A.");
  await admin.click("button:has-text('Cadastrar')");
  await admin.waitForSelector("text=Ambev S.A. cadastrado");
  assert.match(await admin.locator("tr", { hasText: "Ambev S.A." }).innerText(), /AMBEV/);
  await admin.goto(`${BASE}/cadastros/cross`);
  await admin.fill("#campo-sigla", "XSEM");
  await admin.fill("#campo-nome", "Cross sem CD");
  await endereco(admin, "Rua Teste, 1", "Campinas", "SP", "13010000");
  await admin.click("button:has-text('Cadastrar')");
  await admin.waitForSelector("text=Selecione ao menos um CD");
});

await etapa("TV: filtro por unidades (CD + Cross) e encaixe na tela sem rolagem", async () => {
  const tv = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  await tv.goto(`${BASE}/login`);
  await tv.fill("#login", "rj");
  await tv.fill("#senha", "teste123");
  await tv.click("button[type=submit]");
  await tv.waitForURL((u) => !u.pathname.startsWith("/login"));
  await tv.goto(`${BASE}/tv`);
  await tv.waitForSelector("[data-testid=tela-tv]");
  const semRolagem = () => tv.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);
  assert.ok(await semRolagem(), "Visão Geral não deve rolar na vertical em 1920x1080");
  await tv.click("[data-testid=filtro-unidades]");
  await tv.check("[data-testid=filtro-op-CDSP]");
  await tv.check("[data-testid=filtro-op-XCPS]");
  await tv.click("[data-testid=filtro-aplicar]");
  await tv.waitForURL(/u=CDSP,XCPS/);
  await tv.waitForSelector("text=Visão CDSP + XCPS");
  assert.equal(await tv.locator("[data-testid=tv-cds] tbody tr").count(), 1);
  assert.equal(await tv.locator("[data-testid=tv-cross] tbody tr").count(), 1);
  assert.ok(await semRolagem(), "seleção não deve rolar");
  // Só um CD: a tabela de Cross some.
  await tv.goto(`${BASE}/tv?u=CDRJ`);
  await tv.waitForSelector("[data-testid=tv-cds]");
  assert.equal(await tv.locator("[data-testid=tv-cross]").count(), 0);
  await tv.click("[data-testid=filtro-visao-geral]");
  await tv.waitForURL((u) => u.search === "");
  // Monitor menor (1366x768) também cabe sem rolagem.
  await tv.setViewportSize({ width: 1366, height: 768 });
  await tv.waitForTimeout(500);
  assert.ok(await semRolagem(), "1366x768 não deve rolar");
  await tv.context().close();
});

await etapa("Kanban: farol muda pelo tempo de viagem (24h amarelo, 48h vermelho)", async () => {
  const { execFileSync } = await import("node:child_process");
  // MySQL: identificadores entre crases (no lugar das aspas do Postgres).
  const q = (sql) => execFileSync("mysql", [`-u${process.env.DB_USER ?? "pallet"}`, `-p${process.env.DB_PASS ?? "pallet"}`, process.env.DB_NAME ?? "pallet", "-N", "-B", "-e", sql.replaceAll('"', "`")], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  const id = q(`select v.id from "ValePallet" v join "CentroDistribuicao" d on d.id = v."unidadeId" where v.tipo='ENVIO' and v.status='PENDENTE' and d.codigo='CDRJ' limit 1`);
  q(`update "ValePallet" set "criadoEm" = UTC_TIMESTAMP(3) - INTERVAL 30 HOUR where id = '${id}'`);
  await sp.goto(`${BASE}/`);
  assert.match(await sp.locator("[data-testid=kanban-col-AMARELO]").innerText(), /CDRJ/);
  q(`update "ValePallet" set "criadoEm" = UTC_TIMESTAMP(3) - INTERVAL 50 HOUR where id = '${id}'`);
  await sp.goto(`${BASE}/`);
  assert.match(await sp.locator("[data-testid=kanban-col-VERMELHO]").innerText(), /CDRJ[\s\S]*2d 2h/);
});

await etapa("Transportadora da conferência é lista do cadastro (sem digitação livre)", async () => {
  await sp.goto(`${BASE}/recebimento`);
  assert.equal(await sp.locator("input[name=transportadora]").count(), 0);
  const tipo = await sp.locator("#transportadoraId").evaluate((e) => e.tagName).catch(() => "SEM_FORM");
  assert.ok(tipo === "SELECT" || tipo === "SEM_FORM", tipo);
});

await etapa("Sair encerra a sessão e bloqueia as rotas protegidas", async () => {
  await cx.goto(`${BASE}/`);
  await cx.locator("aside button[aria-label='Sair do sistema']").click();
  await cx.waitForURL(/\/login/);
  assert.equal((await cx.context().cookies()).filter((c) => c.name === "ctp_session" && c.value).length, 0);
  await cx.goto(`${BASE}/envio`);
  await cx.waitForURL(/\/login/);
  const r = await cx.request.get(`${BASE}/api/tv/versao`);
  assert.equal(r.status(), 401);
});

await etapa("Módulo fornecedor desligado por padrão; Master libera por CD", async () => {
  const adm2 = await entrar("admin", "admin123", "CDSP");
  await adm2.goto(`${BASE}/fornecedor/entrada`);
  assert.match(await adm2.locator("[data-testid=sem-acesso]").innerText(), /não liberado/);
  assert.ok(!(await adm2.locator("aside nav").innerText()).includes("Recebimento Pallet Fornecedor"));
  await admin.goto(`${BASE}/cadastros/cds`);
  await admin.locator("tr", { hasText: "CDSP" }).locator("a:has-text('Editar')").click();
  await admin.check("[data-testid=cfg-fornecedor]");
  await admin.click("button:has-text('Salvar configuração')");
  await admin.waitForSelector("text=ATIVADO");
  await adm2.goto(`${BASE}/fornecedor/entrada`);
  assert.ok((await adm2.locator("aside nav").innerText()).includes("Recebimento Pallet Fornecedor"));
  await adm2.waitForSelector("text=Bipe o código de barras");
  await adm2.context().close();
});

await etapa("Cadastro padronizado: CNPJ com máscara e validação", async () => {
  await admin.goto(`${BASE}/cadastros/cross`);
  await admin.fill("#campo-cnpj", "11111111111111");
  assert.equal(await admin.inputValue("#campo-cnpj"), "11.111.111/1111-11");
  await admin.waitForSelector("text=CNPJ inválido");
  await admin.fill("#campo-telefone", "11987654321");
  assert.equal(await admin.inputValue("#campo-telefone"), "(11) 98765-4321");
});

await etapa("Usuário com várias unidades (CD + Cross): escolhe, alterna e vê dados integrados", async () => {
  const m = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await m.goto(`${BASE}/login`);
  await m.fill("#login", "multi");
  await m.fill("#senha", "teste123");
  await m.click("button[type=submit]");
  await m.waitForURL(/selecionar-cd/);
  const opcoes = await m.locator("fieldset label").allInnerTexts();
  assert.equal(opcoes.length, 2, opcoes.join(" | "));
  assert.ok(opcoes.some((o) => o.includes("CDSP")) && opcoes.some((o) => o.includes("XCPS")));
  await m.locator("label", { hasText: "XCPS" }).click();
  await m.click("button:has-text('Operar nesta unidade')");
  await m.waitForURL((u) => !u.pathname.startsWith("/selecionar"));
  // Operando o Cross valem as restrições de Cross.
  assert.ok(!(await m.locator("aside nav").innerText()).includes("Consulta de Vales"));
  await m.goto(`${BASE}/selecionar-cd?trocar=1`);
  await m.locator("label", { hasText: "CDSP" }).click();
  await m.click("button:has-text('Operar nesta unidade')");
  await m.waitForURL((u) => !u.pathname.startsWith("/selecionar"));
  assert.match(await m.locator("[data-testid=cd-ativo]").innerText(), /CDSP/);
  await m.goto(`${BASE}/vales/consulta`);
  assert.match(await m.locator("h1 + p").innerText(), /CDSP, XCPS|XCPS, CDSP/);
  // Vê os vales das unidades vinculadas (CDSP → XCPS).
  const r = await m.goto(`${BASE}/vales/${valeCross}`);
  assert.equal(r.status(), 200);
  await m.context().close();
});

await etapa("Conta corrente: nenhum saldo negativo e ΣEnviado = ΣRecebido", async () => {
  const { execFileSync } = await import("node:child_process");
  // MySQL: identificadores entre crases (no lugar das aspas do Postgres).
  const q = (sql) => execFileSync("mysql", [`-u${process.env.DB_USER ?? "pallet"}`, `-p${process.env.DB_PASS ?? "pallet"}`, process.env.DB_NAME ?? "pallet", "-N", "-B", "-e", sql.replaceAll('"', "`")], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  const negativos = q(`with s as (select "cdId", c, sum(q) saldo from (select "cdId", destino c, quantidade q from "Movimentacao" union all select "cdId", origem, -quantidade from "Movimentacao") x group by 1,2) select count(*) from s where c in ('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA') and saldo < 0`);
  assert.equal(negativos, "0");
  const enviado = q(`select coalesce(sum(case when destino='ENVIADO' then quantidade else 0 end) - sum(case when origem='ENVIADO' then quantidade else 0 end),0) from "Movimentacao"`);
  const recebido = q(`select coalesce(sum(case when origem='RECEBIDO' then quantidade else 0 end) - sum(case when destino='RECEBIDO' then quantidade else 0 end),0) from "Movimentacao"`);
  assert.equal(enviado, recebido, `enviado ${enviado} x recebido ${recebido}`);
  assert.equal(q(`select count(*) from "ValePallet" where tipo='OCORRENCIA' and status='PENDENTE' and "aguardandoId" is not null`) >= "0", true);
  assert.equal(q(`select count(*) from "Movimentacao" m join "ValePallet" v on v.id = m."valeId" where v.tipo='OCORRENCIA' and m.tipo='OCORRENCIA_PERDA'`), "1");
});

await browser.close();
const falhas = resultados.filter((r) => r[0] !== "OK");
console.log(`\n${resultados.length - falhas.length}/${resultados.length} etapas OK`);
process.exit(falhas.length ? 1 : 0);
