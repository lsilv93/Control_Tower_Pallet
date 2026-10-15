import type { StatusVale, TipoUnidade, TipoVale, MotivoCancelamento } from "@prisma/client";
import { formatarDataHora } from "./datas";
import {
  formatarCnpj,
  formatarPlaca,
  numeroAgenda,
  numeroRetorno,
  numeroVale,
  rotuloMotivoCancelamento,
  rotuloNf,
  rotuloStatusVale,
  rotuloTipoUnidade,
} from "./formatos";

/** Dados do vale necessários para montar o documento impresso / PDF. */
export type ValeDoc = {
  id: string;
  numero: number;
  tipo: TipoVale;
  status: StatusVale;
  quantidade: number;
  transportadora: string | null;
  placa: string | null;
  motorista: string | null;
  notaFiscal: string | null;
  serieNf: string | null;
  semNotaFiscal: boolean;
  conferente: string | null;
  observacao: string | null;
  criadoEm: Date;
  finalizadoEm: Date | null;
  canceladoEm: Date | null;
  motivoCancelamento: MotivoCancelamento | null;
  cd: { codigo: string; nome: string };
  fornecedor: { nome: string; cnpj: string } | null;
  unidade: { codigo: string; nome: string; tipo: TipoUnidade } | null;
  criadoPor: { login: string };
  canceladoPor: { login: string } | null;
  agenda: { numero: number; dataPrevista: Date } | null;
  retorno: { numero: number } | null;
  retornoOrigem: { numero: number; totalVales: number; quantidadeFisica: number } | null;
};

export type Celula = { rotulo: string; valor: string; colunas: 1 | 2 | 3 | 4 };

export type DocumentoVale = {
  codigo: string;
  titulo: string;
  subtitulo: string;
  vias: [string, string];
  linhas: Celula[][];
  rotuloQuantidade: string;
  destaque: { titulo: string; texto: string } | null;
  declaracao: string;
  assinaturas: [string, string];
  nomeAssinatura: string | null;
};

const destinoTexto = (u: ValeDoc["unidade"]) => (u ? `${rotuloTipoUnidade[u.tipo]} ${u.codigo} - ${u.nome}` : "—");

