// Popula o banco com dados de demonstração (CDs, fornecedores, vales com
// idades variadas e movimentações). Uso: npm run db:demo
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

  const cds = await Promise.all(
    [
      ["CD01", "CD São Paulo", "Cajamar/SP"],
      ["CD02", "CD Rio de Janeiro", "Duque de Caxias/RJ"],
      ["CD03", "CD Minas Gerais", "Contagem/MG"],
    ].map(([codigo, nome, cidade]) =>
      prisma.centroDistribuicao.upsert({ where: { codigo }, update: {}, create: { codigo, nome, cidade } }),
    ),
  );

  const fornecedores = await Promise.all(
    [
      ["11222333000181", "Alimentos Bom Sabor Ltda"],
      ["45997418000153", "Bebidas Norte Distribuidora S.A."],
      ["60746948000112", "Higiene & Limpeza Brasil Ltda"],
      ["33000167000101", "Laticínios Serra Verde"],
    ].map(([cnpj, nome]) => prisma.fornecedor.upsert({ where: { cnpj }, update: {}, create: { cnpj, nome } })),
  );

  // Partida dobrada: cada lançamento tem conta de origem e de destino.
  // Cada lançamento gera também o registro de auditoria (como na aplicação).
  const mov = async (tipo, quantidade, origem, destino, criadoEm, extra = {}) => {
    const m = await prisma.movimentacao.create({
      data: { tipo, quantidade, origem, destino, criadoEm, usuarioId: admin.id, ...extra },
    });
    await prisma.auditoria.create({
      data: {
        acao: `MOVIMENTACAO_${tipo}`,
        entidade: "Movimentacao",
        entidadeId: m.id,
        usuarioId: admin.id,
        origem,
        destino,
        quantidade,
        observacao: extra.observacao ?? "Dados de demonstração",
        criadoEm,
      },
    });
    return m;
  };

  await mov("AJUSTE_ENTRADA", 500, "AJUSTE", "VAZIOS", dias(40), { observacao: "Saldo inicial (inventário)" });

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
      data: {
        fornecedorId: fornecedores[f].id,
        transportadora,
        placa,
        notaFiscal: nf,
        quantidade: qtd,
        criadoEm: dias(idade),
        criadoPorId: admin.id,
      },
    });
    await mov("RECEBIMENTO_FORNECEDOR", qtd, "FORNECEDOR", "CD", dias(idade), {
      fornecedorId: fornecedores[f].id,
      valeId: vale.id,
      observacao: `NF ${nf} - ${transportadora} - ${placa}`,
    });
  }

  await mov("ENVIO_CD", 120, "VAZIOS", "CD", dias(10), { cdId: cds[0].id });
  await mov("RECEBIMENTO_CD", 70, "CD", "VAZIOS", dias(6), { cdId: cds[1].id });
  await mov("ENVIO_CD", 40, "VAZIOS", "CD", dias(0), { cdId: cds[2].id });
  await mov("RECEBIMENTO_CD", 25, "CD", "VAZIOS", dias(0), { cdId: cds[0].id });
  await mov("QUEBRA", 15, "VAZIOS", "QUEBRADOS", dias(4), { observacao: "Longarinas quebradas na descarga" });
  await mov("RECUPERADO", 6, "QUEBRADOS", "VAZIOS", dias(2), { observacao: "Reparados pela manutenção" });
  await mov("DESCARTE", 4, "QUEBRADOS", "DESCARTE", dias(1), { observacao: "Pallets irrecuperáveis - madeira podre" });

  console.log("[demo] Dados de demonstração criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
