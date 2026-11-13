/* Control Tower Pallet — JavaScript da interface (vanilla, sem dependências).
 * Substitui os componentes cliente do React: formulários ligados às ações do servidor,
 * mensagens de retorno, confirmações (modais), máscaras, tema, menu, Sair e atualização. */
(function () {
  "use strict";
  const CTP = (window.CTP = window.CTP || {});

  // ---------------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  CTP.esc = esc;
  CTP.n = (v) => new Intl.NumberFormat("pt-BR").format(Number(v) || 0);
  CTP.qs = (s, r = document) => r.querySelector(s);
  CTP.qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  /** HTML da mensagem de retorno (igual ao componente Mensagem). */
  CTP.mensagemHtml = (estado) =>
    estado
      ? `<div role="status" class="flex items-start gap-2.5 px-4 py-3 text-[12px] font-medium ${estado.ok ? "poco text-lima" : "poco-erro text-erro-claro"}">` +
        `<span class="ponto mt-[5px] ${estado.ok ? "text-lima" : "text-erro"}"></span><span>${esc(estado.mensagem)}</span></div>`
      : "";

  /** Envia dados a uma ação do servidor e devolve o JSON ({ok, mensagem} ou {redirecionar}). */
  CTP.acao = async (url, dados) => {
    const r = await fetch(url, { method: "POST", body: dados, headers: { "X-Requested-With": "ctp", Accept: "application/json" }, credentials: "same-origin" });
    let j;
    try {
      j = await r.json();
    } catch {
      j = { ok: false, mensagem: "Erro inesperado ao processar a operação. Tente novamente." };
    }
    if (j && j.redirecionar) {
      window.location.assign(j.redirecionar);
      return { ...j, navegando: true };
    }
    return j;
  };

  // ---------------------------------------------------------------- modal de confirmação
  /**
   * Abre um diálogo modal (mesmo visual do Modal do sistema). Devolve o elemento; `aoFechar`
   * é chamado ao fechar (Esc, clique fora ou botão). Conteúdo em HTML.
   */
  CTP.modal = ({ titulo, html, aoFechar, largura = "max-w-md" }) => {
    const fundo = document.createElement("div");
    fundo.className = "fixed inset-0 z-50 flex items-center justify-center bg-[#000814]/70 p-[14px]";
    fundo.innerHTML = `<div role="dialog" aria-modal="true" class="card entrada w-full ${largura} max-h-[90vh] overflow-y-auto p-6">` +
      `<div class="mb-4 flex items-center justify-between gap-3"><h2 class="text-[15px] font-semibold text-t1">${esc(titulo)}</h2>` +
      `<button type="button" class="btn-icone !h-8 !w-8" data-fechar aria-label="Fechar">${CTP.icones.x}</button></div><div data-corpo>${html}</div></div>`;
    const fechar = () => {
      fundo.remove();
      document.removeEventListener("keydown", tecla);
      aoFechar && aoFechar();
    };
    const tecla = (e) => e.key === "Escape" && fechar();
    fundo.addEventListener("mousedown", (e) => e.target === fundo && fechar());
    fundo.querySelector("[data-fechar]").addEventListener("click", fechar);
    document.addEventListener("keydown", tecla);
    document.body.appendChild(fundo);
    fundo.fechar = fechar;
    const foco = fundo.querySelector("[autofocus], textarea, input:not([type=hidden]), button.btn-primary, button.btn-danger");
    foco && setTimeout(() => foco.focus(), 30);
    return fundo;
  };

  /**
   * Confirmação "Tem certeza?" com dois botões. Resolve true/false.
   * Opções: titulo, pergunta (testid opcional), texto, confirmar, cancelar, perigo.
   */
  CTP.confirmar = (o) =>
    new Promise((resolver) => {
      let decidido = false;
      const m = CTP.modal({
        titulo: o.titulo || "Confirmação",
        html:
          `<p class="text-[14px] font-semibold text-t1"${o.testid ? ` data-testid="${esc(o.testid)}"` : ""}>${esc(o.pergunta || "Tem certeza?")}</p>` +
          (o.texto ? `<div class="mt-2 text-[12px] leading-relaxed text-t3">${o.texto}</div>` : "") +
          `<div class="mt-6 flex flex-wrap justify-end gap-2"><button type="button" class="btn-secondary" data-nao>${esc(o.cancelar || "Cancelar")}</button>` +
          `<button type="button" class="${o.perigo ? "btn-danger" : "btn-primary"}" data-sim>${esc(o.confirmar || "Confirmar")}</button></div>`,
        aoFechar: () => !decidido && resolver(false),
      });
      m.querySelector("[data-nao]").addEventListener("click", () => m.fechar());
      m.querySelector("[data-sim]").addEventListener("click", () => {
        decidido = true;
        m.fechar();
        resolver(true);
      });
    });

  // ---------------------------------------------------------------- formulários de ação
  /** Mostra a mensagem de retorno dentro do formulário. */
  CTP.mostrarMensagem = (form, estado) => {
    const alvo = form.querySelector("[data-mensagem]");
    if (!alvo) return;
    alvo.innerHTML = CTP.mensagemHtml(estado);
    alvo.hidden = !estado;
  };

  /** Envia um formulário data-acao (usado também por telas com confirmação própria). */
  CTP.enviarForm = async (form, extra) => {
    const botao = form.querySelector("button[type=submit]");
    const texto = botao && botao.innerHTML;
    if (botao) {
      botao.disabled = true;
      if (botao.dataset.enviando) botao.textContent = botao.dataset.enviando;
    }
    const dados = new FormData(form);
    if (extra) for (const [k, v] of Object.entries(extra)) dados.set(k, v);
    let estado;
    try {
      estado = await CTP.acao(form.dataset.acao, dados);
    } catch {
      estado = { ok: false, mensagem: "Falha de conexão com o servidor. Tente novamente." };
    }
    if (estado.navegando) return estado;
    if (botao) {
      botao.disabled = false;
      botao.innerHTML = texto;
    }
    CTP.mostrarMensagem(form, estado);
    if (estado.ok && form.hasAttribute("data-limpar")) {
      form.reset();
      form.dispatchEvent(new Event("ctp:limpo"));
    }
    if (estado.recarregar) window.location.reload();
    form.dispatchEvent(new CustomEvent("ctp:resultado", { detail: estado }));
    return estado;
  };

  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.acao) return;
    e.preventDefault();
    if (!form.reportValidity()) return;
    // Telas com confirmação/validação própria tratam o evento e chamam CTP.enviarForm.
    const ev = new CustomEvent("ctp:enviar", { cancelable: true });
    if (!form.dispatchEvent(ev)) return;
    if (form.dataset.confirmar && !window.confirm(form.dataset.confirmar)) return;
    await CTP.enviarForm(form);
  });

  // ---------------------------------------------------------------- máscaras de digitação
  const mascaras = {
    cnpj(v) {
      const entrada = v.toUpperCase().replace(/[^0-9A-Z]/g, "");
      let c = "";
      for (const ch of entrada) {
        if (c.length >= 14) break;
        if (c.length < 12 ? /[0-9A-Z]/.test(ch) : /\d/.test(ch)) c += ch;
      }
      const p = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)];
      let r = p[0];
      if (p[1]) r += `.${p[1]}`;
      if (p[2]) r += `.${p[2]}`;
      if (p[3]) r += `/${p[3]}`;
      if (p[4]) r += `-${p[4]}`;
      return r;
    },
    telefone(v) {
      const d = v.replace(/\D/g, "").slice(0, 11);
      if (d.length <= 2) return d ? `(${d}` : "";
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    },
    cep(v) {
      const d = v.replace(/\D/g, "").slice(0, 8);
      return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
    },
    placa(v) {
      const entrada = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
      let p = "";
      for (const c of entrada) {
        const i = p.length;
        if (i >= 7) break;
        const letra = /[A-Z]/.test(c);
        const numero = /\d/.test(c);
        if (i < 3 ? letra : i === 3 || i >= 5 ? numero : letra || numero) p += c;
      }
      return p.length > 4 && /\d/.test(p[4]) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
    },
    maiusculas: (v) => v.toUpperCase(),
  };
  CTP.mascaras = mascaras;
  const cnpjValido = (valor) => {
    const cnpj = valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1+$/.test(cnpj)) return false;
    const calc = (base) => {
      const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const soma = base.split("").reduce((a, c, i) => a + (c.charCodeAt(0) - 48) * pesos[i], 0);
      const r = soma % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(cnpj.slice(0, 12));
    const d2 = calc(cnpj.slice(0, 12) + d1);
    return cnpj.endsWith(`${d1}${d2}`);
  };
  CTP.cnpjValido = cnpjValido;
  const placaValida = (p) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(p.toUpperCase().replace(/[^A-Z0-9]/g, ""));
  CTP.placaValida = placaValida;

  /** Aviso de validação abaixo do campo (CNPJ inválido, placa inválida...). */
  const avisar = (el, texto) => {
    let aviso = el.parentElement.querySelector("[data-aviso]");
    if (!texto) {
      aviso && aviso.remove();
      el.setCustomValidity("");
      return;
    }
    if (!aviso) {
      aviso = document.createElement("p");
      aviso.dataset.aviso = "";
      aviso.className = "mt-1 text-[11px] text-erro";
      el.insertAdjacentElement("afterend", aviso);
    }
    aviso.textContent = texto;
    el.setCustomValidity(texto);
  };
  CTP.avisar = avisar;
  const validar = (el) => {
    const v = el.value;
    if (el.dataset.mascara === "cnpj") avisar(el, v && v.replace(/[^0-9A-Z]/gi, "").length === 14 && !cnpjValido(v) ? "CNPJ inválido" : v && v.replace(/[^0-9A-Z]/gi, "").length > 0 && v.replace(/[^0-9A-Z]/gi, "").length < 14 && document.activeElement !== el ? "CNPJ incompleto" : "");
    if (el.dataset.mascara === "placa") avisar(el, v && !placaValida(v) && document.activeElement !== el ? "Placa inválida (ABC1234 ou ABC1D23)" : "");
  };
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.dataset.mascara) return;
    const f = mascaras[el.dataset.mascara];
    if (f) {
      const novo = f(el.value);
      if (novo !== el.value) el.value = novo;
    }
    validar(el);
  });
  document.addEventListener("focusout", (e) => e.target instanceof HTMLInputElement && e.target.dataset.mascara && validar(e.target));

  // ---------------------------------------------------------------- tema, menu e Sair
  document.addEventListener("click", async (e) => {
    const tema = e.target.closest("[data-tema]");
    if (tema) {
      const novo = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = novo;
      document.cookie = `ctp_tema=${novo}; path=/; max-age=31536000; samesite=lax`;
      CTP.qsa("[data-tema]").forEach((b) => {
        const rot = novo === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro";
        b.setAttribute("aria-label", rot);
        b.title = rot;
        const svg = novo === "dark" ? CTP.icones.sun : CTP.icones.moon;
        const comRotulo = b.classList.contains("w-full");
        b.innerHTML = comRotulo ? `${svg.replace("h-5 w-5", "h-4 w-4")}${novo === "dark" ? "Tema claro" : "Tema escuro"}` : svg;
      });
      return;
    }
    const sair = e.target.closest("[data-sair]");
    if (sair) {
      // Encerra a sessão no servidor (cookies apagados e token revogado), limpa o armazenamento
      // do navegador e recarrega a tela de login por completo.
      sair.disabled = true;
      if (sair.classList.contains("w-full")) sair.innerHTML = `${CTP.icones.logout} Saindo...`;
      try {
        await fetch("/acao/auth/sair", { method: "POST", headers: { "X-Requested-With": "ctp" }, credentials: "same-origin" });
      } catch {}
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {}
      window.location.replace("/login");
      return;
    }
    const abrir = e.target.closest("[data-menu-abrir]");
    const fundo = e.target.closest("[data-menu-fundo]");
    const link = e.target.closest("[data-menu] a");
    if (abrir || fundo || link) {
      const menu = CTP.qs("[data-menu]");
      if (!menu) return;
      const aberto = abrir ? menu.classList.contains("-translate-x-full") : false;
      menu.classList.toggle("translate-x-0", aberto);
      menu.classList.toggle("-translate-x-full", !aberto);
      CTP.qs("[data-menu-fundo]").hidden = !aberto;
      const b = CTP.qs("[data-menu-abrir]");
      if (b) {
        b.setAttribute("aria-label", aberto ? "Fechar menu" : "Abrir menu");
        b.querySelector("[data-icone-abrir]").hidden = aberto;
        b.querySelector("[data-icone-fechar]").hidden = !aberto;
      }
    }
  });

  // ---------------------------------------------------------------- atualização automática
  /**
   * Recarrega a tela quando os dados mudam (versão consultada em `url` a cada `consulta` s) ou,
   * por garantia, a cada `maximo` s. Mantém rolagem e não recarrega com formulário em edição.
   */
  CTP.atualizarQuandoMudar = ({ url, consulta = 15, maximo = 120, aoMudar }) => {
    let versao = null;
    let ultima = Date.now();
    const editando = () => {
      const a = document.activeElement;
      return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== "checkbox" && a.type !== "radio";
    };
    setInterval(async () => {
      let falhou = false;
      try {
        const r = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (r.status === 401) return window.location.assign("/login");
        const j = await r.json();
        if (versao === null) versao = j.versao;
        else if (j.versao !== versao || Date.now() - ultima > maximo * 1000) {
          versao = j.versao;
          ultima = Date.now();
          if (!editando() && !document.querySelector("[role=dialog]")) (aoMudar || CTP.recarregar)();
        }
      } catch {
        falhou = true;
      }
      document.dispatchEvent(new CustomEvent("ctp:conexao", { detail: { falhou } }));
    }, consulta * 1000);
  };

  /** Recarrega mantendo a posição de rolagem. */
  CTP.recarregar = () => {
    try {
      sessionStorage.setItem("ctp_rolagem", `${location.pathname}${location.search}|${window.scrollY}`);
    } catch {}
    window.location.reload();
  };
  try {
    const salvo = sessionStorage.getItem("ctp_rolagem");
    if (salvo) {
      const [pagina, y] = salvo.split("|");
      if (pagina === `${location.pathname}${location.search}`) window.addEventListener("load", () => window.scrollTo(0, Number(y)));
      sessionStorage.removeItem("ctp_rolagem");
    }
  } catch {}

  // Ícones usados pelo JavaScript (mesmo traçado lucide).
  const svg = (d, c = "h-5 w-5") =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide ${c}" aria-hidden="true">${d}</svg>`;
  CTP.icones = {
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', "h-4 w-4"),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    moon: svg('<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>'),
    logout: svg('<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>', "h-4 w-4"),
  };
})();
