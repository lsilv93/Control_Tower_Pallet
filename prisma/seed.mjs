// Seed idempotente: cria o usuário administrador inicial apenas se o banco
// ainda não tiver nenhum usuário. Executado automaticamente no build da Vercel.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.usuario.count();
  if (total > 0) {
    console.log(`[seed] ${total} usuário(s) já cadastrado(s) — nada a fazer.`);
    return;
  }
  const login = (process.env.SEED_ADMIN_LOGIN || "admin").toLowerCase();
  const senha = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const admin = await prisma.usuario.create({
    data: {
      nome: "Administrador",
      login,
      senhaHash: await bcrypt.hash(senha, 10),
      perfil: "ADMIN",
    },
  });
  await prisma.auditoria.create({
    data: { acao: "SEED_ADMIN", entidade: "Usuario", entidadeId: admin.id },
  });
  console.log(`[seed] Usuário administrador "${login}" criado. Altere a senha após o primeiro acesso.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
