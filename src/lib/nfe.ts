// Chave de acesso da NF-e (44 posições) — é o conteúdo do código de barras do DANFE.
// Layout: cUF(2) AAMM(4) CNPJ emitente(14) modelo(2) série(3) nNF(9) tpEmis(1) cNF(8) DV(1)
import { cnpjValido, dvCnpj, normalizarCnpj } from "./formatos";

export type ChaveNFe = {
  chave: string;
  uf: string;
  anoMes: string;
  cnpj: string;
  modelo: string;
  serie: string;
  numero: string; // nNF sem zeros à esquerda
};

const valor = (c: string) => c.charCodeAt(0) - 48;

/** Dígito verificador da chave (módulo 11, pesos 2..9 da direita para a esquerda). */
export function dvChave(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += valor(chave43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export const normalizarChave = (v: string) => v.toUpperCase().replace(/[^0-9A-Z]/g, "");

/** Códigos IBGE das UFs (2 primeiros dígitos da chave). */
const UFS: Record<string, string> = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI",
  "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES",
  "33": "RJ", "35": "SP", "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

/**
 * Interpreta a leitura do código de barras do DANFE (chave de acesso, 44 posições).
 * Extrai CNPJ do emitente (posições 7–20 / índices 6–19) e número da NF
 * (posições 26–34 / índices 25–33). Lança Error com mensagem amigável se inválida.
 */
export function lerChaveNFe(leitura: string): ChaveNFe {
  const chave = normalizarChave(leitura);
  if (!chave) throw new Error("Leia ou digite a chave de acesso da NF-e.");
  if (chave.length < 44) throw new Error(`Chave incompleta: ${chave.length} de 44 dígitos. Leia o código de barras novamente.`);
  if (chave.length > 44) throw new Error(`Chave com ${chave.length} dígitos — a chave de acesso tem exatamente 44. Verifique a leitura.`);
  if (!/^\d{6}[0-9A-Z]{12}\d{26}$/.test(chave)) throw new Error("Código de barras não corresponde a uma chave de NF-e (caracteres inválidos).");
  if (!UFS[chave.slice(0, 2)]) throw new Error(`Chave inválida: código de UF "${chave.slice(0, 2)}" inexistente.`);
  const mes = Number(chave.slice(4, 6));
  if (mes < 1 || mes > 12) throw new Error(`Chave inválida: mês de emissão "${chave.slice(4, 6)}" inexistente.`);
  if (dvChave(chave.slice(0, 43)) !== Number(chave[43])) {
    throw new Error("Dígito verificador da chave inválido — leia o código de barras novamente.");
  }
  const modelo = chave.slice(20, 22);
  if (modelo !== "55") throw new Error(`Esta chave é do modelo ${modelo}${modelo === "65" ? " (NFC-e)" : ""}; o recebimento aceita apenas NF-e (modelo 55).`);
  const cnpj = chave.slice(6, 20);
  if (!cnpjValido(cnpj)) throw new Error("CNPJ do emitente contido na chave é inválido.");
  const numero = String(Number(chave.slice(25, 34)));
  if (numero === "0") throw new Error("Chave inválida: número da NF zerado.");
  return {
    chave,
    uf: chave.slice(0, 2),
    anoMes: chave.slice(2, 6),
    cnpj,
    modelo,
    serie: String(Number(chave.slice(22, 25))),
    numero,
  };
}

/** Gera uma chave válida (usada no botão "Simular leitura"). */
export function gerarChaveNFe(opcoes: { cnpj?: string; numero?: number } = {}): string {
  const aleatorio = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
  let cnpj = opcoes.cnpj ? normalizarCnpj(opcoes.cnpj) : "";
  if (!cnpj) {
    const base = aleatorio(8) + "0001";
    cnpj = base + dvCnpj(base);
  }
  const hoje = new Date();
  const aamm = `${String(hoje.getFullYear()).slice(2)}${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const numero = String(opcoes.numero ?? Math.floor(Math.random() * 999999) + 1).padStart(9, "0");
  const base43 = `35${aamm}${cnpj}55001${numero}1${aleatorio(8)}`;
  return base43 + dvChave(base43);
}
