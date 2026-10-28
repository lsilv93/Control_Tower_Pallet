// Seed idempotente (executado no build da Vercel):
// 1. cria o CD Hub principal CDJC se ainda não houver nenhuma unidade;
// 2. cria o usuário MASTER inicial, vinculado ao Hub, se ainda não houver nenhum usuário.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  let hub = await prisma.centroDistribuicao.findFirst({ where: { hub: true } });
  if (!hub && (await prisma.centroDistribuicao.count()) === 0) {
    hub = await prisma.centroDistribuicao.create({
      data: {
        codigo: "CDJC",
        nome: "CD Jacareí (Hub Nível Brasil)",
        tipo: "CD",
        hub: true,
        cnpj: "59568428001150",
        contato: "Administrador",
      },
    });
    await prisma.auditoria.create({
      data: { acao: "SEED_HUB", entidade: "CentroDistribuicao", entidadeId: hub.id, cdId: hub.id },
    });
    console.log(`[seed] Hub CDJC criado (complete telefone e e-mail em Cadastros → CDs).`);
  }

  const total = await prisma.usuario.count();
  if (total > 0) {
    console.log(`[seed] ${total} usuário(s) já cadastrado(s) — nada a fazer.`);
    return;
  }
  if (!hub) hub = await prisma.centroDistribuicao.findFirstOrThrow({ where: { tipo: "CD" }, orderBy: { criadoEm: "asc" } });
  const login = (process.env.SEED_ADMIN_LOGIN || "admin").toLowerCase();
  const senha = process.env.SEED_ADMIN_PASSWORD || "Admin";
  const admin = await prisma.usuario.create({
    data: {
      nome: "Administrador",
      login,
      senhaHash: await bcrypt.hash(senha, 10),
      perfil: "MASTER",
      unidadeId: hub.id,
    },
  });
  await prisma.auditoria.create({
    data: { acao: "SEED_ADMIN", entidade: "Usuario", entidadeId: admin.id, cdId: hub.id },
  });
  console.log(`[seed] Usuário MASTER "${login}" criado no ${hub.codigo}. Altere a senha após o primeiro acesso.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
