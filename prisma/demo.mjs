// Popula o banco com dados de demonstração do modelo multi-CD: CDs, Pontos de Cross,
// fornecedores, vales de fornecedor com idades variadas, envios, uma conferência com
// falta (Vale-Ocorrência), quebras e reparo. Uso: npm run db:demo
// Só executa se ainda não houver movimentações registradas.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dias = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  if ((await prisma.movimentacao.count()) > 0) {
    console.log("[demo] Já existem movimentações — nada foi alterado.");
    return;
  }
  const admin = await prisma.usuario.findFirstOrThrow({ where: { perfil: { in: ["MASTER", "ADMIN"] } } });

  const unidade = (codigo, nome, cidade, tipo) =>
    prisma.centroDistribuicao.upsert({ where: { codigo }, update: {}, create: { codigo, nome, cidade, tipo } });
  const principal = await unidade("PRINCIPAL", "CD Principal", "Jacareí/SP", "CD");
  for (const nome of ["Transportes Rápido", "LogBR Cargas", "TransSul", "Expresso Minas"]) {
    const cnpj = { "Transportes Rápido": "11444777000161", "LogBR Cargas": "19131243000197", TransSul: "04252011000110", "Expresso Minas": "07526557000100" }[nome];
    await prisma.transportadora.upsert({ where: { cnpj }, update: {}, create: { nome, cnpj } });
  }
  const [cd01, cd02] = await Promise.all([
    unidade("CD01", "CD São Paulo", "Cajamar/SP", "CD"),
    unidade("CD02", "CD Rio de Janeiro", "Duque de Caxias/RJ", "CD"),
  ]);
  const [cx01, cx02] = await Promise.all([
    unidade("CX01", "Cross Campinas", "Campinas/SP", "CROSS"),
    unidade("CX02", "Cross Vale do Paraíba", "São José dos Campos/SP", "CROSS"),
  ]);

  const fornecedores = await Promise.all(
    [
      ["11222333000181", "Alimentos Bom Sabor Ltda"],
      ["45997418000153", "Bebidas Norte Distribuidora S.A."],
      ["60746948000112", "Higiene & Limpeza Brasil Ltda"],
      ["33000167000101", "Laticínios Serra Verde"],
    ].map(([cnpj, nome]) => prisma.fornecedor.upsert({ where: { cnpj }, update: {}, create: { cnpj, nome } })),
  );

  // Partida dobrada por CD: cada lançamento tem conta de origem e de destino, e gera a auditoria.
  const mov = async (tipo, quantidade, origem, destino, criadoEm, extra = {}) => {
    const m = await prisma.movimentacao.create({
      data: { tipo, quantidade, origem, destino, criadoEm, usuarioId: admin.id, cdId: principal.id, ...extra },
    });
    await prisma.auditoria.create({
      data: {
        acao: `MOVIMENTACAO_${tipo}`,
        entidade: "Movimentacao",
        entidadeId: m.id,
        usuarioId: admin.id,
        cdId: principal.id,
        origem,
        destino,
        quantidade,
        observacao: extra.observacao ?? "Dados de demonstração",
        criadoEm,
      },
    });
    return m;
  };

  await mov("INCLUSAO_VAZIOS", 500, "AJUSTE", "VAZIOS", dias(40), { motivo: "COMPRA", observacao: "Compra - saldo inicial (inventário)" });

  const vales = [
    [0, 38, 60, "Transportes Rápido", "ABC1D23", "10231"],
    [0, 25, 45, "Transportes Rápido", "ABC1D23", "10388"],
    [1, 33, 80, "LogBR Cargas", "FGH4567", "55012"],
    [1, 12, 40, "LogBR Cargas", "FGH4567", "55190"],
    [2, 21, 30, "TransSul", "JKL2M34", "7781"],
    [2, 3, 12, "TransSul", "JKL2M34", "7802"],
    [3, 1, 26, "Expresso Minas", "QRS8T90", "90011"],
  ];
  for (const [f, idade, qtd, transportadora, placa, nf] of vales) {
    const vale = await prisma.valePallet.create({
      data: { tipo: "FORNECEDOR", cdId: principal.id, fornecedorId: fornecedores[f].id, transportadora, placa, notaFiscal: nf, quantidade: qtd, criadoEm: dias(idade), criadoPorId: admin.id },
    });
    await mov("RECEBIMENTO_FORNECEDOR", qtd, "FORNECEDOR", "CARGA", dias(idade), {
      fornecedorId: fornecedores[f].id,
      valeId: vale.id,
      observacao: `NF ${nf} - ${transportadora} - ${placa}`,
    });
  }

  const envio = async (destino, qtd, idade, transportadora, placa) => {
    const cross = destino.tipo === "CROSS";
    const vale = await prisma.valePallet.create({
      data: { tipo: "ENVIO", cdId: principal.id, unidadeId: destino.id, transportadora, placa: cross ? placa : null, rota: cross ? "R-01/SP" : null, quantidade: qtd, criadoEm: dias(idade), criadoPorId: admin.id },
    });
    await mov("ENVIO_UNIDADE", qtd, "CARGA", "CUSTODIA", dias(idade), { unidadeId: destino.id, valeId: vale.id, observacao: `Envio para ${destino.codigo}` });
    return vale;
  };
  await envio(cd01, 120, 10, "LogBR Cargas", "FGH4567");
  await envio(cd02, 80, 8, "TransSul", "JKL2M34");
  const e1 = await envio(cx01, 100, 6, "Transportes Rápido", "ABC1D23");
  const e2 = await envio(cx01, 50, 5, "Transportes Rápido", "ABC1D23");
  await envio(cx02, 60, 2, "Expresso Minas", "QRS8T90");

  // Conferência de retorno do Cross Campinas: vales 150, contados 140 → Vale-Ocorrência de 10.
  const retorno = await prisma.retornoConferencia.create({
    data: { cdId: principal.id, unidadeId: cx01.id, totalVales: 150, quantidadeFisica: 140, falta: 10, placa: "ABC1D23", transportadora: "Transportes Rápido", observacao: "Faltaram 10 pallets na contagem", usuarioId: admin.id, criadoEm: dias(1) },
  });
  await prisma.valePallet.updateMany({ where: { id: { in: [e1.id, e2.id] } }, data: { status: "FINALIZADO", finalizadoEm: dias(1), retornoId: retorno.id } });
  await mov("RETORNO_UNIDADE", 140, "CUSTODIA", "VAZIOS", dias(1), { unidadeId: cx01.id, retornoId: retorno.id, observacao: "Conferência demo - falta de 10" });
  await prisma.valePallet.create({
    data: { tipo: "OCORRENCIA", cdId: principal.id, unidadeId: cx01.id, quantidade: 10, transportadora: "Transportes Rápido", placa: "ABC1D23", retornoOrigemId: retorno.id, observacao: "OCORRÊNCIA DE DIVERGÊNCIA FÍSICA (demonstração)", criadoEm: dias(1), criadoPorId: admin.id },
  });

  await mov("QUEBRA", 15, "VAZIOS", "QUEBRADOS", dias(4), { observacao: "Longarinas quebradas na descarga" });
  await mov("RECUPERADO", 6, "QUEBRADOS", "VAZIOS", dias(2), { observacao: "Reparo (2 pallet(s) utilizados)" });
  await mov("CANIBALIZACAO", 2, "QUEBRADOS", "DESCARTE", dias(2), { observacao: "Utilizados no reparo" });
  await mov("DESCARTE", 4, "QUEBRADOS", "DESCARTE", dias(1), { observacao: "Pallets irrecuperáveis - madeira podre" });

  console.log("[demo] Dados de demonstração criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
