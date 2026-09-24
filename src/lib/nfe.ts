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

/** Interpreta a leitura do código de barras. Lança Error com mensagem amigável se inválida. */
export function lerChaveNFe(leitura: string): ChaveNFe {
  const chave = normalizarChave(leitura);
  if (chave.length !== 44) {
    throw new Error(`Código lido tem ${chave.length} caracteres; a chave de acesso da NF-e tem 44.`);
  }
  if (!/^\d{6}[0-9A-Z]{12}\d{26}$/.test(chave)) throw new Error("Código de barras não corresponde a uma chave de NF-e.");
  if (dvChave(chave.slice(0, 43)) !== Number(chave[43])) {
    throw new Error("Dígito verificador da chave inválido — leia o código novamente.");
  }
  const cnpj = chave.slice(6, 20);
  if (!cnpjValido(cnpj)) throw new Error("CNPJ do emitente na chave é inválido.");
  return {
    chave,
    uf: chave.slice(0, 2),
    anoMes: chave.slice(2, 6),
    cnpj,
    modelo: chave.slice(20, 22),
    serie: String(Number(chave.slice(22, 25))),
    numero: String(Number(chave.slice(25, 34))),
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
