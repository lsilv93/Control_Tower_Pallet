import ExcelJS from "exceljs";
import { NextResponse, type NextRequest } from "next/server";
import { getUsuarioAtual } from "@/lib/auth";
import { auditar, obterSaldos } from "@/lib/conta";
import { pendenciasPorFornecedor, valesEmAberto } from "@/lib/consultas";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { lerFiltros } from "@/lib/filtros";
import {
  formatarCnpj,
  formatarPlaca,
  numeroAgenda,
  numeroVale,
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

  const sp = req.nextUrl.searchParams;
  const { de, ate, tipo, periodo, where } = lerFiltros({ de: sp.get("de"), ate: sp.get("ate"), tipo: sp.get("tipo") });
  const formato = sp.get("formato") === "csv" ? "csv" : "xlsx";

  const movs = await prisma.movimentacao.findMany({
    where,
    include: { usuario: true, cd: true, fornecedor: true, vale: true, agenda: true },
    orderBy: { criadoEm: "asc" },
  });
  const linhasMov = movs.map((m) => ({
    dataHora: formatarDataHora(m.criadoEm),
    tipo: rotuloTipo[m.tipo],
    quantidade: m.quantidade,
    deltaPulmao: m.deltaPulmao,
    deltaAvaria: m.deltaAvaria,
    cd: m.cd ? `${m.cd.codigo} - ${m.cd.nome}` : "",
    fornecedor: m.fornecedor?.nome ?? "",
    cnpj: m.fornecedor ? formatarCnpj(m.fornecedor.cnpj) : "",
    vale: m.vale ? numeroVale(m.vale.numero) : "",
    agenda: m.agenda ? numeroAgenda(m.agenda.numero) : "",
    usuario: m.usuario.login,
    nomeUsuario: m.usuario.nome,
    observacao: m.observacao ?? "",
  }));
  const colunasMov: Coluna[] = [
    { header: "Data/Hora", key: "dataHora", width: 20 },
    { header: "Tipo", key: "tipo", width: 30 },
    { header: "Quantidade", key: "quantidade" },
    { header: "Variação Pulmão", key: "deltaPulmao", width: 16 },
    { header: "Variação Avariados", key: "deltaAvaria", width: 18 },
    { header: "CD", key: "cd", width: 25 },
    { header: "Fornecedor", key: "fornecedor", width: 30 },
    { header: "CNPJ", key: "cnpj", width: 20 },
    { header: "Vale", key: "vale" },
    { header: "Agenda", key: "agenda" },
    { header: "Login", key: "usuario" },
    { header: "Usuário", key: "nomeUsuario", width: 25 },
    { header: "Observação", key: "observacao", width: 40 },
  ];

  await auditar(prisma, {
    acao: "EXPORTAR_RELATORIO",
    entidade: "Relatorio",
    usuarioId: usuario.id,
    detalhes: { de, ate, tipo: tipo ?? null, formato },
  });
  const nomeArquivo = `pallets_${de}_a_${ate}`;

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

  const [saldos, vales, agendas, fornecedores, abertos, auditoria, compras] = await Promise.all([
    obterSaldos(),
    prisma.valePallet.findMany({
      include: { fornecedor: true, criadoPor: true, agenda: true },
      orderBy: { numero: "asc" },
    }),
    prisma.agendaDevolucao.findMany({
      include: { fornecedor: true, criadoPor: true, validadoPor: true, vales: { select: { numero: true, quantidade: true } } },
      orderBy: { numero: "asc" },
    }),
    pendenciasPorFornecedor(),
    valesEmAberto(),
    prisma.auditoria.findMany({ where: { criadoEm: periodo }, include: { usuario: true }, orderBy: { criadoEm: "asc" } }),
    prisma.compra.findMany({ where: { criadoEm: periodo }, include: { fornecedor: true, usuario: true }, orderBy: { criadoEm: "asc" } }),
  ]);
  const farolVale = new Map(abertos.map((v) => [v.id, v]));

  const wb = new ExcelJS.Workbook();
  wb.creator = `Control Tower Pallet (${usuario.login})`;
  wb.created = new Date();

  planilha(wb, "Resumo", [{ header: "Indicador", key: "k", width: 40 }, { header: "Valor", key: "v", width: 30 }], [
    { k: "Gerado em", v: formatarDataHora(new Date()) },
    { k: "Gerado por", v: `${usuario.nome} (${usuario.login})` },
    { k: "Período das movimentações", v: `${de} a ${ate}` },
    { k: "Filtro de tipo", v: tipo ? rotuloTipo[tipo] : "Todos" },
    { k: "Saldo atual no pulmão", v: saldos.pulmao },
    { k: "Avariados em estoque", v: saldos.avaria },
    { k: "Pallets pendentes com fornecedores", v: saldos.pendenteFornecedores },
    { k: "Vales em aberto", v: saldos.valesEmAberto },
  ]);

  planilha(wb, "Movimentações", colunasMov, linhasMov);

  planilha(
    wb,
    "Vales-Pallet",
    [
      { header: "Vale", key: "numero" },
      { header: "Status", key: "status" },
      { header: "Farol", key: "farol" },
      { header: "Idade (dias)", key: "idade" },
      { header: "Fornecedor", key: "fornecedor", width: 30 },
      { header: "CNPJ", key: "cnpj", width: 20 },
      { header: "Transportadora", key: "transportadora", width: 25 },
      { header: "Placa", key: "placa" },
      { header: "Nota Fiscal", key: "nf" },
      { header: "Quantidade", key: "quantidade" },
      { header: "Emissão", key: "emissao", width: 20 },
      { header: "Emitido por", key: "usuario" },
      { header: "Agenda", key: "agenda" },
      { header: "Finalizado em", key: "finalizado", width: 20 },
    ],
    vales.map((v) => ({
      numero: numeroVale(v.numero),
      status: rotuloStatusVale[v.status],
      farol: farolVale.get(v.id)?.farol ?? "",
      idade: farolVale.get(v.id)?.idade ?? "",
      fornecedor: v.fornecedor.nome,
      cnpj: formatarCnpj(v.fornecedor.cnpj),
      transportadora: v.transportadora,
      placa: formatarPlaca(v.placa),
      nf: v.notaFiscal,
      quantidade: v.quantidade,
      emissao: formatarDataHora(v.criadoEm),
      usuario: v.criadoPor.login,
      agenda: v.agenda ? numeroAgenda(v.agenda.numero) : "",
      finalizado: v.finalizadoEm ? formatarDataHora(v.finalizadoEm) : "",
    })),
  );

  planilha(
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
      vales: a.vales.map((v) => numeroVale(v.numero)).join(", "),
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

  planilha(
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
    "Auditoria",
    [
      { header: "Data/Hora", key: "dataHora", width: 20 },
      { header: "Login", key: "usuario" },
      { header: "Ação", key: "acao", width: 30 },
      { header: "Entidade", key: "entidade", width: 20 },
      { header: "ID", key: "entidadeId", width: 28 },
      { header: "Detalhes", key: "detalhes", width: 60 },
    ],
    auditoria.map((a) => ({
      dataHora: formatarDataHora(a.criadoEm),
      usuario: a.usuario?.login ?? "",
      acao: a.acao,
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

