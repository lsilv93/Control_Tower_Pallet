/* Control Tower Pallet — Torre de Controle: relógio e atualização ao vivo (AtualizacaoTV),
 * filtro de unidades (FiltroTV), paginação automática das tabelas (PaginadorTV) e tela cheia. */
(function () {
  "use strict";
  const CTP = window.CTP;
  const { esc, qs, qsa } = CTP;

  // ------------------------------------------------------------ relógio e atualização
  const atual = qs("[data-atualizacao-tv]");
  if (atual) {
    let versao = atual.dataset.atualizacaoTv;
    let ultimaCarga = Date.now();
    const hora = (d, seg = true) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", ...(seg ? { second: "2-digit" } : {}) });
    const carregado = new Date();
    const status = (falhou) =>
      (qs("[data-status-tv]").outerHTML = `<span class="pill ${falhou ? "bg-erro/10 text-erro" : "bg-lima/10 text-lima"}" data-status-tv><span class="ponto ponto-pulsante"></span> ${falhou ? "Sem conexão" : `Ao vivo · ${hora(carregado)}`}</span>`);
    const relogio = () => {
      const agora = new Date();
      qs("[data-relogio]").textContent = hora(agora, false);
      qs("[data-data]").textContent = agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" });
    };
    relogio();
    status(false);
    setInterval(relogio, 1000);
    // Consulta a versão a cada 10 s e recarrega com um novo lançamento; recarrega também a cada 60 s.
    setInterval(async () => {
      try {
        const r = await fetch("/api/tv/versao", { cache: "no-store", credentials: "same-origin" });
        if (r.status === 401) return (window.location.href = "/login");
        const { versao: nova } = await r.json();
        status(false);
        if ((nova && nova !== versao) || Date.now() - ultimaCarga > 60000) {
          versao = nova || versao;
          ultimaCarga = Date.now();
          if (!qs("[role=dialog]")) window.location.reload();
        }
      } catch {
        status(true);
      }
    }, 10000);
  }

  // ------------------------------------------------------------ tela cheia
  const botaoCheia = qs("[data-tela-cheia]");
  if (botaoCheia) {
    const el = document.documentElement;
    if (!(el.requestFullscreen || el.webkitRequestFullscreen)) botaoCheia.remove();
    const emCheia = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const atualizar = () => {
      const c = emCheia();
      botaoCheia.className = c ? "btn-secondary" : "btn-primary";
      botaoCheia.title = c ? "Sair da tela cheia (Esc)" : "Expandir para tela cheia";
      botaoCheia.setAttribute("aria-pressed", c ? "true" : "false");
      botaoCheia.innerHTML = `${CTP.icone(c ? "minimize-2" : "maximize-2")} ${c ? "Sair (Esc)" : "Tela cheia"}`;
    };
    botaoCheia.addEventListener("click", async () => {
      try {
        if (emCheia()) await (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen());
        else await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen());
      } catch {}
    });
    document.addEventListener("fullscreenchange", atualizar);
    document.addEventListener("webkitfullscreenchange", atualizar);
  }

  // ------------------------------------------------------------ filtro de unidades
  const filtro = qs("[data-filtro-tv]");
  if (filtro) {
    const { opcoes, selecionados } = JSON.parse(filtro.dataset.filtroTv);
    let marcados = [...selecionados];
    const ir = (codigos) => window.location.assign(codigos.length ? `/tv?u=${codigos.join(",")}` : "/tv");
    const caixa = qs("[data-caixa-filtro]", filtro);
    const botao = qs("[data-abrir-filtro]", filtro);
    let painel = null;
    const fechar = () => {
      painel && painel.remove();
      painel = null;
      botao.setAttribute("aria-expanded", "false");
    };
    const abrir = () => {
      const grupos = [["Centros de Distribuição", opcoes.filter((o) => o.tipo === "CD")], ["Pontos de Cross", opcoes.filter((o) => o.tipo === "CROSS")]];
      painel = document.createElement("div");
      painel.className = "card absolute left-0 top-full z-30 mt-2 w-[min(92vw,420px)] p-4 shadow-2xl";
      painel.setAttribute("role", "dialog");
      painel.setAttribute("aria-label", "Filtrar unidades");
      painel.innerHTML =
        `<div class="max-h-[60vh] space-y-4 overflow-auto">` +
        grupos
          .filter(([, itens]) => itens.length)
          .map(
            ([titulo, itens]) =>
              `<fieldset><legend class="label mb-2">${titulo}</legend><div class="grid grid-cols-2 gap-1.5">` +
              itens
                .map(
                  (o) =>
                    `<label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-t2 hover:bg-[var(--groove)]" title="${esc(o.nome)}"><input type="checkbox" value="${esc(o.codigo)}"${marcados.includes(o.codigo) ? " checked" : ""} data-testid="filtro-op-${esc(o.codigo)}"><span class="num font-semibold text-t1">${esc(o.codigo)}</span>${o.hub ? '<span class="text-[10px] font-bold text-lima">HUB</span>' : ""}</label>`,
                )
                .join("") +
              `</div></fieldset>`,
          )
          .join("") +
        `</div><div class="mt-4 flex items-center justify-between gap-2 border-t border-[var(--groove)] pt-3"><button type="button" class="text-[12px] text-t3 hover:text-t1" data-limpar>Limpar</button>` +
        `<button type="button" class="btn-primary !py-1.5 text-[12px]" data-testid="filtro-aplicar">${CTP.icone("check")} Aplicar</button></div>`;
      caixa.appendChild(painel);
      botao.setAttribute("aria-expanded", "true");
      painel.addEventListener("change", (e) => {
        const c = e.target.value;
        marcados = e.target.checked ? [...marcados, c] : marcados.filter((x) => x !== c);
      });
      qs("[data-limpar]", painel).addEventListener("click", () => {
        marcados = [];
        qsa("input", painel).forEach((i) => (i.checked = false));
      });
      qs("[data-testid=filtro-aplicar]", painel).addEventListener("click", () => (fechar(), ir(marcados)));
    };
    botao.addEventListener("click", () => (painel ? fechar() : abrir()));
    document.addEventListener("mousedown", (e) => painel && !caixa.contains(e.target) && fechar());
    document.addEventListener("keydown", (e) => e.key === "Escape" && fechar());
    qs("[data-visao-geral]", filtro).addEventListener("click", () => ir([]));
    qsa("[data-remover]", filtro).forEach((b) => b.addEventListener("click", () => ir(selecionados.filter((x) => x !== b.dataset.remover))));
  }

  // ------------------------------------------------------------ paginação das tabelas (encaixe na tela)
  /**
   * Mostra só as linhas que cabem na altura disponível e alterna as páginas a cada 12 s.
   * Abaixo de lg (celular/tablet) mostra todas as linhas e a página rola normalmente.
   */
  qsa("[data-paginador]").forEach((caixa) => {
    const area = qs("[data-paginador-area]", caixa);
    const rotulo = caixa.querySelector("[data-testid$='-pagina']");
    const telaGrande = window.matchMedia("(min-width: 1024px)");
    let pagina = 0;
    const aplicar = (avancar = false) => {
      const linhas = qsa("tbody > tr", area);
      if (!telaGrande.matches || !linhas.length) {
        linhas.forEach((l) => (l.style.display = ""));
        pagina = 0;
        rotulo.textContent = "";
        return;
      }
      linhas.forEach((l) => (l.style.display = ""));
      const cab = area.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const alturaLinha = Math.max(...linhas.map((l) => l.getBoundingClientRect().height), 1);
      const porPagina = Math.max(1, Math.floor((area.clientHeight - cab - 4) / alturaLinha));
      const total = Math.max(1, Math.ceil(linhas.length / porPagina));
      pagina = avancar ? (pagina + 1) % total : Math.min(pagina, total - 1);
      const inicio = pagina * porPagina;
      linhas.forEach((l, i) => (l.style.display = i >= inicio && i < inicio + porPagina ? "" : "none"));
      rotulo.textContent = total > 1 ? `Página ${pagina + 1}/${total} · troca automática` : "";
    };
    aplicar();
    new ResizeObserver(() => aplicar()).observe(area);
    telaGrande.addEventListener("change", () => aplicar());
    setInterval(() => aplicar(true), 12000);
  });
})();
