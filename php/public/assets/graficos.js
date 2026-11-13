/* Control Tower Pallet — gráficos do Painel em SVG (vanilla JS), tradução dos componentes
 * graficos/*.tsx: composição, rosca, barras por Ponto de Cross, fluxo de estoque e vales
 * de fornecedor. Elementos: <div data-grafico="tipo" data-dados='{...}'>. */
(function () {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (v) => new Intl.NumberFormat("pt-BR").format(v);

  /** Escala "bonita" para o eixo: 0 / 50 / 100 … */
  function escalaLimpa(max, passos = 4) {
    if (max <= 0) return { topo: passos, passo: 1 };
    const bruto = max / passos;
    const pot = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? bruto;
    return { topo: Math.ceil(max / passo) * passo, passo };
  }

  /** Barra com ponta arredondada (4px) e base reta. */
  function barra(x, y, w, h, ponta, r = 4) {
    if (w <= 0 || h <= 0) return "";
    const rr = Math.min(r, ponta === "direita" ? h / 2 : w / 2, ponta === "direita" ? w : h);
    if (ponta === "cima") return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
    if (ponta === "baixo") return `M${x},${y}V${y + h - rr}Q${x},${y + h} ${x + rr},${y + h}H${x + w - rr}Q${x + w},${y + h} ${x + w},${y + h - rr}V${y}Z`;
    return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`;
  }

  const dica = (x, y, largura, html) => {
    const esquerda = Math.min(Math.max(x + 12, 4), Math.max(largura - 200, 4));
    return `<div role="tooltip" class="pointer-events-none absolute z-10 min-w-[11rem] rounded-2xl px-3.5 py-2.5 text-[11px] text-t2 shadow-[8px_8px_17px_var(--neu-d)]" style="left:${esquerda}px;top:${Math.max(y - 8, 0)}px;background:var(--opcao)">${html}</div>`;
  };
  const linhaDica = (cor, rotulo, valor) =>
    `<div class="flex items-center justify-between gap-4 py-0.5"><span class="flex items-center gap-2">${cor ? `<span class="inline-block h-[2px] w-3 rounded" style="background:${cor}"></span>` : ""}${esc(rotulo)}</span><strong class="num text-t1">${esc(valor)}</strong></div>`;
  const legenda = (itens) =>
    `<div class="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-t2">${itens
      .map((i) => `<span class="inline-flex items-center gap-2"><span class="inline-block h-2.5 w-2.5 rounded-[3px]" style="background:${i.cor}"></span>${esc(i.rotulo)}${i.valor ? `<strong class="num text-t1">${esc(i.valor)}</strong>` : ""}</span>`)
      .join("")}</div>`;

  /** Desenha o gráfico com a largura real do contêiner e redesenha ao redimensionar/interagir. */
  function montar(el, desenhar) {
    const estado = { foco: null, largura: 0 };
    const render = () => (el.innerHTML = desenhar(estado));
    el.__render = render;
    new ResizeObserver(([e]) => {
      const w = Math.floor(e.contentRect.width);
      if (w !== estado.largura) {
        estado.largura = w;
        render();
      }
    }).observe(el);
    const alvo = (e) => e.target.closest && e.target.closest("[data-foco]");
    el.addEventListener("mouseover", (e) => {
      const a = alvo(e);
      const f = a ? a.dataset.foco : null;
      if (f !== estado.foco) {
        estado.foco = f;
        render();
      }
    });
    el.addEventListener("mouseleave", () => {
      estado.foco = null;
      render();
    });
    el.addEventListener("focusin", (e) => {
      const a = alvo(e);
      if (a) {
        estado.foco = a.dataset.foco;
        render();
        const novo = el.querySelector(`[data-foco="${CSS.escape(estado.foco)}"]`);
        novo && novo.focus && novo.focus({ preventScroll: true });
      }
    });
    render();
    return estado;
  }

  // ------------------------------------------------------------ BarraComposicao
  function composicao(el, itens) {
    montar(el, (s) => {
      const total = itens.reduce((t, i) => t + Math.max(i.valor, 0), 0);
      const barras =
        total === 0
          ? `<div class="h-full w-full rounded-full bg-[var(--viz-grade)]"></div>`
          : itens
              .map((i, idx) =>
                i.valor > 0
                  ? `<div data-foco="${idx}" class="h-full transition-opacity first:rounded-l-full last:rounded-r-full" style="width:${(i.valor / total) * 100}%;background:${i.cor};opacity:${s.foco === null || s.foco === String(idx) ? 1 : 0.4}" title="${esc(i.rotulo)}: ${fmt(i.valor)} (${Math.round((i.valor / total) * 100)}%)"></div>`
                  : "",
              )
              .join("");
      return (
        `<div><div class="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Composição do total por estoque">${barras}</div>` +
        `<div class="mt-3">${legenda(itens.map((i) => ({ cor: i.cor, rotulo: i.rotulo, valor: `${fmt(i.valor)}${total ? ` · ${Math.round((Math.max(i.valor, 0) / total) * 100)}%` : ""}` })))}</div></div>`
      );
    });
  }

  // ------------------------------------------------------------ GraficoRosca
  const pct = (v, t) => (t > 0 ? (v / t) * 100 : 0);
  const fmtPct = (p) => `${p.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: p > 0 && p < 10 ? 1 : 0 })}%`;
  function arco(cx, cy, rExt, rInt, a0, a1) {
    const ponto = (r, a) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = ponto(rExt, a0);
    const [x1, y1] = ponto(rExt, a1);
    const [x2, y2] = ponto(rInt, a1);
    const [x3, y3] = ponto(rInt, a0);
    return `M${x0},${y0}A${rExt},${rExt} 0 ${grande} 1 ${x1},${y1}L${x2},${y2}A${rInt},${rInt} 0 ${grande} 0 ${x3},${y3}Z`;
  }
  function htmlRosca(cfg, foco) {
    const { dados, rotuloTotal, unidade = "pallets", vazio } = cfg;
    const total = dados.reduce((s, d) => s + d.valor, 0);
    if (total <= 0) return `<p class="poco px-5 py-10 text-center text-[12px] text-t3">${esc(vazio)}</p>`;
    const T = 200, c = T / 2, rExt = 92, rInt = 62;
    const vao = dados.length > 1 ? 0.012 : 0;
    let acc = 0;
    const fatias = dados.map((d) => {
      const a0 = (acc / total) * Math.PI * 2;
      acc += d.valor;
      const a1 = (acc / total) * Math.PI * 2;
      return { ...d, a0: a0 + vao / 2, a1: Math.max(a1 - vao / 2, a0 + vao / 2 + 0.0001) };
    });
    const ativa = fatias.find((f) => f.id === foco) || null;
    const svg =
      fatias.length === 1
        ? `<circle cx="${c}" cy="${c}" r="${(rExt + rInt) / 2}" fill="none" stroke="${fatias[0].cor}" stroke-width="${rExt - rInt}"/>`
        : fatias
            .map(
              (f) =>
                `<path data-foco="${esc(f.id)}" d="${arco(c, c, foco === f.id ? rExt + 4 : rExt, rInt, f.a0, f.a1)}" fill="${f.cor}" opacity="${foco && foco !== f.id ? 0.35 : 1}" class="cursor-pointer transition-opacity duration-200" tabindex="0" aria-label="${esc(f.rotulo)}: ${fmt(f.valor)} ${unidade} (${fmtPct(pct(f.valor, total))})"/>`,
            )
            .join("");
    const centro = ativa
      ? `<span class="num text-[24px] font-semibold leading-none text-t1">${fmtPct(pct(ativa.valor, total))}</span><span class="mt-1 line-clamp-2 text-[10px] leading-tight text-t2">${esc(ativa.rotulo)}</span><span class="num mt-0.5 text-[10px] text-t3">${fmt(ativa.valor)} ${unidade}</span>`
      : `<span class="num text-[26px] font-semibold leading-none text-t1">${fmt(total)}</span><span class="mt-1 text-[10px] uppercase tracking-[0.12em] text-t3">${esc(rotuloTotal)}</span>`;
    const lista = fatias
      .map(
        (f) =>
          `<li data-foco="${esc(f.id)}" class="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] transition-colors ${foco === f.id ? "bg-[var(--viz-grade)]" : ""}"><span class="h-2.5 w-2.5 flex-none rounded-[3px]" style="background:${f.cor}" aria-hidden="true"></span>` +
          `<span class="min-w-0 flex-1"><span class="line-clamp-2 leading-tight text-t1" title="${esc(f.rotulo)}">${esc(f.rotulo)}</span>${f.detalhe ? `<span class="mt-0.5 block text-[10px] leading-tight text-t4">${esc(f.detalhe)}</span>` : ""}</span>` +
          `<span class="num flex-none text-right text-t1"><strong>${fmtPct(pct(f.valor, total))}</strong><span class="block text-[10px] font-normal text-t3">${fmt(f.valor)}</span></span></li>`,
      )
      .join("");
    return (
      `<div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center xl:flex-col"><div class="relative flex-none" style="width:${T}px;height:${T}px">` +
      `<svg width="${T}" height="${T}" viewBox="0 0 ${T} ${T}" role="img" aria-label="${esc(rotuloTotal)}: ${fmt(total)} ${unidade}">${svg}</svg>` +
      `<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">${centro}</div></div>` +
      `<ul class="w-full min-w-0 flex-1 space-y-1 xl:grid xl:grid-cols-2 xl:gap-x-2 xl:space-y-0">${lista}</ul></div>`
    );
  }
  function rosca(el, cfg) {
    montar(el, (s) => htmlRosca(cfg, s.foco));
  }

  /** Vales pendentes de fornecedor: alterna por fornecedor e por idade. */
  function valesFornecedor(el, cfg) {
    let modo = "fornecedor";
    const s = montar(el, (st) => {
      const abas = [["fornecedor", "Por fornecedor"], ["idade", "Por idade (aging)"]]
        .map(([v, r]) => `<button type="button" role="tab" aria-selected="${modo === v}" data-modo="${v}" class="${modo === v ? "aba aba-ativa" : "aba"}">${r}</button>`)
        .join("");
      return `<div><div class="abas mb-4 w-fit" role="tablist" aria-label="Agrupar vales pendentes">${abas}</div>${htmlRosca({ dados: modo === "fornecedor" ? cfg.porFornecedor : cfg.porIdade, rotuloTotal: "pallets em vales", vazio: "Nenhum vale-pallet pendente com fornecedores." }, st.foco)}</div>`;
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-modo]");
      if (!b) return;
      modo = b.dataset.modo;
      s.foco = null;
      el.__render();
    });
  }

  // ------------------------------------------------------------ GraficoBarrasCross
  function barrasCross(el, dados) {
    if (!dados.length) {
      el.innerHTML = `<p class="poco px-5 py-10 text-center text-[12px] text-t3">Nenhum pallet em estoque nos Pontos de Cross.</p>`;
      return;
    }
    montar(el, (s) => {
      if (!s.largura) return "";
      const total = dados.reduce((t, d) => t + d.saldo, 0);
      const W = Math.max(s.largura, 280);
      const NOME = Math.min(170, W * 0.36), VAL = 64, largBarras = Math.max(W - NOME - VAL, 60), linha = 38, espB = 22, EIXO = 22;
      const H = dados.length * linha + EIXO + 4;
      const { topo, passo } = escalaLimpa(Math.max(...dados.map((d) => d.saldo), 1), 4);
      const x = (v) => (v / topo) * largBarras;
      const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
      const foco = s.foco === null ? null : Number(s.foco);
      let svg = ticks
        .map((t) => `<g pointer-events="none"><line x1="${NOME + x(t)}" x2="${NOME + x(t)}" y1="2" y2="${H - EIXO}" stroke="var(--viz-grade)" stroke-width="1"/><text x="${NOME + x(t)}" y="${H - 6}" text-anchor="middle" class="num fill-t4 text-[10px]">${fmt(t)}</text></g>`)
        .join("");
      svg += dados
        .map((b, i) => {
          const y = i * linha + 8;
          return (
            `<g data-foco="${i}" tabindex="0" class="cursor-pointer outline-none" aria-label="${esc(b.codigo)} ${esc(b.nome)}: ${b.saldo} pallets em estoque (${b.bons} Pallets PBR, ${b.quebrados} Pallets Quebrados)">` +
            `<rect x="0" y="${y - 8}" width="${W}" height="${linha}" rx="10" fill="${foco === i ? "var(--viz-grade)" : "transparent"}"/>` +
            `<text pointer-events="none" x="${NOME - 12}" y="${y + espB / 2 - 1}" text-anchor="end" class="num fill-t1 text-[11px] font-semibold">${esc(b.codigo)}</text>` +
            `<text pointer-events="none" x="${NOME - 12}" y="${y + espB / 2 + 11}" text-anchor="end" class="fill-t3 text-[10px]">${esc(b.nome.length > 22 ? `${b.nome.slice(0, 21)}…` : b.nome)}</text>` +
            `<path d="${barra(NOME, y, Math.max(x(b.saldo), 3), espB, "direita")}" fill="var(--viz-cat-1)"/>` +
            `<text pointer-events="none" x="${NOME + x(b.saldo) + 8}" y="${y + espB / 2 + 4}" class="num fill-t1 text-[12px] font-semibold">${fmt(b.saldo)}</text></g>`
          );
        })
        .join("");
      const d = foco !== null ? dados[foco] : null;
      const tip = d
        ? dica(NOME + x(d.saldo), foco * linha, W,
            `<p class="mb-1 font-semibold text-t1">${esc(d.codigo)} · ${esc(d.nome)}</p>` +
            `<div class="flex justify-between gap-4"><span>Estoque total</span><strong class="num text-t1">${fmt(d.saldo)} pallets</strong></div>` +
            `<div class="flex justify-between gap-4"><span>Participação no total</span><strong class="num text-t1">${total ? ((d.saldo / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : 0}%</strong></div>` +
            `<div class="flex justify-between gap-4"><span>Pallets PBR</span><strong class="num text-lima">${fmt(d.bons)}</strong></div>` +
            `<div class="flex justify-between gap-4"><span>Pallets Quebrados</span><strong class="num text-ouro">${fmt(d.quebrados)}</strong></div>` +
            `<div class="flex justify-between gap-4"><span>A receber</span><strong class="num text-t1">${fmt(d.aReceber)}</strong></div>`)
        : "";
      return `<div class="relative" data-testid="grafico-barras-cross"><svg width="${W}" height="${H}" role="img" aria-label="Estoque por Ponto de Cross">${svg}</svg>${tip}</div>`;
    });
  }

  // ------------------------------------------------------------ GraficoFluxo
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const rotuloX = (inicio, g) => {
    const [a, m, d] = inicio.split("-");
    return g === "mes" ? `${MESES[Number(m) - 1]}/${a.slice(2)}` : `${d}/${m}`;
  };
  const rotuloLongo = (inicio, g) => {
    const [a, m, d] = inicio.split("-");
    if (g === "mes") return `${MESES[Number(m) - 1]} de ${a}`;
    if (g === "semana") return `Semana de ${d}/${m}/${a}`;
    return `${d}/${m}/${a}`;
  };
  function fluxo(el, cfg) {
    const { serie, granularidade, saldoInicial } = cfg;
    if (!serie.length) {
      el.innerHTML = `<p class="poco px-5 py-10 text-center text-[12px] text-t3">Sem entradas ou saídas no período.</p>`;
      return;
    }
    const ESQ = 44, DIR = 12;
    montar(el, (s) => {
      const W = Math.max(s.largura, 280);
      const n = serie.length;
      const slot = (W - ESQ - DIR) / n;
      const col = Math.min(24, Math.max(3, slot * 0.6));
      const xC = (i) => ESQ + slot * i + slot / 2;
      const H1 = 190, meio = H1 / 2;
      const maxVal = Math.max(...serie.map((p) => Math.max(p.entradas, p.saidas)), 1);
      const { topo, passo } = escalaLimpa(maxVal, 2);
      const y1 = (v) => (v / topo) * (meio - 10);
      const saldos = [];
      if (saldoInicial !== null) {
        let acc = saldoInicial;
        for (const p of serie) saldos.push((acc += p.entradas - p.saidas));
      }
      const H2 = 110;
      const minS = saldos.length ? Math.min(...saldos, saldoInicial ?? 0) : 0;
      const maxS = saldos.length ? Math.max(...saldos, saldoInicial ?? 0) : 1;
      const escS = escalaLimpa(maxS - Math.min(minS, 0), 2);
      const baseS = Math.min(minS, 0);
      const y2 = (v) => H2 - 16 - ((v - baseS) / escS.topo) * (H2 - 30);
      const cadaN = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((W - ESQ) / 56))));
      const totalE = serie.reduce((t, p) => t + p.entradas, 0);
      const totalS = serie.reduce((t, p) => t + p.saidas, 0);
      const ticks = [-topo, -topo + passo, 0, topo - passo, topo].filter((v, i, a) => a.indexOf(v) === i);
      const foco = s.foco === null ? null : Number(s.foco);
      let h =
        `<div class="relative"><div class="mb-3 flex flex-wrap items-center justify-between gap-2">${legenda([{ cor: "var(--viz-entrada)", rotulo: "Entradas", valor: fmt(totalE) }, { cor: "var(--viz-saida)", rotulo: "Saídas", valor: fmt(totalS) }])}` +
        `<span class="text-[11px] text-t3">Líquido no período: <strong class="num text-t1">${totalE - totalS > 0 ? "+" : ""}${fmt(totalE - totalS)}</strong></span></div>`;
      if (!s.largura) return h + "</div>";
      h += `<svg width="${W}" height="${H1}" role="img" aria-label="Entradas e saídas por período">`;
      h += ticks.map((t) => `<g><line pointer-events="none" x1="${ESQ}" x2="${W - DIR}" y1="${meio - y1(t)}" y2="${meio - y1(t)}" stroke="var(--viz-grade)" stroke-width="1"/><text pointer-events="none" x="${ESQ - 8}" y="${meio - y1(t) + 3.5}" text-anchor="end" class="num fill-t3 text-[10px]">${t === 0 ? "0" : fmt(Math.abs(t))}</text></g>`).join("");
      h += serie
        .map((pt, i) =>
          `<g data-foco="${i}" tabindex="0" aria-label="${rotuloLongo(pt.inicio, granularidade)}: entradas ${pt.entradas}, saídas ${pt.saidas}"><rect x="${xC(i) - slot / 2}" y="0" width="${slot}" height="${H1}" fill="${foco === i ? "var(--viz-grade)" : "transparent"}"/>` +
          `<path d="${barra(xC(i) - col / 2, meio - 1 - y1(pt.entradas), col, y1(pt.entradas), "cima")}" fill="var(--viz-entrada)"/><path d="${barra(xC(i) - col / 2, meio + 1, col, y1(pt.saidas), "baixo")}" fill="var(--viz-saida)"/></g>`)
        .join("");
      h += `<line pointer-events="none" x1="${ESQ}" x2="${W - DIR}" y1="${meio}" y2="${meio}" stroke="var(--c-t3-hex, currentColor)" class="text-t4" stroke-width="1"/></svg>`;
      if (saldoInicial !== null) {
        h += `<p class="label mb-1 mt-4">Saldo total dos estoques físicos (Pallets PBR + Pallets Quebrados) ao fim de cada período</p><svg width="${W}" height="${H2}" role="img" aria-label="Saldo total ao longo do período">`;
        h += [baseS, baseS + escS.topo / 2, baseS + escS.topo].map((t) => `<g><line pointer-events="none" x1="${ESQ}" x2="${W - DIR}" y1="${y2(t)}" y2="${y2(t)}" stroke="var(--viz-grade)" stroke-width="1"/><text pointer-events="none" x="${ESQ - 8}" y="${y2(t) + 3.5}" text-anchor="end" class="num fill-t3 text-[10px]">${fmt(t)}</text></g>`).join("");
        h += `<path d="M${xC(0)},${y2(baseS)} ${saldos.map((v, i) => `L${xC(i)},${y2(v)}`).join(" ")} L${xC(n - 1)},${y2(baseS)}Z" fill="var(--viz-vazios)" opacity="0.1"/>`;
        h += `<path d="${saldos.map((v, i) => `${i ? "L" : "M"}${xC(i)},${y2(v)}`).join(" ")}" fill="none" stroke="var(--viz-vazios)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
        if (foco !== null) h += `<line pointer-events="none" x1="${xC(foco)}" x2="${xC(foco)}" y1="6" y2="${H2 - 16}" stroke="var(--viz-grade)" stroke-width="1"/>`;
        h += saldos.map((v, i) => (i === n - 1 || foco === i ? `<circle cx="${xC(i)}" cy="${y2(v)}" r="4" fill="var(--viz-vazios)" stroke="var(--opcao)" stroke-width="2"/>` : "")).join("");
        h += `<text pointer-events="none" x="${Math.min(xC(n - 1), W - DIR - 4)}" y="${y2(saldos[n - 1]) - 9}" text-anchor="end" class="num fill-t1 text-[11px] font-semibold">${fmt(saldos[n - 1])}</text>`;
        h += serie.map((pt, i) => `<rect data-foco="${i}" x="${xC(i) - slot / 2}" y="0" width="${slot}" height="${H2}" fill="transparent"/>`).join("");
        h += `</svg>`;
      }
      h += `<svg width="${W}" height="18" aria-hidden="true">${serie.map((pt, i) => (i % cadaN === 0 ? `<text x="${xC(i)}" y="12" text-anchor="middle" class="num fill-t3 text-[10px]">${rotuloX(pt.inicio, granularidade)}</text>` : "")).join("")}</svg>`;
      if (foco !== null) {
        const p = serie[foco];
        h += dica(xC(foco), 10, W,
          `<p class="mb-1 font-semibold text-t1">${rotuloLongo(p.inicio, granularidade)}</p>` +
          linhaDica("var(--viz-entrada)", "Entradas", fmt(p.entradas)) + linhaDica("var(--viz-saida)", "Saídas", fmt(p.saidas)) +
          linhaDica(null, "Líquido", `${p.entradas - p.saidas > 0 ? "+" : ""}${fmt(p.entradas - p.saidas)}`) +
          (saldos.length ? linhaDica("var(--viz-vazios)", "Saldo ao fim", fmt(saldos[foco])) : ""));
      }
      return h + "</div>";
    });
  }

  const TIPOS = { composicao, rosca, "barras-cross": barrasCross, fluxo, "vales-fornecedor": valesFornecedor };
  document.querySelectorAll("[data-grafico]").forEach((el) => {
    const f = TIPOS[el.dataset.grafico];
    if (f) f(el, JSON.parse(el.dataset.dados || "null"));
  });
})();
