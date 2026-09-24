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
