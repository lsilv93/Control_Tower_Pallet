import type { MotivoCancelamento, StatusAgenda, StatusVale, TipoMovimentacao, TipoUnidade, TipoVale } from "@prisma/client";

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
/**
 * Máscara de digitação da placa: maiúsculas, só os caracteres válidos em cada posição
 * (3 letras, 1 número, 1 letra ou número, 2 números) e hífen automático no padrão
 * antigo (ABC-1234). No padrão Mercosul fica sem hífen (ABC1D23).
 */
export function mascaraPlaca(valor: string): string {
  const entrada = valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let p = "";
  for (const c of entrada) {
    const i = p.length;
    if (i >= 7) break;
    const letra = /[A-Z]/.test(c);
    const numero = /\d/.test(c);
    if (i < 3 ? letra : i === 3 || i >= 5 ? numero : letra || numero) p += c;
  }
  return p.length > 4 && /\d/.test(p[4]) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

export function formatarPlaca(placa: string): string {
  const p = normalizarPlaca(placa);
  return /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p;
}

/** Prefixo do número do vale por tipo (numeração única para todos os tipos). */
export const PREFIXO_VALE: Record<TipoVale, string> = { FORNECEDOR: "VP", ENVIO: "VE", OCORRENCIA: "VO", AJUSTE: "VA" };

/** Número do vale: VP-000123 (fornecedor), VE- (envio), VO- (ocorrência), VA- (ajuste). */
export const numeroVale = (n: number, tipo: TipoVale = "FORNECEDOR") => `${PREFIXO_VALE[tipo]}-${String(n).padStart(6, "0")}`;

/**
 * Lê o conteúdo do código de barras do vale ("VP-000123", "VE000123",
 * "vo 123" ou só "123") e devolve o número do vale.
 */
export function lerCodigoVale(codigo: string): number | null {
  const m = codigo.trim().toUpperCase().match(/^(?:V[PEOA][\s-]*)?0*(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}

export const numeroRetorno = (n: number) => `RC-${String(n).padStart(5, "0")}`;

export const rotuloTipoVale: Record<TipoVale, string> = {
  FORNECEDOR: "Vale-Pallet de Fornecedor",
  ENVIO: "Vale-Pallet de Envio",
  OCORRENCIA: "Vale-Ocorrência (falta)",
  AJUSTE: "Vale de Ajuste de Saldo Devedor",
};

export const rotuloTipoUnidade: Record<TipoUnidade, string> = { CD: "CD", CROSS: "Ponto de Cross" };

/** Motivos da inclusão manual de vazios (administrador). */
export const MOTIVOS_INCLUSAO = { COMPRA: "Compra", ESTORNO: "Estorno", DEVOLUCAO: "Devolução" } as const;
export type MotivoInclusao = keyof typeof MOTIVOS_INCLUSAO;
export const numeroAgenda = (n: number) => `AG-${String(n).padStart(5, "0")}`;

export const formatarNumero = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export const rotuloTipo: Record<TipoMovimentacao, string> = {
  ENVIO_CD: "Transferência para o CD (legado)",
  RECEBIMENTO_CD: "Retorno do CD (legado)",
  RECEBIMENTO_FORNECEDOR: "Recebimento de Fornecedor",
  DEVOLUCAO_FORNECEDOR: "Baixa / pagamento ao Fornecedor",
  QUEBRA: "Quebra",
  RECUPERADO: "Conserto / Reparo",
  DESCARTE: "Descarte",
  AJUSTE_ENTRADA: "Correção de inventário (inclusão)",
  AJUSTE_SAIDA: "Correção de inventário (remoção)",
  COMPRA: "Compra de pallets",
  ESTORNO_VALE: "Estorno de vale de fornecedor",
  ENVIO_UNIDADE: "Envio para CD / Cross",
  RETORNO_UNIDADE: "Retorno de CD / Cross",
  ESTORNO_ENVIO: "Estorno de vale de envio",
  INCLUSAO_VAZIOS: "Inclusão manual de vazios",
  INCLUSAO_DEVEDOR: "Inclusão manual de saldo devedor",
  CANIBALIZACAO: "Pallets utilizados no reparo",
  MIGRACAO_CUSTODIA: "Saldo devedor migrado",
};

export const rotuloStatusVale: Record<StatusVale, string> = {
  PENDENTE: "Pendente",
  AGENDADO: "Agendado",
  FINALIZADO: "Baixado",
  CANCELADO: "Cancelado",
};

export const rotuloMotivoCancelamento: Record<MotivoCancelamento, string> = {
  FORNECEDOR_INCORRETO: "Fornecedor Incorreto",
  TRANSPORTADORA_INCORRETA: "Transportadora Incorreta",
  QUANTIDADE_INCORRETA: "Quantidade Incorreta",
  DOCUMENTO_ERRADO: "Documento Errado",
  DESTINO_INCORRETO: "CD / Cross de destino incorreto",
  DIVERGENCIA_ABONADA: "Divergência abonada",
};

export const rotuloStatusAgenda: Record<StatusAgenda, string> = {
  ABERTA: "Aberta",
  VALIDADA: "Validada",
  CANCELADA: "Cancelada",
};

export const SEM_NOTA_FISCAL = "SEM NOTA FISCAL";

/** Texto da NF de um vale: "1234 (série 1)", "1234" ou "SEM NOTA FISCAL". */
export function rotuloNf(v: { semNotaFiscal: boolean; notaFiscal: string | null; serieNf?: string | null }): string {
  if (v.semNotaFiscal || !v.notaFiscal) return SEM_NOTA_FISCAL;
  return v.serieNf ? `${v.notaFiscal} (série ${v.serieNf})` : v.notaFiscal;
}

/** Contraparte do vale: fornecedor (vale de fornecedor) ou CD / Ponto de Cross (demais tipos). */
export function parteVale(v: {
  fornecedor?: { nome: string } | null;
  unidade?: { codigo: string; nome: string } | null;
}): string {
  if (v.fornecedor) return v.fornecedor.nome;
  if (v.unidade) return `${v.unidade.codigo} - ${v.unidade.nome}`;
  return "—";
}
