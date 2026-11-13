/* Control Tower Pallet — comportamentos específicos das telas (vanilla JS).
 * Cada bloco é ativado pelo atributo data-* do formulário/elemento da tela. */
(function () {
  "use strict";
  const CTP = window.CTP;
  const { esc, n, qs, qsa } = CTP;
  const int = (v) => Math.max(0, Math.trunc(Number(v) || 0));

  // ------------------------------------------------------------ Envio de pallets (FormEnvio)
  /**
   * Valida o saldo na tela (o servidor valida de novo, com o saldo travado) e, antes de
   * registrar, pede a confirmação do destino e da quantidade.
   */
  qsa("form[data-envio]").forEach((form) => {
    const cfg = JSON.parse(form.dataset.envio);
    const bons = () => (cfg.modo === "HUB" ? 0 : int(qs("#quantidadeBons", form)?.value));
    const quebrados = () => int(qs("#quantidadeQuebrados", form)?.value);
    const erroBox = qs("[data-erro-envio]", form);
    const mostrarErro = (msg) => {
      erroBox.hidden = !msg;
      erroBox.innerHTML = msg
        ? `<div role="alert" class="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-medium text-erro-claro">${CTP.iconeAlerta} ${esc(msg)}</div>`
        : "";
    };
    const atualizarDisponivel = () => {
      if (!cfg.consomeEstoque) return;
      const fb = bons() > cfg.saldo.vazios;
      const fq = quebrados() > cfg.saldo.quebrados;
      const pb = qs("[data-disponivel=bons]", form);
      const pq = qs("[data-disponivel=quebrados]", form);
      if (pb) pb.className = `mt-1 text-[11px] ${fb ? "font-semibold text-erro" : "text-t4"}`;
      if (pq) pq.className = `mt-1 text-[11px] ${fq ? "font-semibold text-erro" : "text-t4"}`;
    };
    form.addEventListener("input", atualizarDisponivel);
    form.addEventListener("ctp:enviar", (e) => {
      e.preventDefault();
      mostrarErro(null);
      const qb = bons();
      const qq = quebrados();
      const total = qb + qq;
      if (total <= 0) return mostrarErro("Informe a quantidade de pallets a enviar.");
      const fb = cfg.consomeEstoque && qb > cfg.saldo.vazios;
      const fq = cfg.consomeEstoque && qq > cfg.saldo.quebrados;
      if (fb || fq) {
        return mostrarErro(
          `Saldo insuficiente em ${cfg.origem}: ${fb ? `Pallets PBR disponíveis ${n(cfg.saldo.vazios)}, solicitado ${n(qb)}` : ""}${fb && fq ? " · " : ""}${fq ? `Pallets Quebrados disponíveis ${n(cfg.saldo.quebrados)}, solicitado ${n(qq)}` : ""}. Envio bloqueado.`,
        );
      }
      const destino = cfg.destinos.find((d) => d.id === qs("#unidadeId", form).value);
      if (!destino) return;
      const m = CTP.modal({
        titulo: "Confirmar envio",
        html:
          `<p class="mb-4 text-[14px] font-semibold text-t1" data-testid="pergunta-envio">Tem certeza do ${esc(cfg.tipoDestino)} selecionado e da quantidade informada (${n(total)} pallets)?</p>` +
          `<dl class="poco mb-5 grid grid-cols-2 gap-3 p-4 text-[12px]">` +
          `<div><dt class="text-t4">Origem</dt><dd class="num font-semibold text-t1">${esc(cfg.origem)}</dd></div>` +
          `<div><dt class="text-t4">Destino</dt><dd class="font-semibold text-t1"><span class="num">${esc(destino.codigo)}</span> · ${esc(destino.nome)}</dd></div>` +
          (cfg.modo !== "HUB" ? `<div><dt class="text-t4">Pallets PBR</dt><dd class="num text-[18px] font-semibold text-lima">${n(qb)}</dd></div>` : "") +
          `<div><dt class="text-t4">Pallets Quebrados</dt><dd class="num text-[18px] font-semibold text-ouro">${n(qq)}</dd></div></dl>` +
          `<p class="mb-4 text-[11px] text-t3">${
            cfg.consomeEstoque
              ? `Os pallets saem do estoque de ${esc(cfg.origem)} e ficam em trânsito até a conferência em ${esc(destino.codigo)}.`
              : `Remessa sem consumo do estoque de ${esc(cfg.origem)}: fica em trânsito até a conferência em ${esc(destino.codigo)}.`
          }</p>` +
          `<div class="flex gap-3"><button type="button" class="btn-secondary flex-1" data-corrigir>Corrigir</button><button type="button" class="btn-primary flex-1" data-confirmar>Confirmar envio</button></div>`,
      });
      qs("[data-corrigir]", m).addEventListener("click", () => m.fechar());
      qs("[data-confirmar]", m).addEventListener("click", () => {
        m.fechar();
        CTP.enviarForm(form);
      });
    });
  });
  // ------------------------------------------------------------ Conferência de recebimento (FormConferencia)
  /**
   * Seleciona os vales do remetente (soma automática; placa e transportadora vêm do envio),
   * compara com a contagem física e, havendo divergência, pede a confirmação com justificativa.
   */
  qsa("form[data-conferencia]").forEach((form) => {
    const vales = JSON.parse(form.dataset.conferencia);
    const rem = qs("#remetenteId", form);
    const lista = qs("[data-vales-conferir]", form);
    const inBons = qs("#recebidoBons", form);
    const inQuebr = qs("#recebidoQuebrados", form);
    const placa = qs("#placa", form);
    const transp = qs("#transportadoraId", form);
    const obs = qs("#observacao", form);
    const botao = qs("button[type=submit]", form);
    const hidden = form.querySelector("input[name=confirmarDivergencia]");
    let selecionados = new Set();
    let confirmada = false;
    const inteiro = (v) => (v === "" ? null : Math.max(0, Math.trunc(Number(v) || 0)));
    const sinal = (v) => (v > 0 ? `+${n(v)}` : n(v));
    const doRemetente = () => vales.filter((v) => v.remetenteId === rem.value);
    const calc = () => {
      const esc0 = doRemetente().filter((v) => selecionados.has(v.id));
      const db = esc0.reduce((s, v) => s + v.bons, 0);
      const dq = esc0.reduce((s, v) => s + v.quebrados, 0);
      const declarado = db + dq;
      const qb = inteiro(inBons.value);
      const qq = inteiro(inQuebr.value);
      const informado = qb !== null || qq !== null;
      const recebido = (qb ?? 0) + (qq ?? 0);
      const diferenca = informado && declarado > 0 ? recebido - declarado : 0;
      return { db, dq, declarado, qb, qq, informado, recebido, diferenca, divergente: diferenca !== 0 };
    };
    const rotuloDiv = (d) => (d < 0 ? `falta de ${n(-d)}` : `sobra de ${n(d)}`);
    const render = () => {
      const c = calc();
      qs("[data-testid=total-vales]", form).textContent = n(c.declarado);
      qs("[data-declarado-bons]", form).textContent = n(c.db);
      qs("[data-declarado-quebrados]", form).textContent = n(c.dq);
      const dif = qs("[data-testid=diferenca]", form);
      dif.textContent = c.informado && c.declarado > 0 ? sinal(c.diferenca) : "—";
      dif.className = `num text-[16px] font-semibold ${c.divergente ? "text-erro" : "text-t3"}`;
      const alerta = qs("[data-alerta-divergencia]", form);
      alerta.hidden = !(c.divergente && !confirmada);
      alerta.innerHTML = c.divergente && !confirmada
        ? `<p role="alert" class="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-semibold text-erro-claro" data-testid="alerta-divergencia">${CTP.iconeAlerta} Divergência de ${sinal(c.diferenca)} pallet(s) em relação ao enviado (${rotuloDiv(c.diferenca)}).</p>`
        : "";
      const ok = confirmada && c.divergente;
      const conf = qs("[data-divergencia-confirmada]", form);
      conf.hidden = !ok;
      conf.innerHTML = ok ? `<p class="poco-erro px-4 py-3 text-[12px] font-semibold text-erro-claro" data-testid="divergencia-confirmada">Divergência confirmada: ${rotuloDiv(c.diferenca)} pallet(s). A justificativa é obrigatória.</p>` : "";
      hidden.value = ok ? "1" : "0";
      qs("[data-bloco-justificativa]", form).className = `space-y-4${ok ? " rounded-2xl p-3 ring-1 ring-erro/40" : ""}`;
      qs("label[for=observacao]", form).textContent = ok ? "Justificativa da divergência *" : "Observação";
      obs.required = ok;
      if (ok) obs.minLength = 5;
      else obs.removeAttribute("minlength");
      botao.className = c.divergente ? "btn-danger w-full" : "btn-success w-full";
      botao.innerHTML = `${CTP.icone("clipboard-check")} ${c.divergente && confirmada ? `Registrar conferência com ${rotuloDiv(c.diferenca)}` : "Registrar conferência"}`;
    };
    const reiniciar = () => {
      confirmada = false;
    };
    const preencherDoEnvio = () => {
      const primeiro = doRemetente().find((v) => selecionados.has(v.id));
      placa.value = CTP.mascaras.placa(primeiro?.placa ?? "");
      transp.value = primeiro?.transportadoraId ?? "";
    };
    const desenharLista = () => {
      const doRem = doRemetente();
      lista.hidden = !rem.value;
      if (!rem.value) return (lista.innerHTML = "");
      const todos = selecionados.size === doRem.length;
      lista.innerHTML =
        `<div class="mb-2 flex items-center justify-between"><legend class="label !mb-0">Vales recebidos *</legend>` +
        (doRem.length > 1 ? `<button type="button" class="text-[11px] font-semibold text-lima hover:underline" data-todos>${todos ? "Limpar" : "Selecionar todos"}</button>` : "") +
        `</div>` +
        (doRem.length === 0
          ? `<p class="poco px-4 py-3 text-[12px] text-t3">Nenhum vale pendente deste remetente.</p>`
          : `<div class="poco max-h-64 divide-y divide-[var(--groove)] overflow-auto" data-testid="vales-a-conferir">` +
            doRem
              .map(
                (v) =>
                  `<label class="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-[12px]"><input type="checkbox" name="valeIds" data-lista="valeIds" value="${esc(v.id)}"${selecionados.has(v.id) ? " checked" : ""}>` +
                  `<span class="min-w-0 flex-1"><span class="num font-semibold text-t1">${esc(v.codigo)}</span><span class="block text-[11px] text-t4">${esc(v.data)}${v.transportadora ? ` · ${esc(v.transportadora)}` : ""}${v.placa ? ` · ${esc(v.placa)}` : ""}</span></span>` +
                  `<span class="text-right text-[11px] text-t3"><span class="num block text-[13px] font-semibold text-t1">${n(v.quantidade)}</span>${n(v.bons)} PBR · ${n(v.quebrados)} quebrados</span></label>`,
              )
              .join("") +
            `</div>`);
    };
    const selecionar = (ids) => {
      reiniciar();
      selecionados = ids;
      preencherDoEnvio();
      desenharLista();
      render();
    };
    rem.addEventListener("change", () => selecionar(new Set()));
    lista.addEventListener("change", (e) => {
      if (e.target.name !== "valeIds") return;
      const nset = new Set(selecionados);
      if (e.target.checked) nset.add(e.target.value);
      else nset.delete(e.target.value);
      selecionar(nset);
    });
    lista.addEventListener("click", (e) => {
      if (!e.target.closest("[data-todos]")) return;
      const doRem = doRemetente();
      selecionar(selecionados.size === doRem.length ? new Set() : new Set(doRem.map((v) => v.id)));
    });
    [inBons, inQuebr].forEach((i) => i.addEventListener("input", () => (reiniciar(), render())));
    form.addEventListener("ctp:enviar", (e) => {
      const c = calc();
      if (!(c.divergente && !confirmada)) return;
      e.preventDefault();
      const m = CTP.modal({
        titulo: "Divergência na conferência",
        html:
          `<div role="alertdialog" aria-labelledby="aviso-divergencia" class="space-y-4 text-[12px]">` +
          `<p id="aviso-divergencia" class="flex items-start gap-2 text-[14px] font-semibold text-erro-claro">${CTP.icone("triangle-alert", "mt-0.5 h-5 w-5 flex-none text-erro")} Recebido ${n(c.recebido)} × enviado ${n(c.declarado)}: ${rotuloDiv(c.diferenca)} pallet(s). Confirmar a divergência?</p>` +
          `<dl class="poco grid grid-cols-3 gap-3 p-4 text-center"><div><dt class="text-t4">Pallets PBR</dt><dd class="num text-[16px] font-semibold text-t1">${sinal((c.qb ?? 0) - c.db)}</dd></div>` +
          `<div><dt class="text-t4">Pallets Quebrados</dt><dd class="num text-[16px] font-semibold text-t1">${sinal((c.qq ?? 0) - c.dq)}</dd></div>` +
          `<div><dt class="text-t4">Total</dt><dd class="num text-[16px] font-semibold text-erro">${sinal(c.diferenca)}</dd></div></dl>` +
          `<p class="text-t2">Será gerada uma <strong>ocorrência de ${c.diferenca < 0 ? "falta" : "sobra"}</strong> pendente na unidade remetente, que aceita ou recusa com justificativa.${c.diferenca > 0 ? " A sobra entra no estoque desta unidade agora." : ""}</p>` +
          `<div class="flex gap-3"><button type="button" class="btn-secondary flex-1" data-corrigir>Corrigir contagem</button><button type="button" class="btn-danger flex-1" data-confirmar>Confirmar divergência</button></div></div>`,
      });
      qs("[data-corrigir]", m).addEventListener("click", () => m.fechar());
      qs("[data-confirmar]", m).addEventListener("click", () => {
        confirmada = true;
        m.fechar();
        render();
      });
    });
    desenharLista();
    render();
  });
  // ------------------------------------------------------------ Resposta à ocorrência (FormRespostaOcorrencia)
  /** Aceitar (com confirmação do efeito) ou Recusar (justificativa obrigatória). */
  qsa("[data-resposta]").forEach((caixa) => {
    const cfg = JSON.parse(caixa.dataset.resposta);
    let justificativa = "";
    caixa.addEventListener("click", (e) => {
      const b = e.target.closest("[data-responder]");
      if (!b) return;
      const modo = b.dataset.responder;
      const aceitar = modo === "ACEITAR";
      const m = CTP.modal({
        titulo: `${aceitar ? "Aceitar" : "Recusar"} ${cfg.codigo}`,
        html:
          `<form class="space-y-4" novalidate>` +
          (aceitar
            ? `<p class="poco px-4 py-3 text-[12px] text-t2" data-testid="efeito-aceite">Ao aceitar, a ocorrência é encerrada e a conta corrente é ajustada em definitivo: <strong class="text-t1">${esc(cfg.efeito)}</strong>.</p>`
            : `<p class="poco-ouro px-4 py-3 text-[12px] text-ouro">A pendência volta para <strong>${esc(cfg.outra)}</strong> com a sua justificativa. O ciclo se repete até uma das unidades aceitar.</p>`) +
          `<div><label class="label" for="justificativa-${esc(cfg.valeId)}">${aceitar ? "Observação (opcional)" : "Justificativa da recusa *"}</label>` +
          `<textarea id="justificativa-${esc(cfg.valeId)}" class="input" rows="3" maxlength="500"${aceitar ? "" : ' required minlength="10" placeholder="Explique por que a divergência não procede (mínimo 10 caracteres)"'} autofocus>${esc(justificativa)}</textarea></div>` +
          `<div class="flex gap-3"><button type="button" class="btn-secondary flex-1" data-voltar>Voltar</button>` +
          `<button type="submit" class="${aceitar ? "btn-success" : "btn-danger"} flex-1">${aceitar ? "Confirmar aceite" : "Confirmar recusa"}</button></div></form>`,
      });
      const form = qs("form", m);
      const area = qs("textarea", m);
      area.addEventListener("input", () => (justificativa = area.value));
      qs("[data-voltar]", m).addEventListener("click", () => m.fechar());
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        if (!form.reportValidity()) return;
        const fd = new FormData();
        fd.set("valeId", cfg.valeId);
        fd.set("acao", modo);
        fd.set("aba", cfg.aba);
        if (justificativa.trim()) fd.set("justificativa", justificativa.trim());
        m.fechar();
        qsa("[data-responder]", caixa).forEach((x) => (x.disabled = true));
        let estado;
        try {
          estado = await CTP.acao("/acao/transferencias/responder-ocorrencia", fd);
        } catch {
          estado = { ok: false, mensagem: "Falha de conexão com o servidor. Tente novamente." };
        }
        if (estado.navegando) return;
        qsa("[data-responder]", caixa).forEach((x) => (x.disabled = false));
        const alvo = qs("[data-mensagem]", caixa);
        alvo.innerHTML = CTP.mensagemHtml(estado);
        alvo.hidden = false;
      });
    });
  });
  // ------------------------------------------------------------ Filtro de período do Painel (FiltroPeriodo)
  /** A seleção vai para a URL (compartilhável e mantida na atualização automática). */
  qsa("[data-filtro-periodo]").forEach((caixa) => {
    const v = JSON.parse(caixa.dataset.filtroPeriodo);
    const carregando = () => {
      const st = qs("[data-estado-filtro]", caixa);
      st.innerHTML = `<span class="ponto ponto-pulsante text-lima"></span>Atualizando...`;
    };
    const aplicar = (novo) => {
      Object.assign(v, novo);
      const q = new URLSearchParams({ periodo: v.tipo });
      if (v.fornecedor) q.set("fornecedor", v.fornecedor);
      if (v.tipo === "dia") q.set("dia", v.dia);
      if (v.tipo === "semana") (q.set("ano", v.ano), q.set("semana", v.semana));
      if (v.tipo === "mes") (q.set("ano", v.ano), q.set("mes", v.mes));
      if (v.tipo === "intervalo") (q.set("de", v.de), q.set("ate", v.ate));
      carregando();
      try {
        sessionStorage.setItem("ctp_rolagem", `${location.pathname}?${q}|${window.scrollY}`);
      } catch {}
      window.location.assign(`${location.pathname}?${q}`);
    };
    caixa.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tipo]");
      if (!b) return;
      const tipo = b.dataset.tipo;
      // "Intervalo" só aplica pelo botão (precisa das duas datas); os demais aplicam ao mudar.
      if (tipo !== "intervalo") return aplicar({ tipo });
      v.tipo = tipo;
      qsa("[data-tipo]", caixa).forEach((x) => {
        x.classList.toggle("aba-ativa", x === b);
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      qs("[data-linha-filtro]", caixa).hidden = false;
      qsa("[data-grupo]", caixa).forEach((g) => (g.hidden = !g.dataset.grupo.split(" ").includes("intervalo")));
    });
    qs("#filtro-dia", caixa)?.addEventListener("change", (e) => e.target.value && aplicar({ dia: e.target.value }));
    qs("#filtro-ano", caixa)?.addEventListener("change", (e) => aplicar({ ano: Number(e.target.value) }));
    qs("#filtro-semana", caixa)?.addEventListener("change", (e) => aplicar({ semana: Number(e.target.value) }));
    qs("#filtro-mes", caixa)?.addEventListener("change", (e) => aplicar({ mes: Number(e.target.value) }));
    qs("#filtro-fornecedor", caixa)?.addEventListener("change", (e) => {
      const q = new URLSearchParams(window.location.search);
      if (e.target.value) q.set("fornecedor", e.target.value);
      else q.delete("fornecedor");
      if (!q.get("periodo")) q.set("periodo", v.tipo);
      carregando();
      window.location.assign(`${location.pathname}?${q}`);
    });
    const de = qs("#filtro-de", caixa);
    const ate = qs("#filtro-ate", caixa);
    de?.addEventListener("change", () => (ate.min = de.value));
    ate?.addEventListener("change", () => (de.max = ate.value));
    qs("form[data-grupo=intervalo]", caixa)?.addEventListener("submit", (e) => {
      e.preventDefault();
      aplicar({ tipo: "intervalo", de: de.value, ate: ate.value });
    });
  });

  // ------------------------------------------------------------ Atualização automática do Painel
  qsa("[data-atualizacao-automatica]").forEach((caixa) => {
    qs("[data-atualizar]", caixa).addEventListener("click", () => CTP.recarregar());
    CTP.atualizarQuandoMudar({ url: "/api/tv/versao", consulta: 30, maximo: 300 });
  });
  // ------------------------------------------------------------ Descarte (FormDescarte)
  /** Ao enviar, abre o "Tem certeza?" com a escolha do estoque de origem. */
  qsa("form[data-descarte]").forEach((form) => {
    const saldo = JSON.parse(form.dataset.descarte);
    form.addEventListener("ctp:enviar", (e) => {
      e.preventDefault();
      const qtd = Number(qs("#quantidade", form).value || 0);
      const opcoes = [["VAZIOS", "Pallets PBR", saldo.vazios, "boxes"], ["QUEBRADOS", "Pallets Quebrados", saldo.quebrados, "hammer"]];
      const m = CTP.modal({
        titulo: "Confirmar descarte",
        html:
          `<p class="mb-2 text-[14px] font-semibold text-t1" data-testid="pergunta-descarte">Tem certeza que deseja descartar estes pallets?</p>` +
          `<p class="mb-5 text-[12px] text-t2">Escolha de qual estoque eles saem para confirmar:</p>` +
          `<p class="mb-4 text-[12px] text-t3">Quantidade: <strong class="num text-t1">${qtd}</strong> pallet(s). A baixa é definitiva e fica registrada em Pallets Descartados (não pode ser alterada nem excluída).</p>` +
          `<div class="grid gap-3">${opcoes
            .map(
              ([origem, titulo, s, ic]) =>
                `<button type="button" data-origem="${origem}"${s < qtd ? " disabled" : ""} class="poco flex items-center gap-4 p-4 text-left transition hover:ring-2 hover:ring-lima/50 disabled:cursor-not-allowed disabled:opacity-50">${CTP.icone(ic, "h-6 w-6 flex-none text-lima")}` +
                `<span class="flex-1"><span class="block text-[13px] font-semibold text-t1">${titulo}</span><span class="block text-[11px] text-t3">Saldo disponível: <span class="num">${s}</span>${s < qtd ? " · insuficiente" : ""}</span></span></button>`,
            )
            .join("")}</div><button type="button" class="btn-secondary mt-5 w-full" data-cancelar>Cancelar</button>`,
      });
      qs("[data-cancelar]", m).addEventListener("click", () => m.fechar());
      qsa("[data-origem]", m).forEach((b) =>
        b.addEventListener("click", () => {
          m.fechar();
          CTP.enviarForm(form, { origem: b.dataset.origem });
        }),
      );
    });
  });

  // ------------------------------------------------------------ Conserto / reparo (FormReparo)
  qsa("form[data-reparo]").forEach((form) => {
    const saldo = Number(form.dataset.reparo);
    const num = (v) => (v === "" ? 0 : Math.max(0, Math.trunc(Number(v)) || 0));
    const trava = (r, u) => {
      if (r > saldo) return `Erro: os recuperados (${r}) ultrapassam o saldo de quebrados (${saldo}).`;
      if (r + u > saldo) return `Erro: A soma dos recuperados (${r}) e utilizados (${u}) ultrapassa o saldo de quebrados (${saldo}). Restam no máximo ${saldo - r} pallet(s) para utilização.`;
      return null;
    };
    const render = () => {
      const usou = form.querySelector("input[name=usouOutros]:checked")?.value || "";
      const r = num(qs("#recuperados", form).value);
      const bloco = qs("[data-bloco-utilizados]", form);
      bloco.hidden = usou !== "SIM";
      qs("#utilizados", form).required = usou === "SIM";
      const u = usou === "SIM" ? num(qs("#utilizados", form).value) : 0;
      qs("[data-max-utilizados]", form).textContent = `Máximo permitido agora: ${Math.max(0, saldo - r)}. Os utilizados saem de Quebrados e vão para Descartados.`;
      const erro = r > 0 ? trava(r, u) : null;
      const resumo = qs("[data-resumo-reparo]", form);
      resumo.hidden = !(r > 0 && !erro);
      resumo.innerHTML = r > 0 && !erro
        ? `<div class="poco space-y-1 px-4 py-3 text-[12px] text-t2"><p>Pallets Quebrados: <strong class="num text-t1">−${r + u}</strong> (saldo final ${saldo - r - u})</p><p>Pallets PBR: <strong class="num text-lima">+${r}</strong></p>${u > 0 ? `<p>Descartados/destruídos: <strong class="num text-erro">+${u}</strong></p>` : ""}</div>`
        : "";
      const box = qs("[data-erro-reparo]", form);
      box.hidden = !erro;
      box.innerHTML = erro ? `<div role="alert" class="poco-erro flex items-start gap-2 px-4 py-3 text-[12px] font-medium text-erro-claro">${CTP.iconeAlerta} ${esc(erro)}</div>` : "";
    };
    form.addEventListener("input", render);
    form.addEventListener("change", render);
    form.addEventListener("ctp:limpo", render);
    render();
  });
  // ------------------------------------------------------------ Ajuste de saldo (FormAjusteSaldo)
  qsa("form[data-ajuste]").forEach((form) => {
    const cfg = JSON.parse(form.dataset.ajuste);
    const sel = qs("#unidadeId", form);
    const saldo = qs("[data-saldo-unidade]", form);
    const unidade = () => cfg.unidades.find((x) => x.id === sel.value);
    const mostrar = () => {
      const u = unidade();
      saldo.hidden = !u;
      if (u) saldo.innerHTML = `Saldo atual: <span class="num text-lima">${n(u.vazios)}</span> Pallets PBR · <span class="num text-ouro">${n(u.quebrados)}</span> Pallets Quebrados`;
    };
    sel.addEventListener("change", mostrar);
    form.addEventListener("ctp:limpo", mostrar);
    mostrar();
    if (cfg.modo !== "remocao") return;
    form.addEventListener("ctp:enviar", (e) => {
      e.preventDefault();
      const qtd = Number(qs("#quantidade", form).value || 0);
      const est = qs("#estoque", form).value;
      const m = CTP.modal({
        titulo: "Confirmar remoção",
        html:
          `<p class="mb-3 text-[14px] font-semibold text-t1" data-testid="pergunta-remocao">Tem certeza?</p>` +
          `<p class="mb-5 text-[12px] text-t2">Serão removidos <strong class="num text-t1">${n(qtd)}</strong> pallet(s) ${est === "QUEBRADOS" ? "(Pallets Quebrados)" : "(Pallets PBR)"} de <strong class="text-t1">${esc(unidade()?.codigo ?? "")}</strong>. A operação fica registrada na auditoria e não pode ser desfeita.</p>` +
          `<div class="flex gap-3"><button type="button" class="btn-secondary flex-1" data-cancelar>Cancelar</button><button type="button" class="btn-danger flex-1" data-sim>Sim, remover</button></div>`,
      });
      qs("[data-cancelar]", m).addEventListener("click", () => m.fechar());
      qs("[data-sim]", m).addEventListener("click", () => {
        m.fechar();
        CTP.enviarForm(form, { confirmado: "1" });
      });
    });
  });
  // ------------------------------------------------------------ Seleção de vales e agenda (SelecaoVales)
  const selecao = qs("[data-selecao-vales]");
  if (selecao) {
    const cfg = JSON.parse(selecao.dataset.selecaoVales);
    const linhas = () => qsa("tbody tr[data-id]", selecao);
    const marcadas = () => linhas().filter((tr) => qs("input[name=valeIds]", tr)?.checked);
    const resumo = () => {
      const sel = marcadas();
      const qtd = sel.reduce((t, tr) => t + Number(tr.dataset.qtd), 0);
      const forn = new Set(sel.map((tr) => tr.dataset.cnpj)).size;
      return { n: sel.length, qtd, forn };
    };
    const render = () => {
      const r = resumo();
      linhas().forEach((tr) => tr.classList.toggle("bg-lima/[.06]", !!qs("input[name=valeIds]", tr)?.checked));
      qs("[data-resumo]", selecao).innerHTML = `${r.n} vale(s) · ${r.qtd} pallet(s)${r.forn > 1 ? `<span class="text-t3"> · ${r.forn} agendas</span>` : ""}`;
      const b = qs("[data-agendar]", selecao);
      b.disabled = r.n === 0;
      b.innerHTML = `${CTP.icone("calendar-plus")} ${r.n === 0 ? "Selecione vales" : "Agendar retirada"}`;
      const pend = qsa("input[name=valeIds]", selecao);
      qs("[data-todos]", selecao).checked = pend.length > 0 && pend.every((c) => c.checked);
    };
    selecao.addEventListener("change", (e) => {
      if (e.target.matches("[data-todos]")) {
        const todos = e.target.checked;
        qsa("input[name=valeIds]", selecao).forEach((c) => (c.checked = todos));
      }
      render();
    });
    CTP.selecionarVale = (id) => {
      const c = qs(`input[name=valeIds][value="${CSS.escape(id)}"]`, selecao);
      if (c) c.checked = true;
      render();
    };
    qs("[data-agendar]", selecao).addEventListener("click", () => {
      const r = resumo();
      const m = CTP.modal({
        titulo: "Agendar retirada de pallets",
        html:
          `<form class="space-y-4"><div class="poco p-4 text-[12px] text-t2"><p class="num text-[13px] font-semibold text-t1">${r.n} vale(s) · ${r.qtd} pallet(s)</p>${r.forn > 1 ? `<p class="mt-1">Serão geradas ${r.forn} agendas (uma por fornecedor).</p>` : ""}</div>` +
          `<div><label class="label" for="dataHora">Data e hora da retirada *</label><input id="dataHora" name="dataHora" type="datetime-local" min="${cfg.hoje}T00:00" value="${cfg.sugestao}" class="input" required autofocus></div>` +
          `<div><label class="label" for="observacao">Observação</label><input id="observacao" name="observacao" class="input" maxlength="500" placeholder="Ex.: transportadora, contato, doca"></div>` +
          `<div class="flex gap-3"><button type="button" class="btn-secondary flex-1" data-cancelar>Cancelar</button><button type="submit" class="btn-primary flex-1">${CTP.icone("calendar-plus")} Confirmar agendamento</button></div></form>`,
      });
      qs("[data-cancelar]", m).addEventListener("click", () => m.fechar());
      qs("form", m).addEventListener("submit", async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        marcadas().forEach((tr) => fd.append("valeIds[]", tr.dataset.id));
        m.fechar();
        const alvo = qs("[data-form-agendar]", selecao);
        let estado;
        try {
          estado = await CTP.acao("/acao/vales/agendar", fd);
        } catch {
          estado = { ok: false, mensagem: "Falha de conexão com o servidor. Tente novamente." };
        }
        if (estado.recarregar) {
          try {
            sessionStorage.setItem("ctp_estado", JSON.stringify({ acao: "/acao/vales/agendar", estado }));
          } catch {}
          return CTP.recarregar();
        }
        CTP.mostrarMensagem(alvo, estado);
      });
    });
    render();
  }

  // ------------------------------------------------------------ Leitura óptica do vale (LeitorVale)
  /** Leitor USB/Bluetooth envia o código + Enter: localiza e destaca a linha [data-vale] ou seleciona o vale. */
  qsa("[data-leitor-vale]").forEach((caixa) => {
    const modo = caixa.dataset.leitorVale;
    const form = qs("form", caixa);
    const campo = qs("input", form);
    const botao = qs("button", form);
    const msg = qs("[data-leitor-msg]", caixa);
    campo.addEventListener("input", () => (botao.disabled = !campo.value.trim()));
    const destacar = (numero) => {
      const el = document.querySelector(`[data-vale="${numero}"]`);
      if (!el) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("destaque-leitura");
      setTimeout(() => el.classList.remove("destaque-leitura"), 2500);
      return true;
    };
    const mostrar = (ok, texto, id) => {
      msg.hidden = false;
      msg.innerHTML =
        `<div role="status" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[12px] font-medium ${ok ? "poco text-lima" : "poco-erro text-erro-claro"}"><span class="ponto ${ok ? "text-lima" : "text-erro"}"></span><span>${esc(texto)}</span>` +
        (id ? `<a href="/imprimir/vale/${esc(id)}" class="text-t2 underline hover:text-lima">Abrir vale</a>` : "") + `</div>`;
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const codigo = campo.value.trim();
      if (!codigo) return;
      botao.disabled = true;
      botao.textContent = "Lendo...";
      const fd = new FormData();
      fd.set("leitura", codigo);
      const r = await CTP.acao("/acao/vales/buscar", fd).catch(() => ({ ok: false, erro: "Falha de conexão com o servidor." }));
      botao.textContent = "Localizar";
      campo.value = "";
      campo.focus();
      if (!r.ok) return mostrar(false, r.erro);
      if (modo === "selecionar") {
        const tr = qs(`tr[data-id="${CSS.escape(r.id)}"]`);
        if (tr) {
          destacar(r.numero);
          if (tr.dataset.status !== "PENDENTE") return mostrar(true, `${r.codigo} já está agendado (${tr.dataset.agenda}).`, r.id);
          CTP.selecionarVale(r.id);
          return mostrar(true, `${r.codigo} selecionado para a agenda · ${tr.dataset.fornecedor} · ${tr.dataset.qtd} pallet(s)`, r.id);
        }
      }
      if (destacar(r.numero)) mostrar(true, `Localizado: ${r.texto}`, r.id);
      else mostrar(true, r.texto, r.id);
    });
  });
  // ------------------------------------------------------------ Cadastro rápido de fornecedor (ModalFornecedor)
  /** Abre o cadastro com o CNPJ da NF-e fixado; chama aoCadastrar após salvar. */
  CTP.modalFornecedor = ({ cnpj, cnpjFormatado, aviso, origem, aoCadastrar }) => {
    const modelo = qs("template[data-modelo-fornecedor]");
    const m = CTP.modal({
      titulo: "Cadastro de fornecedor",
      html:
        `<p class="poco-ouro mb-5 px-4 py-3 text-[12px] text-ouro">${esc(aviso)}</p>` +
        `<form class="space-y-4" data-acao="/acao/cadastros/criar-fornecedor-rapido"><input type="hidden" name="origem" value="${esc(origem)}">${modelo.innerHTML}` +
        `<div data-mensagem hidden></div><button type="submit" class="btn-primary w-full" data-enviando="Salvando...">Cadastrar e continuar</button></form>`,
    });
    // CNPJ fixo (vem da chave da NF-e): troca o campo editável pelo valor somente leitura.
    const campo = qs("input[name=cnpj]", m).closest("div");
    campo.innerHTML = `<input type="hidden" name="cnpj" value="${esc(cnpj)}"><span class="label">CNPJ</span><p class="input num flex items-center opacity-80">${esc(cnpjFormatado)}</p>`;
    const form = qs("form", m);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const estado = await CTP.enviarForm(form);
      if (estado && estado.ok) {
        m.fechar();
        aoCadastrar();
      }
    });
    return m;
  };

  // ------------------------------------------------------------ Leitura pela câmera (LeitorCamera)
  const temCamera = () => !!window.BarcodeDetector && !!navigator.mediaDevices;
  CTP.lerCamera = (aoLer) => {
    let fluxo = null;
    let ativo = true;
    const m = CTP.modal({
      titulo: "Ler código com a câmera",
      html: `<div class="poco overflow-hidden p-2" data-video><video class="w-full rounded-[18px]" muted playsinline></video></div><p class="mt-3 text-[11px] text-t3">Enquadre o código de barras do DANFE na horizontal.</p>`,
      aoFechar: () => {
        ativo = false;
        fluxo && fluxo.getTracks().forEach((t) => t.stop());
      },
    });
    const video = qs("video", m);
    (async () => {
      try {
        fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.srcObject = fluxo;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ["code_128", "itf", "ean_13", "qr_code"] });
        while (ativo) {
          const achados = await detector.detect(video).catch(() => []);
          const a = achados.find((x) => x.rawValue.replace(/\D/g, "").length >= 44) || achados[0];
          if (a) {
            m.fechar();
            aoLer(a.rawValue);
            return;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
      } catch {
        qs("[data-video]", m).outerHTML = CTP.mensagemHtml({ ok: false, mensagem: "Não foi possível acessar a câmera. Verifique a permissão do navegador." });
      }
    })();
  };

  // ------------------------------------------------------------ Compra de pallets (FluxoCompra)
  const compra = qs("[data-fluxo-compra]");
  if (compra) {
    const cfg = JSON.parse(compra.dataset.fluxoCompra);
    const formLeitura = qs("[data-leitura-nfe]", compra);
    const campo = qs("#leitura", formLeitura);
    const botao = qs("button[type=submit]", formLeitura);
    const caixaErro = qs("[data-erro]", compra);
    const caixaNf = qs("[data-nf]", compra);
    const caixaUltima = qs("[data-ultima]", compra);
    let lendo = false;
    const mostrar = (el, html) => {
      el.innerHTML = html || "";
      el.hidden = !html;
    };
    const estadoBotoes = () => {
      botao.disabled = lendo || !campo.value.trim();
      botao.textContent = lendo ? "Lendo..." : "Identificar";
      qsa("[data-simular]", compra).forEach((b) => (b.disabled = lendo || (b.dataset.simular === "cadastrado" && !cfg.cnpjs.length)));
    };
    campo.addEventListener("input", estadoBotoes);
    const recomecar = () => {
      mostrar(caixaNf, "");
      mostrar(caixaErro, "");
      campo.value = "";
      estadoBotoes();
      campo.focus();
    };
    const abrirCadastro = (nf) =>
      CTP.modalFornecedor({
        cnpj: nf.cnpj,
        cnpjFormatado: nf.cnpjFormatado,
        origem: "cadastro rápido (compra)",
        aviso: "O CNPJ emitente desta NF ainda não está cadastrado. Cadastre o fornecedor para continuar a compra.",
        aoCadastrar: () => identificar(nf.chave),
      });
    const renderNf = (nf) => {
      const forn = nf.fornecedor
        ? `<p class="flex items-center gap-2 text-[14px] font-semibold text-lima">${CTP.icone("circle-check", "h-4 w-4 flex-none")} ${esc(nf.fornecedor.nome)}</p>`
        : `<p class="text-[13px] font-semibold text-ouro">Não cadastrado</p>`;
      let h =
        `<div class="poco space-y-4 p-5"><div class="grid gap-4 sm:grid-cols-3"><div><p class="label !mb-1">Nota fiscal</p><p class="num text-[22px] font-semibold text-t1">${esc(nf.notaFiscal)} <span class="text-[12px] text-t3">série ${esc(nf.serie)}</span></p></div>` +
        `<div class="sm:col-span-2"><p class="label !mb-1">Fornecedor (emitente)</p>${forn}<p class="num text-[12px] text-t3">${esc(nf.cnpjFormatado)}</p></div></div>` +
        `<p class="num break-all text-[11px] text-t4">Chave: ${esc(nf.chave)}</p>`;
      if (nf.fornecedor) {
        h +=
          `<form class="space-y-4" data-acao="/acao/pallets/registrar-compra" data-compra><input type="hidden" name="chave" value="${esc(nf.chave)}">` +
          `<div class="grid gap-4 sm:grid-cols-[12rem_1fr]"><div><label class="label" for="quantidadeCompra">Quantidade de pallets *</label><input id="quantidadeCompra" name="quantidade" type="number" min="1" step="1" class="input" required></div>` +
          `<div><label class="label" for="obsCompra">Observação</label><input id="obsCompra" name="observacao" class="input" maxlength="500"></div></div>` +
          `<div data-mensagem hidden></div><div class="flex flex-wrap gap-3"><button type="submit" class="btn-primary" data-enviando="Registrando...">${CTP.icone("circle-check")} Registrar compra</button>` +
          `<button type="button" class="btn-secondary" data-recomecar>${CTP.icone("rotate-ccw")} Ler outra NF</button></div></form>`;
      } else {
        h += `<div class="flex flex-wrap gap-3"><button type="button" class="btn-primary" data-cadastrar>Cadastrar fornecedor</button><button type="button" class="btn-secondary" data-recomecar>${CTP.icone("rotate-ccw")} Ler outra NF</button></div>`;
      }
      mostrar(caixaNf, h + "</div>");
      qs("[data-recomecar]", caixaNf).addEventListener("click", recomecar);
      const cad = qs("[data-cadastrar]", caixaNf);
      cad && cad.addEventListener("click", () => abrirCadastro(nf));
      const fc = qs("form[data-compra]", caixaNf);
      if (fc) {
        qs("#quantidadeCompra", fc).focus();
        fc.addEventListener("submit", async (e) => {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!fc.reportValidity()) return;
          const estado = await CTP.enviarForm(fc);
          // Após registrar a compra, volta para a leitura da próxima NF e atualiza saldos/lista.
          if (estado && estado.ok) {
            try {
              sessionStorage.setItem("ctp_compra", JSON.stringify(estado));
            } catch {}
            CTP.recarregar();
          }
        });
      }
    };
    async function identificar(codigo) {
      mostrar(caixaErro, "");
      mostrar(caixaUltima, "");
      mostrar(caixaNf, "");
      lendo = true;
      estadoBotoes();
      const fd = new FormData();
      fd.set("leitura", codigo);
      const r = await CTP.acao("/acao/pallets/ler-nfe", fd).catch(() => ({ ok: false, erro: "Falha de conexão com o servidor." }));
      lendo = false;
      estadoBotoes();
      if (!r.ok) return mostrar(caixaErro, CTP.mensagemHtml({ ok: false, mensagem: r.erro || r.mensagem }));
      campo.value = r.chave;
      estadoBotoes();
      renderNf(r);
      // Fornecedor não cadastrado: abre o cadastro rápido automaticamente.
      if (!r.fornecedor) abrirCadastro(r);
    }
    formLeitura.addEventListener("submit", (e) => {
      e.preventDefault();
      if (campo.value.trim()) identificar(campo.value);
    });
    qsa("[data-simular]", compra).forEach((b) =>
      b.addEventListener("click", async () => {
        const fd = new FormData();
        if (b.dataset.simular === "cadastrado" && cfg.cnpjs.length) fd.set("cnpj", cfg.cnpjs[Math.floor(Math.random() * cfg.cnpjs.length)]);
        const r = await CTP.acao("/acao/pallets/simular-nfe", fd);
        if (!r.ok) return;
        campo.value = r.chave;
        identificar(r.chave);
      }),
    );
    const cam = qs("[data-camera]", compra);
    if (temCamera()) {
      cam.hidden = false;
      cam.addEventListener("click", () =>
        CTP.lerCamera((codigo) => {
          campo.value = codigo;
          identificar(codigo);
        }),
      );
    }
    try {
      const ultima = JSON.parse(sessionStorage.getItem("ctp_compra") || "null");
      sessionStorage.removeItem("ctp_compra");
      if (ultima) mostrar(caixaUltima, CTP.mensagemHtml(ultima));
    } catch {}
    estadoBotoes();
    campo.focus();
  }

  // ------------------------------------------------------------ Recebimento de fornecedor (FormRecebimento)
  const receb = qs("form[data-recebimento-fornecedor]");
  if (receb) {
    const chave = qs("#chave", receb);
    const modo = qs("input[name=modo]", receb);
    const semNf = qs("[data-sem-nf]", receb);
    const rotuloSemNf = qs("[data-rotulo-sem-nf]", receb);
    const blocoNf = qs("[data-bloco-nf]", receb);
    const blocoSem = qs("[data-bloco-sem-nf]", receb);
    const selForn = qs("#fornecedorId", receb);
    const validar = qs("[data-validar]", receb);
    const lerOutraBtn = qs("[data-ler-outra]", receb);
    const ajuda = qs("#chave-ajuda", receb);
    const caixaErro = qs("[data-erro]", receb);
    const caixaNf = qs("[data-nf]", receb);
    const enviar = qs("button[type=submit]", receb);
    const textoEnviar = enviar.innerHTML;
    let nf = null;
    let lendo = false;
    let ultimaLida = "";
    const normalizar = (v) => String(v || "").replace(/\D/g, "").slice(0, 44);
    const mostrar = (el, html) => {
      el.innerHTML = html || "";
      el.hidden = !html;
    };
    const render = () => {
      const sem = semNf.checked;
      modo.value = sem ? "SEM_NF" : "NF";
      qs("[data-titulo-modo]", receb).textContent = sem ? "Recebimento sem nota fiscal" : "Leitura da nota fiscal";
      rotuloSemNf.classList.toggle("bg-ouro/15", sem);
      rotuloSemNf.classList.toggle("text-ouro", sem);
      rotuloSemNf.classList.toggle("text-t2", !sem);
      blocoNf.hidden = sem;
      blocoSem.hidden = !sem;
      chave.disabled = sem;
      selForn.disabled = !sem;
      selForn.required = sem;
      chave.readOnly = !!nf;
      lerOutraBtn.hidden = !nf;
      validar.hidden = !!nf;
      validar.disabled = lendo || !chave.value.trim();
      validar.textContent = lendo ? "Lendo..." : "Validar";
      const n = normalizar(chave.value).length;
      ajuda.textContent = n > 0 && !nf ? `${n} de 44 dígitos` : "O leitor envia os 44 dígitos e o Enter automaticamente.";
      const pronto = sem || !!(nf && nf.fornecedor && nf.fornecedor.ativo);
      enviar.disabled = !pronto;
      enviar.innerHTML = pronto ? textoEnviar : "Leia a NF para continuar";
    };
    const abrirCadastro = () =>
      CTP.modalFornecedor({
        cnpj: nf.cnpj,
        cnpjFormatado: nf.cnpjFormatado,
        origem: "cadastro automático (recebimento com NF)",
        aviso: "O CNPJ emitente desta NF não está cadastrado. Conclua o cadastro do fornecedor; ao salvar, você volta ao recebimento com os dados preenchidos.",
        aoCadastrar: () => {
          ultimaLida = "";
          const c = nf.chave;
          nf = null;
          identificar(c);
        },
      });
    const renderNf = () => {
      if (!nf) return mostrar(caixaNf, "");
      const f = nf.fornecedor;
      const status = f && f.ativo
        ? `${CTP.icone("circle-check", "h-4 w-4 text-lima")}<span class="text-lima">Fornecedor encontrado no cadastro</span>`
        : f
          ? `<span class="text-erro">Fornecedor inativo — reative-o em Cadastros para receber.</span>`
          : `<span class="text-ouro">CNPJ não cadastrado — conclua o cadastro do fornecedor para prosseguir.</span>`;
      mostrar(
        caixaNf,
        `<div class="poco grid gap-4 p-5 sm:grid-cols-3"><div class="sm:col-span-3 flex items-center gap-2 text-[12px] font-semibold">${status}</div>` +
          `<div class="sm:col-span-3"><p class="label !mb-1">Fornecedor</p><p class="text-[16px] font-semibold text-t1">${esc(f ? f.nome : "—")}</p></div>` +
          `<div><p class="label !mb-1">CNPJ</p><p class="num text-[14px] text-t1">${esc(nf.cnpjFormatado)}</p></div>` +
          `<div><p class="label !mb-1">Número da NF</p><p class="num text-[20px] font-semibold text-t1">${esc(nf.notaFiscal)}</p></div>` +
          `<div><p class="label !mb-1">Série</p><p class="num text-[14px] text-t1">${esc(nf.serie)}</p></div>` +
          (!f ? `<div class="sm:col-span-3"><button type="button" class="btn-primary" data-cadastrar>${CTP.icone("user-plus")} Cadastrar fornecedor</button></div>` : "") +
          `</div>`,
      );
      const cad = qs("[data-cadastrar]", caixaNf);
      cad && cad.addEventListener("click", abrirCadastro);
    };
    async function identificar(codigo) {
      const c = normalizar(codigo);
      if (!c) return;
      ultimaLida = c;
      mostrar(caixaErro, "");
      nf = null;
      renderNf();
      lendo = true;
      render();
      const fd = new FormData();
      fd.set("leitura", c);
      const r = await CTP.acao("/acao/fornecedor/ler-nfe", fd).catch(() => ({ ok: false, erro: "Falha de conexão com o servidor." }));
      lendo = false;
      if (!r.ok) {
        mostrar(caixaErro, CTP.mensagemHtml({ ok: false, mensagem: r.erro || r.mensagem }));
        render();
        chave.select();
        return;
      }
      nf = r;
      chave.value = r.chave;
      renderNf();
      render();
      if (!r.fornecedor) abrirCadastro(); // CNPJ não cadastrado: cadastro com CNPJ pré-preenchido
      else if (r.fornecedor.ativo) setTimeout(() => qs("#quantidade", receb).focus(), 50);
    }
    chave.addEventListener("input", () => {
      mostrar(caixaErro, "");
      // Leitores sem Enter: identifica ao completar 44 dígitos.
      const n = normalizar(chave.value);
      if (n.length === 44 && n !== ultimaLida) identificar(n);
      render();
    });
    chave.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Enter valida a chave, não envia o formulário
        if (!nf) identificar(chave.value);
      }
    });
    validar.addEventListener("click", () => identificar(chave.value));
    const lerOutra = () => {
      nf = null;
      ultimaLida = "";
      chave.value = "";
      mostrar(caixaErro, "");
      renderNf();
      render();
      chave.focus();
    };
    lerOutraBtn.addEventListener("click", lerOutra);
    semNf.addEventListener("change", () => {
      nf = null;
      ultimaLida = "";
      chave.value = "";
      mostrar(caixaErro, "");
      renderNf();
      render();
      setTimeout(() => (semNf.checked ? selForn : chave).focus(), 50);
    });
    // Ao voltar de um envio com erro (botão reabilitado), recalcula o estado do botão.
    new MutationObserver(() => !enviar.disabled && render()).observe(enviar, { attributes: true, attributeFilter: ["disabled"] });
    render();
  }
})();
