// Cadastros de demonstração da Torre de Controle Nível Brasil: CDs regionais, Pontos de
// Cross, transportadoras e usuários de teste (um por perfil/unidade). Não cria saldos:
// os estoques começam zerados e entram por Ajuste de Saldo (inclusão manual).
// Uso: npm run db:demo — só executa se ainda não houver movimentações.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.movimentacao.count()) > 0) {
    console.log("[demo] Já existem movimentações — nada foi alterado.");
    return;
  }
  const hub = await prisma.centroDistribuicao.findFirstOrThrow({ where: { hub: true } });

  const unidade = (codigo, nome, cnpj, tipo, cdsAtendidos = []) =>
    prisma.centroDistribuicao.upsert({
      where: { codigo },
      update: {},
      create: { codigo, nome, cnpj, tipo, cdsAtendidos: { create: cdsAtendidos.map((cdId) => ({ cdId })) }, contato: "Gerente da unidade", telefone: "(11) 4000-0000", email: `${codigo.toLowerCase()}@exemplo.com.br` },
    });
  const cdsp = await unidade("CDSP", "CD São Paulo", "11444777000161", "CD");
  const cdrj = await unidade("CDRJ", "CD Rio de Janeiro", "19131243000197", "CD");
  await unidade("XCPS", "Cross Campinas", "04252011000110", "CROSS", [cdsp.id, hub.id]);
  await unidade("XSJC", "Cross São José dos Campos", "07526557000100", "CROSS", [hub.id]);
  await unidade("XNIT", "Cross Niterói", "60746948000112", "CROSS", [cdrj.id]);

  for (const [nome, cnpj] of [
    ["Transportes Rápido", "45997418000153"],
    ["LogBR Cargas", "33000167000101"],
  ]) {
    await prisma.transportadora.upsert({ where: { cnpj }, update: {}, create: { nome, cnpj } });
  }

  const senhaHash = await bcrypt.hash("teste123", 10);
  const operador = ["dashboard", "envio", "recebimento", "quebras", "vales", "excluir_vale", "relatorios"];
  const unidades = await prisma.centroDistribuicao.findMany();
  const id = (codigo) => unidades.find((u) => u.codigo === codigo).id;
  for (const [login, nome, codigo, permissoes] of [
    ["hub", "Operador Hub CDJC", hub.codigo, [...operador, "reparo", "tv"]],
    ["sp", "Operador CD São Paulo", "CDSP", operador],
    ["rj", "Operador CD Rio", "CDRJ", operador],
    ["campinas", "Operador Cross Campinas", "XCPS", operador],
  ]) {
    await prisma.usuario.upsert({ where: { login }, update: {}, create: { login, nome, senhaHash, unidadeId: id(codigo), permissoes } });
  }
  console.log("[demo] Unidades, transportadoras e usuários de teste (senha teste123) criados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
