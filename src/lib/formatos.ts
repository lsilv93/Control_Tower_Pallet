import type { StatusAgenda, StatusVale, TipoMovimentacao } from "@prisma/client";

export const somenteDigitos = (v: string) => v.replace(/\D/g, "");

/**
 * CNPJ normalizado: 14 caracteres, maiúsculos, sem pontuação. Desde jul/2026 a
 * Receita emite CNPJ alfanumérico (12 posições alfanuméricas + 2 dígitos verificadores).
 */
export const normalizarCnpj = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

export function formatarCnpj(cnpj: string): string {
  const d = normalizarCnpj(cnpj);
  if (d.length !== 14) return cnpj;
  return d.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
}

/** Dígitos verificadores do CNPJ (válido para o formato numérico e o alfanumérico). */
export function dvCnpj(base12: string): string {
  const valor = (c: string) => c.charCodeAt(0) - 48;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, c, i) => acc + valor(c) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(base12);
  const d2 = calc(base12 + d1);
  return `${d1}${d2}`;
}

export function cnpjValido(valor: string): boolean {
  const cnpj = normalizarCnpj(valor);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1+$/.test(cnpj)) return false;
  return cnpj.endsWith(dvCnpj(cnpj.slice(0, 12)));
}

/** Placa no padrão antigo (ABC1234) ou Mercosul (ABC1D23). */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
}
export const placaValida = (placa: string) => /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(normalizarPlaca(placa));
export function formatarPlaca(placa: string): string {
  const p = normalizarPlaca(placa);
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export const numeroVale = (n: number) => `VP-${String(n).padStart(6, "0")}`;

/**
 * Lê o conteúdo do código de barras do vale ("VP-000123", "VP000123",
 * "vp 123" ou só "123") e devolve o número do vale.
 */
export function lerCodigoVale(codigo: string): number | null {
  const m = codigo.trim().toUpperCase().match(/^(?:VP[\s-]*)?0*(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}
export const numeroAgenda = (n: number) => `AG-${String(n).padStart(5, "0")}`;

export const formatarNumero = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export const rotuloTipo: Record<TipoMovimentacao, string> = {
  ENVIO_CD: "Envio para CD",
  RECEBIMENTO_CD: "Recebimento do CD",
  RECEBIMENTO_FORNECEDOR: "Recebimento de Fornecedor",
  DEVOLUCAO_FORNECEDOR: "Devolução ao Fornecedor",
  QUEBRA: "Quebra",
  RECUPERADO: "Recuperado",
  DESCARTE: "Descarte",
  AJUSTE_ENTRADA: "Ajuste de inventário (entrada)",
  AJUSTE_SAIDA: "Ajuste de inventário (saída)",
  COMPRA: "Compra de pallets",
};

export const rotuloStatusVale: Record<StatusVale, string> = {
  PENDENTE: "Pendente",
  AGENDADO: "Agendado",
  FINALIZADO: "Finalizado",
};

export const rotuloStatusAgenda: Record<StatusAgenda, string> = {
  ABERTA: "Aberta",
  VALIDADA: "Validada",
  CANCELADA: "Cancelada",
};
