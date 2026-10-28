import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { auditar, obterSaldos, ROTULO_CONTA } from "@/lib/conta";
import { tem } from "@/lib/permissoes";
import { pendenciasPorFornecedor, posicaoUnidades, valesEmAberto } from "@/lib/consultas";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { lerFiltros } from "@/lib/filtros";
import {
  formatarCnpj,
  formatarPlaca,
  numeroAgenda,
  numeroConferencia,
  numeroVale,
  parteVale,
  rotuloMotivoCancelamento,
  rotuloResolucao,
  rotuloTipoUnidade,
  rotuloTipoVale,
  rotuloNf,
  rotuloStatusAgenda,
  rotuloStatusVale,
  rotuloTipo,
} from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Coluna = { header: string; key: string; width?: number };

function planilha(wb: ExcelJS.Workbook, nome: string, colunas: Coluna[], linhas: Record<string, unknown>[]) {
  const ws = wb.addWorksheet(nome, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = colunas.map((c) => ({ ...c, width: c.width ?? Math.max(12, c.header.length + 2) }));
  ws.addRows(linhas);
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  if (linhas.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  return ws;
}

const csvCampo = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const usuario = await getUsuarioAtual();
  if (!usuario) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!tem(usuario, "relatorios")) return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  const cd = usuario.cd;
  if (!cd) return NextResponse.json({ erro: "Selecione o CD de operação" }, { status: 409 });

  const sp = req.nextUrl.searchParams;
  const { de, ate, tipo, periodo, where } = lerFiltros({ de: sp.get("de"), ate: sp.get("ate"), tipo: sp.get("tipo") }, cd.id);
  const formato = sp.get("formato") === "csv" ? "csv" : "xlsx";

  const movs = await prisma.movimentacao.findMany({
    where,
    include: { usuario: true, unidade: true, fornecedor: true, vale: true, agenda: true, conferencia: true },
    orderBy: { criadoEm: "asc" },
  });
  const linhasMov = movs.map((m) => ({
    dataHora: formatarDataHora(m.criadoEm),
    tipo: rotuloTipo[m.tipo],
    quantidade: m.quantidade,
    origem: ROTULO_CONTA[m.origem],
    destino: ROTULO_CONTA[m.destino],
    cd: cd.codigo,
    unidade: m.unidade ? `${m.unidade.codigo} - ${m.unidade.nome}` : "",
    fornecedor: m.fornecedor?.nome ?? "",
    cnpj: m.fornecedor ? formatarCnpj(m.fornecedor.cnpj) : "",
    vale: m.vale ? numeroVale(m.vale.numero, m.vale.tipo) : "",
    agenda: m.agenda ? numeroAgenda(m.agenda.numero) : "",
    retorno: m.conferencia ? numeroConferencia(m.conferencia.numero) : "",
    motivo: m.motivo ?? "",
    usuario: m.usuario.login,
    nomeUsuario: m.usuario.nome,
    observacao: m.observacao ?? "",
  }));
  const colunasMov: Coluna[] = [
    { header: "Data/Hora", key: "dataHora", width: 20 },
    { header: "Tipo", key: "tipo", width: 30 },
    { header: "Quantidade", key: "quantidade" },
    { header: "Origem", key: "origem", width: 22 },
    { header: "Destino", key: "destino", width: 22 },
    { header: "Unidade (livro)", key: "cd", width: 16 },
    { header: "Outra unidade", key: "unidade", width: 25 },
    { header: "Fornecedor", key: "fornecedor", width: 30 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "Vale", key: "vale" },
    { header: "Agenda", key: "agenda" },
    { header: "Conferência", key: "retorno" },
    { header: "Motivo", key: "motivo" },
    { header: "Login", key: "usuario" },
    { header: "Usuário", key: "nomeUsuario", width: 25 },
    { header: "Observação", key: "observacao", width: 40 },
  ];

  await auditar(prisma, {
    acao: "EXPORTAR_RELATORIO",
    entidade: "Relatorio",
    usuarioId: usuario.id,
    cdId: cd.id,
    detalhes: { de, ate, tipo: tipo ?? null, formato },
  });
  const nomeArquivo = `pallets_${cd.codigo}_${de}_a_${ate}`;

  if (formato === "csv") {
    const csv = [
      colunasMov.map((c) => csvCampo(c.header)).join(";"),
      ...linhasMov.map((l) => colunasMov.map((c) => csvCampo(l[c.key as keyof typeof l])).join(";")),
    ].join("\r\n");
    return new NextResponse("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeArquivo}.csv"`,
      },
    });
  }

  const modulo = cd.recebimentoFornecedor;
  const [saldos, vales, agendas, fornecedores, abertos, auditoria, compras, conferencias, posicao] = await Promise.all([
    obterSaldos(cd.id),
    prisma.valePallet.findMany({
      where: { OR: [{ cdId: cd.id }, { unidadeId: cd.id }] },
      include: { fornecedor: true, unidade: true, cd: true, criadoPor: true, agenda: true, canceladoPor: true, conferencia: true },
      orderBy: { numero: "asc" },
    }),
    prisma.agendaDevolucao.findMany({
      where: { cdId: cd.id },
      include: { fornecedor: true, criadoPor: true, validadoPor: true, vales: { select: { numero: true, quantidade: true } } },
      orderBy: { numero: "asc" },
    }),
    modulo ? pendenciasPorFornecedor(cd.id) : [],
    modulo ? valesEmAberto(cd.id) : [],
    prisma.auditoria.findMany({ where: { criadoEm: periodo, cdId: cd.id }, include: { usuario: true }, orderBy: { criadoEm: "asc" } }),
    prisma.compra.findMany({ where: { criadoEm: periodo, cdId: cd.id }, include: { fornecedor: true, usuario: true }, orderBy: { criadoEm: "asc" } }),
    prisma.conferencia.findMany({
      where: { criadoEm: periodo, OR: [{ cdId: cd.id }, { remetenteId: cd.id }] },
      include: { cd: true, remetente: true, usuario: true, ocorrencias: true, vales: { select: { numero: true, tipo: true } } },
      orderBy: { criadoEm: "asc" },
    }),
    posicaoUnidades(usuario.global ? undefined : [cd.id]),
  ]);
  const farolVale = new Map(abertos.map((v) => [v.id, v]));

  const wb = new ExcelJS.Workbook();
  wb.creator = `Control Tower Pallet (${usuario.login})`;
  wb.created = new Date();

  planilha(wb, "Resumo", [{ header: "Indicador", key: "k", width: 40 }, { header: "Valor", key: "v", width: 30 }], [
    { k: "Gerado em", v: formatarDataHora(new Date()) },
    { k: "Gerado por", v: `${usuario.nome} (${usuario.login})` },
    { k: "Unidade de operação", v: `${cd.codigo} - ${cd.nome}` },
    { k: "Período das movimentações", v: `${de} a ${ate}` },
    { k: "Filtro de tipo", v: tipo ? rotuloTipo[tipo] : "Todos" },
    { k: "Pallets PBR (atual)", v: saldos.vazios },
    { k: "Pallets Quebrados (atual)", v: saldos.quebrados },
    { k: "Enviados em trânsito", v: saldos.transito },
    { k: "A receber (vales destinados à unidade)", v: saldos.aReceber },
    { k: "Faltas em aberto (ocorrências)", v: saldos.ocorrencias },
    ...(modulo
      ? [
          { k: "Saldo com fornecedores (vales pendentes)", v: saldos.fornecedores },
          { k: "Vales de fornecedor em aberto", v: saldos.valesFornecedorEmAberto },
        ]
      : []),
    { k: "Descartados/destruídos (acumulado)", v: saldos.descartados },
  ]);

  planilha(wb, "Movimentações", colunasMov, linhasMov);

  planilha(
    wb,
    "Vales-Pallet",
    [
      { header: "Vale", key: "numero" },
      { header: "Tipo", key: "tipo", width: 26 },
      { header: "Ocorrência", key: "ocorrencia" },
      { header: "Status", key: "status" },
      { header: "Farol", key: "farol" },
      { header: "Idade (dias)", key: "idade" },
      { header: "Remetente", key: "remetente", width: 14 },
      { header: "Fornecedor / destino", key: "fornecedor", width: 30 },
      { header: "CNPJ", key: "cnpj", width: 20 },
      { header: "Transportadora", key: "transportadora", width: 25 },
      { header: "Placa", key: "placa" },
      { header: "Rota", key: "rota", width: 14 },
      { header: "Data de faturamento", key: "faturamento", width: 16 },
      { header: "Nota Fiscal", key: "nf", width: 18 },
      { header: "Chave NF-e", key: "chaveNfe", width: 48 },
      { header: "Conferente", key: "conferente", width: 20 },
      { header: "Pallets PBR", key: "bons" },
      { header: "Pallets Quebrados", key: "quebrados" },
      { header: "Quantidade", key: "quantidade" },
      { header: "Resolução", key: "resolucao", width: 24 },
      { header: "Emissão", key: "emissao", width: 20 },
      { header: "Emitido por", key: "usuario" },
      { header: "Agenda / Conferência", key: "agenda" },
      { header: "Baixado em", key: "finalizado", width: 20 },
      { header: "Excluído em", key: "excluido", width: 20 },
      { header: "Excluído por", key: "excluidoPor" },
      { header: "Motivo da exclusão", key: "motivo", width: 24 },
      { header: "Observação da exclusão", key: "obsExclusao", width: 40 },
    ],
    vales.map((v) => ({
      numero: numeroVale(v.numero, v.tipo),
      tipo: rotuloTipoVale[v.tipo],
      ocorrencia: v.ocorrencia ?? "",
      status: rotuloStatusVale[v.status],
      farol: farolVale.get(v.id)?.farol ?? "",
      idade: farolVale.get(v.id)?.idade ?? "",
      remetente: v.cd.codigo,
      fornecedor: parteVale(v),
      cnpj: v.fornecedor ? formatarCnpj(v.fornecedor.cnpj) : "",
      transportadora: v.transportadora ?? "",
      placa: v.placa ? formatarPlaca(v.placa) : "",
      rota: v.rota ?? "",
      faturamento: v.dataFaturamento ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(v.dataFaturamento) : "",
      nf: v.tipo === "FORNECEDOR" ? rotuloNf(v) : "",
      chaveNfe: v.chaveNfe ?? "",
      conferente: v.conferente ?? "",
      bons: v.quantidadeBons,
      quebrados: v.quantidadeQuebrados,
      quantidade: v.quantidade,
      resolucao: v.resolucao ? rotuloResolucao[v.resolucao] : "",
      emissao: formatarDataHora(v.criadoEm),
      usuario: v.criadoPor.login,
      agenda: v.agenda ? numeroAgenda(v.agenda.numero) : v.conferencia ? numeroConferencia(v.conferencia.numero) : "",
      finalizado: v.finalizadoEm ? formatarDataHora(v.finalizadoEm) : "",
      excluido: v.canceladoEm ? formatarDataHora(v.canceladoEm) : "",
      excluidoPor: v.canceladoPor?.login ?? "",
      motivo: v.motivoCancelamento ? rotuloMotivoCancelamento[v.motivoCancelamento] : "",
      obsExclusao: v.observacaoCancelamento ?? "",
    })),
  );

  if (modulo) planilha(
    wb,
    "Agendas",
    [
      { header: "Agenda", key: "numero" },
      { header: "Status", key: "status" },
      { header: "Fornecedor", key: "fornecedor", width: 30 },
      { header: "Data prevista", key: "prevista" },
      { header: "Vales", key: "vales", width: 30 },
      { header: "Pallets", key: "total" },
      { header: "Criada em", key: "criada", width: 20 },
      { header: "Criada por", key: "criadoPor" },
      { header: "Validada em", key: "validada", width: 20 },
      { header: "Validada por", key: "validadoPor" },
      { header: "Observação", key: "obs", width: 40 },
    ],
    agendas.map((a) => ({
      numero: numeroAgenda(a.numero),
      status: rotuloStatusAgenda[a.status],
      fornecedor: a.fornecedor.nome,
      prevista: formatarData(a.dataPrevista),
      vales: a.vales.map((v) => numeroVale(v.numero, "FORNECEDOR")).join(", "),
      total: a.vales.reduce((s, v) => s + v.quantidade, 0),
      criada: formatarDataHora(a.criadoEm),
      criadoPor: a.criadoPor.login,
      validada: a.validadoEm ? formatarDataHora(a.validadoEm) : "",
      validadoPor: a.validadoPor?.login ?? "",
      obs: a.observacao ?? "",
    })),
  );

  planilha(
    wb,
    "Compras",
    [
      { header: "Data/Hora", key: "dataHora", width: 20 },
      { header: "NF", key: "nf" },
      { header: "Série", key: "serie" },
      { header: "Fornecedor", key: "fornecedor", width: 30 },
      { header: "CNPJ", key: "cnpj", width: 20 },
      { header: "Quantidade", key: "quantidade" },
      { header: "Chave de acesso", key: "chave", width: 48 },
      { header: "Login", key: "usuario" },
      { header: "Observação", key: "obs", width: 40 },
    ],
    compras.map((c) => ({
      dataHora: formatarDataHora(c.criadoEm),
      nf: c.notaFiscal,
      serie: c.serie,
      fornecedor: c.fornecedor.nome,
      cnpj: formatarCnpj(c.fornecedor.cnpj),
      quantidade: c.quantidade,
      chave: c.chaveAcesso,
      usuario: c.usuario.login,
      obs: c.observacao ?? "",
    })),
  );

  if (modulo) planilha(
    wb,
    "Pendências Fornecedor",
    [
      { header: "Farol", key: "farol" },
      { header: "Fornecedor", key: "fornecedor", width: 30 },
      { header: "CNPJ", key: "cnpj", width: 20 },
      { header: "Vales em aberto", key: "vales" },
      { header: "Pallets pendentes", key: "total" },
      { header: "Vale mais antigo", key: "antigo" },
    ],
    fornecedores.map((f) => ({
      farol: f.farol,
      fornecedor: f.fornecedor.nome,
      cnpj: formatarCnpj(f.fornecedor.cnpj),
      vales: f.vales,
      total: f.total,
      antigo: formatarData(f.maisAntigo),
    })),
  );

  planilha(
    wb,
    "Conferências",
    [
      { header: "Conferência", key: "numero" },
      { header: "Data/Hora", key: "dataHora", width: 20 },
      { header: "Remetente", key: "remetente", width: 22 },
      { header: "Recebedor", key: "recebedor", width: 22 },
      { header: "Vales conferidos", key: "vales", width: 30 },
      { header: "Declarado", key: "total" },
      { header: "Pallets PBR recebidos", key: "bons" },
      { header: "Pallets Quebrados recebidos", key: "quebrados" },
      { header: "Diferença", key: "diferenca" },
      { header: "Vale de Ocorrência", key: "ocorrencia" },
      { header: "Placa", key: "placa" },
      { header: "Transportadora", key: "transportadora", width: 24 },
      { header: "Login", key: "usuario" },
      { header: "Observação", key: "obs", width: 40 },
    ],
    conferencias.map((r) => ({
      numero: numeroConferencia(r.numero),
      dataHora: formatarDataHora(r.criadoEm),
      remetente: `${rotuloTipoUnidade[r.remetente.tipo]} ${r.remetente.codigo}`,
      recebedor: `${rotuloTipoUnidade[r.cd.tipo]} ${r.cd.codigo}`,
      vales: r.vales.map((v) => numeroVale(v.numero, v.tipo)).join(", "),
      total: r.totalDeclarado,
      bons: r.recebidoBons,
      quebrados: r.recebidoQuebrados,
      diferenca: r.diferenca,
      ocorrencia: r.ocorrencias.map((o) => numeroVale(o.numero, "OCORRENCIA")).join(", "),
      placa: r.placa ? formatarPlaca(r.placa) : "",
      transportadora: r.transportadora ?? "",
      usuario: r.usuario.login,
      obs: r.observacao ?? "",
    })),
  );

  planilha(
    wb,
    "Posição por Unidade",
    [
      { header: "Tipo", key: "tipo" },
      { header: "Sigla", key: "codigo" },
      { header: "Unidade", key: "nome", width: 30 },
      { header: "Pallets PBR", key: "bons" },
      { header: "Pallets Quebrados", key: "quebrados" },
      { header: "Em trânsito (enviados)", key: "transito" },
      { header: "A receber", key: "receber" },
      { header: "Faltas em aberto", key: "ocorrencias" },
    ],
    posicao.map((p) => ({
      tipo: p.unidade.hub ? "CD Hub" : rotuloTipoUnidade[p.unidade.tipo],
      codigo: p.unidade.codigo,
      nome: p.unidade.nome,
      bons: p.vazios,
      quebrados: p.quebrados,
      transito: p.transito,
      receber: p.aReceber,
      ocorrencias: p.ocorrencias,
    })),
  );

  planilha(
    wb,
    "Auditoria",
    [
      { header: "Data/Hora", key: "dataHora", width: 20 },
      { header: "Login", key: "usuario" },
      { header: "Ação", key: "acao", width: 30 },
      { header: "Estoque origem", key: "origem", width: 22 },
      { header: "Estoque destino", key: "destino", width: 22 },
      { header: "Quantidade", key: "quantidade" },
      { header: "Observação / justificativa", key: "observacao", width: 40 },
      { header: "Entidade", key: "entidade", width: 20 },
      { header: "ID", key: "entidadeId", width: 28 },
      { header: "Detalhes", key: "detalhes", width: 60 },
    ],
    auditoria.map((a) => ({
      dataHora: formatarDataHora(a.criadoEm),
      usuario: a.usuario?.login ?? "",
      acao: a.acao,
      origem: a.origem ? ROTULO_CONTA[a.origem] : "",
      destino: a.destino ? ROTULO_CONTA[a.destino] : "",
      quantidade: a.quantidade ?? "",
      observacao: a.observacao ?? "",
      entidade: a.entidade,
      entidadeId: a.entidadeId ?? "",
      detalhes: a.detalhes ? JSON.stringify(a.detalhes) : "",
    })),
  );

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

