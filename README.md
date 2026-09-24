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
| Entrada de Fornecedor | `/fornecedor/entrada` | Fornecedor, CNPJ (numérico ou alfanumérico, com validação dos dígitos), transportadora (sugere as cadastradas), placa (padrão antigo ou Mercosul), NF e quantidade. Gera o Vale-Pallet (`VP-000001`…) e abre a impressão A4 automaticamente. |
| Impressão do vale | `/imprimir/vale/[id]` | Folha A4 dividida ao meio (1ª via Empresa / 2ª via Transportador), com o **ID único** e **código de barras Code 128** do vale. |
| Vales Pendentes | `/vales` | Lista os vales em aberto com farol; selecione os vales (clicando ou **lendo o código de barras do vale**) e clique em **Gerar Agenda de Devolução** (uma agenda por fornecedor). |
| Baixa de Pagamento | `/agendas` | Conferência por leitura óptica do vale (localiza o vale na agenda). Valida a agenda: os vales passam para **Finalizado** e os pallets saem oficialmente do pulmão. Também dá para cancelar a agenda (os vales voltam para Pendente). |
| Quebras | `/avarias/quebras` | Tira do pulmão e manda para o estoque de avariados (observação obrigatória). |
| Recuperados | `/avarias/recuperados` | Devolve pallets avariados ao pulmão. |
| Descarte | `/avarias/descarte` | Baixa definitiva de avariados (justificativa obrigatória). |
| Relatórios | `/relatorios` | Filtros por período e tipo, resumo, trilha de auditoria. Exporta **Excel (.xlsx)** com as abas Resumo, Movimentações, Vales-Pallet, Agendas, Compras, Pendências por Fornecedor e Auditoria, ou as movimentações em **.csv**. |
| **Adicionar Pallets** (restrito) | `/pallets/adicionar` | Botão exclusivo para administradores ou usuários com a permissão *Pode adicionar pallets*. **Compra:** lê o código de barras do DANFE (chave de acesso da NF-e, 44 posições) com leitor USB/Bluetooth, câmera do celular ou o botão *Simular leitura*; identifica automaticamente **NF, série e fornecedor** (CNPJ do emitente) e, se o fornecedor não existir, abre o **cadastro rápido**. A mesma NF não pode ser lançada duas vezes. **Ajuste de inventário:** quantidade + motivo. Tudo auditado. |
| Cadastros | `/cadastros/*` | Abas **Transportadoras**, **Fornecedores** (qualquer usuário), **Centros de Distribuição** e **Usuários** (somente administrador). Criar, editar e ativar/inativar. |
| Minha Senha | `/conta` | Troca da própria senha. |

### Regras da conta corrente

Cada movimentação é uma linha no livro-razão (`Movimentacao`) com a variação do **pulmão** e do **estoque de avariados**:

| Tipo | Pulmão | Avariados |
|---|---|---|
| Recebimento de Fornecedor, Recebimento do CD, Compra, Ajuste de entrada | + | |
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
2. **Crie o banco:** adicione a integração **Prisma Postgres** (ou *Storage → Neon*) e conecte ao projeto. Ela cria a variável `DATABASE_URL` automaticamente.
   - `DATABASE_URL_UNPOOLED` é opcional: se não existir, as migrações usam a própria `DATABASE_URL`.
   - **Não** cadastre na Vercel o `DATABASE_URL` de exemplo do `.env.example` (ele aponta para `localhost`).
3. **Adicione as variáveis de ambiente** em *Settings → Environment Variables*:
   - `AUTH_SECRET`: um valor aleatório longo (gere com `openssl rand -base64 32`). **Obrigatória.**
   - `SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD` (opcionais): login e senha do primeiro administrador. O padrão é `admin` / `admin123`.
4. **Faça o deploy.** O `build` roda automaticamente:
   `prisma generate → prisma migrate deploy → prisma db seed → next build` (script `scripts/build.mjs`).
   Ou seja, cria as tabelas e o usuário administrador (só se o banco ainda não tiver nenhum usuário).
5. Entre com o administrador, **troque a senha** em *Minha Senha*, cadastre os **CDs** em *Cadastros* e lance o **saldo inicial** em *Adicionar Pallets → Ajuste de Inventário*.

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

## Tema claro / escuro

O botão de sol/lua no menu (ou no cabeçalho, no celular, e na tela de login) alterna o tema. A escolha fica salva no navegador (cookie) e é aplicada já na renderização do servidor, sem piscar.

## Leitores de código de barras

Leitores USB/Bluetooth funcionam como teclado (digitam o código e dão Enter): basta deixar o cursor no campo de leitura. No celular (Chrome/Edge no Android), o botão **Ler com a câmera** usa a câmera.

## Perfis de acesso

- **Administrador:** tudo, inclusive cadastros de CDs e usuários e **Adicionar Pallets**.
- **Operador:** operações do dia a dia, relatórios e cadastros de transportadoras e fornecedores.
- **Permissão "Pode adicionar pallets":** marcada no cadastro do usuário, libera **Adicionar Pallets** para um operador.

Usuários inativados perdem o acesso na hora, porque a sessão é revalidada no banco a cada requisição.
