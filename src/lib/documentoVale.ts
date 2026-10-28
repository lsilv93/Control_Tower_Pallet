import type { MotivoCancelamento, ResolucaoOcorrencia, StatusVale, TipoOcorrencia, TipoUnidade, TipoVale } from "@prisma/client";
import { formatarDataHora } from "./datas";
import {
  formatarCnpj,
  formatarNumero,
  formatarPlaca,
  numeroAgenda,
  numeroConferencia,
  numeroVale,
  rotuloMotivoCancelamento,
  rotuloNf,
  rotuloResolucao,
  rotuloStatusVale,
} from "./formatos";

type UnidadeDoc = { codigo: string; nome: string; tipo: TipoUnidade; hub: boolean };

/** Dados do vale necessários para montar o documento impresso / PDF. */
export type ValeDoc = {
  id: string;
  numero: number;
  tipo: TipoVale;
  ocorrencia: TipoOcorrencia | null;
  status: StatusVale;
  quantidade: number;
  quantidadeBons: number;
  quantidadeQuebrados: number;
  transportadora: string | null;
  placa: string | null;
  rota: string | null;
  dataFaturamento: Date | null;
  notaFiscal: string | null;
  serieNf: string | null;
  semNotaFiscal: boolean;
  conferente: string | null;
  observacao: string | null;
  criadoEm: Date;
  finalizadoEm: Date | null;
  canceladoEm: Date | null;
  motivoCancelamento: MotivoCancelamento | null;
  resolucao: ResolucaoOcorrencia | null;
  resolvidoEm: Date | null;
  cd: UnidadeDoc;
  fornecedor: { nome: string; cnpj: string } | null;
  unidade: UnidadeDoc | null;
  criadoPor: { login: string };
  canceladoPor: { login: string } | null;
  agenda: { numero: number; dataPrevista: Date } | null;
  conferencia: { numero: number } | null;
  conferenciaOrigem: { numero: number; totalDeclarado: number; recebidoBons: number; recebidoQuebrados: number } | null;
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

const rotuloTipo = (u: UnidadeDoc) => (u.tipo === "CROSS" ? "Ponto de Cross" : u.hub ? "CD Hub" : "CD");
const unidadeTexto = (u: UnidadeDoc | null) => (u ? `${rotuloTipo(u)} ${u.codigo} - ${u.nome}` : "—");

/** Monta o conteúdo do documento conforme o tipo do vale (fornecedor, envio ou ocorrência). */
export function documentoVale(v: ValeDoc): DocumentoVale {
  const codigo = numeroVale(v.numero, v.tipo);
  const situacao =
    v.status === "CANCELADO"
      ? `Cancelado em ${formatarDataHora(v.canceladoEm)} por ${v.canceladoPor?.login ?? "-"} · ${v.motivoCancelamento ? rotuloMotivoCancelamento[v.motivoCancelamento] : ""}`
      : v.tipo === "OCORRENCIA"
        ? v.resolucao
          ? `${rotuloResolucao[v.resolucao]} em ${formatarDataHora(v.resolvidoEm)}`
          : v.ocorrencia === "SOBRA"
            ? "Sobra registrada no estoque do recebedor"
            : "Em aberto · aguardando apuração"
        : v.status === "FINALIZADO"
          ? `${v.tipo === "ENVIO" ? "Conferido" : "Baixado"} em ${formatarDataHora(v.finalizadoEm)}${v.agenda ? ` · ${numeroAgenda(v.agenda.numero)}` : ""}${v.conferencia ? ` · ${numeroConferencia(v.conferencia.numero)}` : ""}`
          : v.status === "AGENDADO" && v.agenda
            ? `Retirada agendada para ${formatarDataHora(v.agenda.dataPrevista)} · ${numeroAgenda(v.agenda.numero)}`
            : v.tipo === "FORNECEDOR"
              ? "Pendente de devolução ao fornecedor"
              : `Em trânsito · aguardando conferência em ${v.unidade?.codigo ?? "-"}`;
  const transporte: Celula[] = [
    { rotulo: "Transportadora", valor: v.transportadora ?? "—", colunas: 2 },
    { rotulo: "Placa do veículo", valor: v.placa ? formatarPlaca(v.placa) : "—", colunas: 2 },
  ];
  // Envio para Ponto de Cross: rota e data de faturamento.
  const envioCross: Celula[] = [
    { rotulo: "Transportadora", valor: v.transportadora ?? "—", colunas: 1 },
    { rotulo: "Placa do veículo", valor: v.placa ? formatarPlaca(v.placa) : "—", colunas: 1 },
    { rotulo: "Rota", valor: v.rota ?? "—", colunas: 1 },
    { rotulo: "Data de faturamento", valor: v.dataFaturamento ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(v.dataFaturamento) : "—", colunas: 1 },
  ];
  const emissao: Celula[] = [
    { rotulo: "Data/hora de emissão", valor: formatarDataHora(v.criadoEm), colunas: 2 },
    { rotulo: "Emitido por", valor: v.criadoPor.login, colunas: 1 },
    { rotulo: "Status atual", valor: v.tipo === "OCORRENCIA" && v.ocorrencia === "FALTA" && v.status === "PENDENTE" ? "Em aberto" : rotuloStatusVale[v.status], colunas: 1 },
  ];
  const rodape: Celula[] = [
    { rotulo: "ID único do documento", valor: `${codigo} · ${v.id}`, colunas: 2 },
    { rotulo: "Situação", valor: situacao, colunas: 2 },
  ];
  const composicao: Celula[] = [
    { rotulo: "Pallets PBR", valor: formatarNumero(v.quantidadeBons), colunas: 2 },
    { rotulo: "Pallets Quebrados", valor: formatarNumero(v.quantidadeQuebrados), colunas: 2 },
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
        [{ rotulo: "CD recebedor", valor: `${v.cd.codigo} - ${v.cd.nome}`, colunas: 4 }],
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
      assinaturas: ["Conferente / Recebedor", "Transportador"],
      nomeAssinatura: v.conferente,
    };
  }

  if (v.tipo === "ENVIO") {
    const paraHub = !!v.unidade?.hub && v.quantidadeBons === 0;
    return {
      codigo,
      vias: [`Via ${v.cd.codigo} (remetente)`, `Via ${v.unidade?.codigo ?? "destino"} (destinatário)`],
      nomeAssinatura: null,
      titulo: paraHub ? "VALE DE PALLETS QUEBRADOS" : "VALE-PALLET DE ENVIO",
      subtitulo: paraHub ? "Pallets quebrados enviados ao CD Hub (CDJC) para conserto" : "Transferência de pallets PBR entre unidades",
      linhas: [
        [
          { rotulo: "Remetente", valor: unidadeTexto(v.cd), colunas: 2 },
          { rotulo: "Destinatário", valor: unidadeTexto(v.unidade), colunas: 2 },
        ],
        composicao,
        v.unidade?.tipo === "CROSS" ? envioCross : transporte,
        emissao,
        rodape,
      ],
      rotuloQuantidade: "Total de pallets PBR enviados",
      destaque: null,
      declaracao: `Os pallets acima saíram do estoque de ${v.cd.codigo} e permanecem em trânsito até a conferência física em ${v.unidade?.codigo ?? "destino"}. Divergências na conferência geram Vale de Ocorrência.`,
      assinaturas: ["Expedição (remetente)", "Transportador"],
    };
  }

  const c = v.conferenciaOrigem;
  const falta = v.ocorrencia !== "SOBRA";
  return {
    codigo,
    vias: [`Via ${v.cd.codigo} (remetente)`, `Via ${v.unidade?.codigo ?? "recebedor"} (recebedor)`],
    nomeAssinatura: null,
    titulo: falta ? "VALE DE OCORRÊNCIA · FALTA" : "VALE DE OCORRÊNCIA · SOBRA",
    subtitulo: falta ? "Devolutivo ao remetente: divergência física apurada na conferência" : "Registro de pallets recebidos a mais na conferência",
    linhas: [
      [
        { rotulo: "Remetente", valor: unidadeTexto(v.cd), colunas: 2 },
        { rotulo: "Recebedor (conferente)", valor: unidadeTexto(v.unidade), colunas: 2 },
      ],
      [
        { rotulo: "Conferência de origem", valor: c ? numeroConferencia(c.numero) : "—", colunas: 1 },
        { rotulo: "Declarado nos vales", valor: c ? formatarNumero(c.totalDeclarado) : "—", colunas: 1 },
        { rotulo: "Pallets PBR recebidos", valor: c ? formatarNumero(c.recebidoBons) : "—", colunas: 1 },
        { rotulo: "Pallets Quebrados recebidos", valor: c ? formatarNumero(c.recebidoQuebrados) : "—", colunas: 1 },
      ],
      transporte,
      emissao,
      rodape,
    ],
    rotuloQuantidade: falta ? "Quantidade de pallets em falta" : "Quantidade de pallets em sobra",
    destaque: falta
      ? { titulo: "OCORRÊNCIA DE FALTA", texto: `A contagem física foi menor que a soma dos vales. A diferença fica em ocorrência no livro de ${v.cd.codigo} até ser localizada ou baixada como perda.` }
      : { titulo: "OCORRÊNCIA DE SOBRA", texto: `A contagem física foi maior que a soma dos vales. O excedente entrou no estoque de ${v.unidade?.codigo ?? "recebedor"}.` },
    declaracao: falta
      ? `Vale devolutivo à unidade remetente ${v.cd.codigo} para apuração. Registrado com data, hora e número do vale, auditável pelas duas unidades.`
      : "Sobra registrada com data, hora e número do vale, auditável pelas duas unidades.",
    assinaturas: ["Conferente (recebedor)", "Transportador"],
  };
}

export const INCLUDE_VALE_DOC = {
  cd: { select: { codigo: true, nome: true, tipo: true, hub: true } },
  fornecedor: { select: { nome: true, cnpj: true } },
  unidade: { select: { codigo: true, nome: true, tipo: true, hub: true } },
  criadoPor: { select: { login: true } },
  canceladoPor: { select: { login: true } },
  agenda: { select: { numero: true, dataPrevista: true } },
  conferencia: { select: { numero: true } },
  conferenciaOrigem: { select: { numero: true, totalDeclarado: true, recebidoBons: true, recebidoQuebrados: true } },
} as const;
