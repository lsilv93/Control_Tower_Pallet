import type { MotivoCancelamento, ResolucaoOcorrencia, StatusAgenda, StatusVale, TipoMovimentacao, TipoOcorrencia, TipoUnidade, TipoVale } from "@prisma/client";

export const somenteDigitos = (v: string) => v.replace(/\D/g, "");

/**
 * CNPJ normalizado: 14 caracteres, maiúsculos, sem pontuação. Desde jul/2026 a
 * Receita emite CNPJ alfanumérico (12 posições alfanuméricas + 2 dígitos verificadores).
 */
export const normalizarCnpj = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

/** CNPJ formatado (00.000.000/0000-00); vazio vira "—" (CNPJ é opcional nos cadastros). */
export function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "—";
  const d = normalizarCnpj(cnpj);
  if (d.length !== 14) return cnpj;
  return d.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Máscara de digitação do CNPJ (00.000.000/0000-00), em maiúsculas: 12 posições
 * alfanuméricas (CNPJ alfanumérico) + 2 dígitos verificadores numéricos.
 */
export function mascaraCnpj(valor: string): string {
  const entrada = valor.toUpperCase().replace(/[^0-9A-Z]/g, "");
  let c = "";
  for (const ch of entrada) {
    if (c.length >= 14) break;
    if (c.length < 12 ? /[0-9A-Z]/.test(ch) : /\d/.test(ch)) c += ch;
  }
  const partes = [c.slice(0, 2), c.slice(2, 5), c.slice(5, 8), c.slice(8, 12), c.slice(12, 14)];
  let r = partes[0];
  if (partes[1]) r += `.${partes[1]}`;
  if (partes[2]) r += `.${partes[2]}`;
  if (partes[3]) r += `/${partes[3]}`;
  if (partes[4]) r += `-${partes[4]}`;
  return r;
}

/** Telefone: (00) 0000-0000 ou (00) 00000-0000. */
export function mascaraTelefone(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
export const telefoneValido = (v: string) => /^\d{10,11}$/.test(v.replace(/\D/g, ""));
export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

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
export const PREFIXO_VALE: Record<TipoVale, string> = { FORNECEDOR: "VP", ENVIO: "VE", OCORRENCIA: "VO" };

/** Número do vale: VE-000123 (envio entre unidades), VO- (ocorrência), VP- (fornecedor). */
export const numeroVale = (n: number, tipo: TipoVale = "FORNECEDOR") => `${PREFIXO_VALE[tipo]}-${String(n).padStart(6, "0")}`;

/**
 * Lê o conteúdo do código de barras do vale ("VP-000123", "VE000123",
 * "vo 123" ou só "123") e devolve o número do vale.
 */
export function lerCodigoVale(codigo: string): number | null {
  const m = codigo.trim().toUpperCase().match(/^(?:V[PEO][\s-]*)?0*(\d{1,9})$/);
  return m ? Number(m[1]) : null;
}

/** Número da conferência de recebimento. */
export const numeroConferencia = (n: number) => `RC-${String(n).padStart(5, "0")}`;
/** @deprecated use numeroConferencia */
export const numeroRetorno = numeroConferencia;

export const rotuloTipoVale: Record<TipoVale, string> = {
  ENVIO: "Vale-Pallet de Envio",
  OCORRENCIA: "Vale de Ocorrência",
  FORNECEDOR: "Vale-Pallet de Fornecedor",
};

export const rotuloOcorrencia: Record<TipoOcorrencia, string> = { FALTA: "Falta (enviado a menos)", SOBRA: "Sobra (enviado a mais)" };
export const rotuloResolucao: Record<ResolucaoOcorrencia, string> = { LOCALIZADA: "Localizada e devolvida ao remetente", PERDA: "Baixada como perda" };

export const rotuloTipoUnidade: Record<TipoUnidade, string> = { CD: "CD", CROSS: "Ponto de Cross" };

/** Nome da unidade com o papel: "CDJC (Hub)", "CX01 (Cross)". */
export const rotuloUnidade = (u: { codigo: string; tipo: TipoUnidade; hub?: boolean }) =>
  `${u.codigo}${u.hub ? " (Hub)" : u.tipo === "CROSS" ? " (Cross)" : ""}`;

/** Motivos da inclusão manual de saldo (administrador). */
export const MOTIVOS_INCLUSAO = { COMPRA: "Compra", DEVOLUCAO: "Devolução", AJUSTE_ESTOQUE: "Ajuste Estoque", INVENTARIO: "Inventário" } as const;
export type MotivoInclusao = keyof typeof MOTIVOS_INCLUSAO;
export const numeroAgenda = (n: number) => `AG-${String(n).padStart(5, "0")}`;

export const formatarNumero = (n: number) => new Intl.NumberFormat("pt-BR").format(n);

export const rotuloTipo: Record<TipoMovimentacao, string> = {
  ENVIO: "Envio a outra unidade",
  BAIXA_TRANSITO: "Envio conferido no destino",
  RECEBIMENTO: "Recebimento de outra unidade",
  FALTA: "Falta na conferência (ocorrência)",
  SOBRA: "Sobra na conferência",
  OCORRENCIA_LOCALIZADA: "Ocorrência localizada (devolvida)",
  OCORRENCIA_PERDA: "Ocorrência baixada como perda",
  ESTORNO_ENVIO: "Estorno de envio (vale excluído)",
  QUEBRA: "Lançamento de quebrado",
  RECUPERADO: "Conserto / Reparo",
  CANIBALIZACAO: "Pallets utilizados no reparo",
  DESCARTE: "Descarte",
  INCLUSAO_MANUAL: "Inclusão manual de saldo",
  REMOCAO_MANUAL: "Remoção manual de saldo",
  COMPRA: "Compra de pallets",
  RECEBIMENTO_FORNECEDOR: "Recebimento de fornecedor",
  DEVOLUCAO_FORNECEDOR: "Baixa / pagamento ao fornecedor",
  ESTORNO_VALE: "Estorno de vale de fornecedor",
};

export const rotuloStatusVale: Record<StatusVale, string> = {
  PENDENTE: "Pendente",
  AGENDADO: "Agendado",
  FINALIZADO: "Concluído",
  CANCELADO: "Cancelado",
};

export const rotuloMotivoCancelamento: Record<MotivoCancelamento, string> = {
  FORNECEDOR_INCORRETO: "Fornecedor Incorreto",
  TRANSPORTADORA_INCORRETA: "Transportadora Incorreta",
  QUANTIDADE_INCORRETA: "Quantidade Incorreta",
  DOCUMENTO_ERRADO: "Documento Errado",
  DESTINO_INCORRETO: "Unidade de destino incorreta",
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
