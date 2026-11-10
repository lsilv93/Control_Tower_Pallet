/**
 * Dados da empresa impressos no Vale-Pallet. O endereço e o CNPJ do emitente vêm da unidade
 * que originou a operação (cadastro de CDs e Pontos de Cross); estes campos ficam como
 * referência do CD Hub (Jacareí).
 */
export const EMISSOR = {
  razaoSocial: "Rfg Food Service Ltda.",
  nomeFantasia: "Martin-Brower Food Service",
  cnpj: "59.568.428/0011-50",
  endereco: "Rua Harold Barnsley Holland, 2130, Galpão B, Sala 01, Rio Abaixo",
  cidade: "Jacareí - SP",
  cep: "12.334-403",
} as const;