/** Monta o conteúdo do documento conforme o tipo do vale (fornecedor, envio, ocorrência ou ajuste). */
export function documentoVale(v: ValeDoc): DocumentoVale {
  const codigo = numeroVale(v.numero, v.tipo);
  const situacao =
    v.status === "CANCELADO"
      ? `Cancelado em ${formatarDataHora(v.canceladoEm)} por ${v.canceladoPor?.login ?? "-"} · ${v.motivoCancelamento ? rotuloMotivoCancelamento[v.motivoCancelamento] : ""}`
      : v.status === "FINALIZADO"
        ? `Baixado em ${formatarDataHora(v.finalizadoEm)}${v.agenda ? ` · ${numeroAgenda(v.agenda.numero)}` : ""}${v.retorno ? ` · ${numeroRetorno(v.retorno.numero)}` : ""}`
        : v.status === "AGENDADO" && v.agenda
          ? `Retirada agendada para ${formatarDataHora(v.agenda.dataPrevista)} · ${numeroAgenda(v.agenda.numero)}`
          : v.tipo === "FORNECEDOR"
            ? "Pendente de devolução ao fornecedor"
            : `Pendente de devolução ao CD ${v.cd.codigo}`;
  const transporte: Celula[] = [
    { rotulo: "Transportadora", valor: v.transportadora ?? "—", colunas: 2 },
    { rotulo: "Placa do veículo", valor: v.placa ? formatarPlaca(v.placa) : "—", colunas: 1 },
    { rotulo: "Motorista", valor: v.motorista ?? "—", colunas: 1 },
  ];
  const emissao: Celula[] = [
    { rotulo: "Data/hora de emissão", valor: formatarDataHora(v.criadoEm), colunas: 2 },
    { rotulo: "Emitido por", valor: v.criadoPor.login, colunas: 1 },
    { rotulo: "Status atual", valor: rotuloStatusVale[v.status], colunas: 1 },
  ];
  const rodape: Celula[] = [
    { rotulo: "ID único do documento", valor: `${codigo} · ${v.id}`, colunas: 2 },
    { rotulo: "Situação", valor: situacao, colunas: 2 },
  ];

  if (v.tipo === "FORNECEDOR") {
    return {
      codigo,
      titulo: "VALE-PALLET PBR",
      subtitulo: "Comprovante de recebimento de pallets de fornecedor",
      vias: ["Via Martin Brower", "Via Fornecedor"],
      linhas: [
        [
          { rotulo: "Fornecedor", valor: v.fornecedor?.nome ?? "—", colunas: 3 },
          { rotulo: "CNPJ", valor: v.fornecedor ? formatarCnpj(v.fornecedor.cnpj) : "—", colunas: 1 },
        ],
        [
          { rotulo: "Transportadora", valor: v.transportadora ?? "—", colunas: 2 },
          { rotulo: "Placa do veículo", valor: v.placa ? formatarPlaca(v.placa) : "—", colunas: 1 },
          { rotulo: "Nota fiscal", valor: rotuloNf(v), colunas: 1 },
        ],
        [
          { rotulo: "CD recebedor", valor: `${v.cd.codigo} - ${v.cd.nome}`, colunas: 2 },
          { rotulo: "Motorista", valor: v.motorista ?? "—", colunas: 2 },
        ],
        emissao,
        rodape,
      ],
      rotuloQuantidade: "Quantidade de pallets PBR recebidos",
      destaque: v.semNotaFiscal
        ? {
            titulo: 'ATENÇÃO: OPERAÇÃO REALIZADA NA OPÇÃO "SEM NOTA FISCAL"',
            texto: "Recebimento registrado sem documento fiscal vinculado. Conferir a origem dos pallets antes da devolução.",
          }
        : null,
      declaracao:
        "Declaramos o recebimento da quantidade de pallets PBR acima, registrada como crédito do fornecedor, a ser devolvida mediante agenda de retirada. Apresente este vale no momento da retirada.",
      assinaturas: ["Conferente / Recebedor", "Motorista / Transportador"],
      nomeAssinatura: v.conferente,
    };
  }

  const viaDestino = v.unidade?.tipo === "CROSS" ? "Via Ponto de Cross" : "Via CD Destino";
  const base = {
    codigo,
    vias: [`Via CD ${v.cd.codigo} (emissor)`, viaDestino] as [string, string],
    nomeAssinatura: null,
  };
  const partes: Celula[] = [
    { rotulo: "CD emissor (credor)", valor: `${v.cd.codigo} - ${v.cd.nome}`, colunas: 2 },
    { rotulo: v.tipo === "ENVIO" ? "Destino (devedor)" : "Devedor", valor: destinoTexto(v.unidade), colunas: 2 },
  ];

  if (v.tipo === "ENVIO") {
    return {
      ...base,
      titulo: "VALE-PALLET DE ENVIO",
      subtitulo: "Pallets PBR enviados para CD / Ponto de Cross",
      linhas: [partes, transporte, emissao, rodape],
      rotuloQuantidade: "Quantidade de pallets PBR enviados",
      destaque: null,
      declaracao: `Os pallets PBR acima ficam sob custódia do destino e compõem o seu saldo devedor com o CD ${v.cd.codigo} até a conferência de retorno.`,
      assinaturas: ["Expedição (CD emissor)", "Motorista / Transportador"],
    };
  }
  if (v.tipo === "OCORRENCIA") {
    const r = v.retornoOrigem;
    return {
      ...base,
      titulo: "VALE-OCORRÊNCIA · FALTA",
      subtitulo: "Divergência física apurada na conferência de retorno",
      linhas: [
        partes,
        [
          { rotulo: "Conferência de origem", valor: r ? numeroRetorno(r.numero) : "—", colunas: 2 },
          { rotulo: "Total dos vales", valor: r ? String(r.totalVales) : "—", colunas: 1 },
          { rotulo: "Contagem física", valor: r ? String(r.quantidadeFisica) : "—", colunas: 1 },
        ],
        transporte,
        emissao,
        rodape,
      ],
      rotuloQuantidade: "Quantidade de pallets em falta",
      destaque: {
        titulo: "OCORRÊNCIA DE DIVERGÊNCIA FÍSICA",
        texto: "A quantidade física recebida foi menor que a soma dos vales devolvidos. A diferença permanece no saldo devedor do remetente.",
      },
      declaracao: `Os pallets em falta continuam devidos ao CD ${v.cd.codigo} e retornam ao saldo devedor do remetente até nova devolução.`,
      assinaturas: ["Conferente (CD recebedor)", "Motorista / Transportador"],
    };
  }
  return {
    ...base,
    titulo: "VALE DE AJUSTE · SALDO DEVEDOR",
    subtitulo: "Inclusão manual de saldo devedor (administrador)",
    linhas: [partes, emissao, rodape],
    rotuloQuantidade: "Quantidade incluída no saldo devedor",
    destaque: null,
    declaracao: `Saldo devedor registrado manualmente com justificativa, devido ao CD ${v.cd.codigo} até a conferência de retorno.`,
    assinaturas: ["Administrador responsável", "Responsável pela unidade devedora"],
  };
}

export const INCLUDE_VALE_DOC = {
  cd: { select: { codigo: true, nome: true } },
  fornecedor: { select: { nome: true, cnpj: true } },
  unidade: { select: { codigo: true, nome: true, tipo: true } },
  criadoPor: { select: { login: true } },
  canceladoPor: { select: { login: true } },
  agenda: { select: { numero: true, dataPrevista: true } },
  retorno: { select: { numero: true } },
  retornoOrigem: { select: { numero: true, totalVales: true, quantidadeFisica: true } },
} as const;
