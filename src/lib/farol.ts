export type Farol = "VERMELHO" | "AMARELO" | "VERDE";

/** Farol por idade do vale: vermelho ≥ 30 dias, amarelo 20–29, verde < 20. */
export function farolPorIdade(dias: number): Farol {
  if (dias >= 30) return "VERMELHO";
  if (dias >= 20) return "AMARELO";
  return "VERDE";
}

/** Farol por fornecedor: vermelho > 100 pallets, amarelo 50–100, verde < 50. */
export function farolPorFornecedor(pendentes: number): Farol {
  if (pendentes > 100) return "VERMELHO";
  if (pendentes >= 50) return "AMARELO";
  return "VERDE";
}

const ordem: Record<Farol, number> = { VERMELHO: 0, AMARELO: 1, VERDE: 2 };
export const compararFarol = (a: Farol, b: Farol) => ordem[a] - ordem[b];

/**
 * Regras do farol das unidades na Torre de Controle (gestão à vista). O farol final é o pior
 * entre os critérios; cada critério que acende amarelo/vermelho vira um motivo exibido na TV.
 */
export const REGRAS_FAROL_UNIDADE = {
  /** SLA de devolução: idade, em dias, do vale em trânsito mais antigo envolvendo a unidade. */
  slaDias: { amarelo: 3, vermelho: 7 },
  /** Saldo devedor do Ponto de Cross (Pallets PBR + Quebrados em custódia, devidos aos CDs). */
  saldoCross: { amarelo: 200, vermelho: 500 },
  /** Ocorrências de divergência pendentes: qualquer uma acende amarelo; vermelho por quantidade ou idade. */
  ocorrencias: { vermelhoQuantidade: 3, vermelhoDias: 3 },
} as const;

export type FarolUnidade = { farol: Farol; motivos: string[] };

export function farolUnidade(u: {
  tipo: "CD" | "CROSS";
  diasTransitoMaisAntigo: number | null;
  saldo: number;
  ocorrenciasPendentes: number;
  diasOcorrenciaMaisAntiga: number | null;
}): FarolUnidade {
  const r = REGRAS_FAROL_UNIDADE;
  const avaliados: [Farol, string][] = [];
  const d = u.diasTransitoMaisAntigo;
  if (d !== null && d >= r.slaDias.vermelho) avaliados.push(["VERMELHO", `SLA de devolução estourado (${d} dias)`]);
  else if (d !== null && d >= r.slaDias.amarelo) avaliados.push(["AMARELO", `Vale em trânsito há ${d} dias`]);
  if (u.tipo === "CROSS") {
    if (u.saldo >= r.saldoCross.vermelho) avaliados.push(["VERMELHO", `Saldo devedor elevado (${u.saldo})`]);
    else if (u.saldo >= r.saldoCross.amarelo) avaliados.push(["AMARELO", `Saldo devedor alto (${u.saldo})`]);
  }
  if (u.ocorrenciasPendentes > 0) {
    const velha = (u.diasOcorrenciaMaisAntiga ?? 0) >= r.ocorrencias.vermelhoDias;
    const muitas = u.ocorrenciasPendentes >= r.ocorrencias.vermelhoQuantidade;
    avaliados.push([velha || muitas ? "VERMELHO" : "AMARELO", `${u.ocorrenciasPendentes} ocorrência(s) pendente(s)${velha ? ` há ${u.diasOcorrenciaMaisAntiga} dias` : ""}`]);
  }
  const farol = avaliados.reduce<Farol>((pior, [f]) => (ordem[f] < ordem[pior] ? f : pior), "VERDE");
  return { farol, motivos: avaliados.sort((a, b) => ordem[a[0]] - ordem[b[0]]).map(([, m]) => m) };
}

/**
 * SLA de viagem dos vales de envio (Kanban do Painel): verde até `amareloHoras`, amarelo até
 * `vermelhoHoras` (o SLA) e vermelho a partir dele, enquanto o destino não confere o recebimento.
 */
export const REGRAS_VIAGEM = { amareloHoras: 24, vermelhoHoras: 48 } as const;

export function farolViagem(horas: number): Farol {
  if (horas >= REGRAS_VIAGEM.vermelhoHoras) return "VERMELHO";
  if (horas >= REGRAS_VIAGEM.amareloHoras) return "AMARELO";
  return "VERDE";
}
