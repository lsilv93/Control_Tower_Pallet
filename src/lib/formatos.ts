import type { StatusAgenda, StatusVale, TipoMovimentacao } from "@prisma/client";

export const somenteDigitos = (v: string) => v.replace(/\D/g, "");

export function formatarCnpj(cnpj: string): string {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14) return cnpj;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function cnpjValido(valor: string): boolean {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(cnpj.slice(0, 12));
  const d2 = calc(cnpj.slice(0, 12) + d1);
  return cnpj.endsWith(`${d1}${d2}`);
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
