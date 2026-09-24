# Control Tower Pallet — Gestão de Pallets PBR

Sistema web para controlar a **conta corrente de pallets PBR**: saldo do pulmão, envios e recebimentos de CDs, recebimento de fornecedores com **Vale-Pallet** (impressão A4 em 2 vias), agendas de devolução, avarias e relatórios em Excel. Toda operação registra **data, hora e usuário**.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS · Prisma 6 · PostgreSQL · pronto para a **Vercel** (com Neon Postgres).

---

## Funcionalidades

| Módulo | Rota | O que faz |
|---|---|---|
| Dashboard | `/` | Saldo do pulmão, entradas/saídas do dia, totais por subcategoria (hoje e no mês), **farol por idade do vale** (🔴 ≥ 30 dias · 🟡 20–29 · 🟢 < 20) e **farol por fornecedor** (🔴 > 100 · 🟡 50–100 · 🟢 < 50). Atualiza sozinho a cada 30 s. |
| Envio para o CD | `/cd/envio` | Saída imediata do pulmão para o CD escolhido (bloqueia se não houver saldo). |
| Recebimento do CD | `/cd/recebimento` | Entrada no pulmão de pallets vindos de um CD. |
| Entrada de Fornecedor | `/fornecedor/entrada` | Fornecedor, CNPJ (com validação dos dígitos), transportadora, placa (padrão antigo ou Mercosul), NF e quantidade. Gera o Vale-Pallet (`VP-000001`…) e abre a impressão A4 automaticamente. |
| Impressão do vale | `/imprimir/vale/[id]` | Folha A4 dividida ao meio: 1ª via Empresa / 2ª via Transportador. |
| Vales Pendentes | `/vales` | Lista os vales em aberto com farol; selecione os vales e clique em **Gerar Agenda de Devolução** (uma agenda por fornecedor). |
| Baixa de Pagamento | `/agendas` | Valida a agenda: os vales passam para **Finalizado** e os pallets saem oficialmente do pulmão. Também dá para cancelar a agenda (os vales voltam para Pendente). |
| Quebras | `/avarias/quebras` | Tira do pulmão e manda para o estoque de avariados (observação obrigatória). |
| Recuperados | `/avarias/recuperados` | Devolve pallets avariados ao pulmão. |
| Descarte | `/avarias/descarte` | Baixa definitiva de avariados (justificativa obrigatória). |
| Relatórios | `/relatorios` | Filtros por período e tipo, resumo, trilha de auditoria. Exporta **Excel (.xlsx)** com as abas Resumo, Movimentações, Vales-Pallet, Agendas, Pendências por Fornecedor e Auditoria, ou as movimentações em **.csv**. |
| Cadastros (admin) | `/cadastros` | CDs, usuários (admin/operador), fornecedores e **ajuste de inventário** (saldo inicial / contagem física). |
| Minha Senha | `/conta` | Troca da própria senha. |

### Regras da conta corrente

Cada movimentação é uma linha no livro-razão (`Movimentacao`) com a variação do **pulmão** e do **estoque de avariados**:

| Tipo | Pulmão | Avariados |
|---|---|---|
| Recebimento de Fornecedor, Recebimento do CD, Ajuste de entrada | + | |
| Envio para CD, Devolução ao Fornecedor, Ajuste de saída | − | |
| Quebra | − | + |
| Recuperado | + | − |
| Descarte | | − |

- **Saldo do pulmão** = soma das variações. Nenhuma saída pode deixar o saldo negativo. As movimentações são serializadas com um *advisory lock* do PostgreSQL, então duas saídas ao mesmo tempo não conseguem furar o saldo.
- **Pendente com fornecedores** = soma dos vales ainda não finalizados.
- **Auditoria:** toda movimentação guarda `usuarioId` e `criadoEm`. Além disso, a tabela `Auditoria` registra login, geração de vale, agendas, cadastros, ajustes e exportações.

---

## Deploy na Vercel (passo a passo)

1. **Importe o repositório** em [vercel.com/new](https://vercel.com/new). A Vercel detecta Next.js sozinha.
2. **Crie o banco:** no projeto, vá em *Storage → Create Database → Neon (Postgres)* e conecte ao projeto. A integração cria as variáveis `DATABASE_URL` e `DATABASE_URL_UNPOOLED`, que são exatamente as que o sistema usa.
   - Se usar outro Postgres, crie você mesmo as duas variáveis: a URL com pool em `DATABASE_URL` e a direta em `DATABASE_URL_UNPOOLED`. Se não houver pool, use a mesma URL nas duas.
3. **Adicione as variáveis de ambiente** em *Settings → Environment Variables*:
   - `AUTH_SECRET`: um valor aleatório longo (gere com `openssl rand -base64 32`). **Obrigatória.**
   - `SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD` (opcionais): login e senha do primeiro administrador. O padrão é `admin` / `admin123`.
4. **Faça o deploy.** O `build` roda automaticamente:
   `prisma generate → prisma migrate deploy → prisma db seed → next build`.
   Ou seja, cria as tabelas e o usuário administrador (só se o banco ainda não tiver nenhum usuário).
5. Entre com o administrador, **troque a senha** em *Minha Senha*, cadastre os **CDs** e lance o **saldo inicial** em *Cadastros → Ajuste de inventário*.

> Os deploys de *Preview* usam as mesmas variáveis. Se não quiser que previews rodem migrações no banco de produção, crie um banco separado para o ambiente Preview.

---

## Rodando localmente

Pré-requisitos: Node.js 20+ e PostgreSQL.

```bash
cp .env.example .env            # ajuste DATABASE_URL, DATABASE_URL_UNPOOLED e AUTH_SECRET
npm install
npx prisma migrate deploy       # cria as tabelas
npm run db:seed                 # cria o admin (admin / admin123)
npm run db:demo                 # (opcional) dados de demonstração
npm run dev                     # http://localhost:3000
```

Postgres rápido via Docker:

```bash
docker run -d --name pallet-db -e POSTGRES_USER=pallet -e POSTGRES_PASSWORD=pallet -e POSTGRES_DB=pallet -p 5432:5432 postgres:16
```

### Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Migrações + seed + build de produção (o que roda na Vercel) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Cria uma nova migração depois de alterar `prisma/schema.prisma` |
| `npm run db:demo` | Popula com dados de demonstração (só se não houver movimentações) |
| `npm run db:studio` | Prisma Studio |

---

## Estrutura

```
prisma/
  schema.prisma        # modelo de dados (Usuario, CentroDistribuicao, Fornecedor,
                       # ValePallet, AgendaDevolucao, Movimentacao, Auditoria)
  migrations/          # migrações SQL
  seed.mjs             # admin inicial (idempotente)
  demo.mjs             # dados de demonstração
src/
  middleware.ts        # exige login em todas as rotas
  actions/             # Server Actions (regras de negócio de cada tela)
  lib/conta.ts         # livro-razão: lançamentos, saldos, lock e auditoria
  lib/consultas.ts     # consultas do dashboard/farol
  lib/farol.ts         # regras dos faróis
  app/(sistema)/       # telas autenticadas com menu lateral
  app/imprimir/        # layout de impressão A4 do vale
  app/api/exportar/    # exportação Excel/CSV
  components/          # componentes de UI
```

## Perfis de acesso

- **Administrador:** tudo, mais *Cadastros* (CDs, usuários, ajuste de inventário).
- **Operador:** todas as operações do dia a dia e os relatórios.

Usuários inativados perdem o acesso na hora, porque a sessão é revalidada no banco a cada requisição.
