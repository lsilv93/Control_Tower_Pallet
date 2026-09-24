// Build usado na Vercel: aplica as migrações, cria o admin inicial e gera o Next.js.
// Integrações como o Prisma Postgres criam apenas DATABASE_URL; nesse caso a
// conexão direta das migrações (DATABASE_URL_UNPOOLED) usa a mesma URL.
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL_UNPOOLED && process.env.DATABASE_URL) {
  process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_URL;
}

for (const cmd of ["prisma generate", "prisma migrate deploy", "prisma db seed", "next build"]) {
  console.log(`\n> ${cmd}`);
  execSync(`npx ${cmd}`, { stdio: "inherit", env: process.env });
}
