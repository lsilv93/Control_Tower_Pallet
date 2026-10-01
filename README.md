# Control Tower Pallet — Gestão de Pallets PBR

Sistema web para controlar a **conta corrente de pallets PBR**: saldo do pulmão, envios e recebimentos de CDs, recebimento de fornecedores com **Vale-Pallet** (impressão A4 em 2 vias), agendas de devolução, avarias e relatórios em Excel. Toda operação registra **data, hora e usuário**.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS · Prisma 6 · PostgreSQL · pronto para a **Vercel** (com Neon Postgres).

---

## Funcionalidades

| Módulo | Rota | O que faz |
|---|---|---|
| Centro de Comando (Dashboard) | `/` | KPIs: saldo do **Estoque de Vazios**, **Estoque do CD**, **Estoque de Quebrados**, **Total geral** (com barra de composição) e **SSTK enviados/recebidos** (transferências Vazios ↔ CD). Gráfico de **extrato da conta corrente** (entradas x saídas por dia/semana/mês + saldo total ao fim de cada período) e gráfico de **pendências por fornecedor** (cor = farol). Filtros: Dia, Semana do Ano, Mês, Intervalo (De/Até), Geral e **Fornecedor**. Farol Vale-pallet, vales cancelados e últimas movimentações. |
| Transferência para o CD / Retorno do CD | `/cd/envio`, `/cd/recebimento` | Vazios → CD e CD → Vazios. |
| Recebimento de Pallets | `/fornecedor/entrada` | **Foco automático no código de barras da NF-e** (chave de acesso, 44 dígitos; Enter valida e o leitor sem Enter é reconhecido ao completar 44). A chave é validada (tamanho, UF, mês, dígito verificador, modelo 55, CNPJ) e dela são extraídos **CNPJ do emitente** (índices 6–19) e **número/série da NF** (índices 25–33). Fornecedor cadastrado: campos preenchidos e foco na quantidade; não cadastrado: cadastro com o CNPJ pré-preenchido. NF já recebida é bloqueada. Opção **"Sem Nota Fiscal"**: oculta o código de barras e busca o fornecedor pelo CNPJ. Campos: quantidade, conferente, transportadora, placa e observações. Gera o Vale-Pallet: **Fornecedor → Estoque do CD**. |
| Consulta de Vales | `/vales/consulta`, `/vales/[id]` | Busca por número, fornecedor, status (Pendente / Agendado / Baixado / Cancelado) e período. Botões **Baixar PDF** e **Imprimir** em cada vale e no detalhe (que mostra os lançamentos do vale na conta corrente). |
| Agendar Retirada | `/vales` | Seleciona os vales (clique ou leitura do código de barras) e abre o **pop-up de data e hora** da retirada; grava a agenda e muda o status para Agendado. |
| Baixa de Pagamento | `/agendas` | Valida a agenda: vales Baixados e saída **Vazios → Fornecedor**. |
| Excluir Vale | `/vales/excluir` | Motivo obrigatório + observação + confirmação; vale fica Cancelado e a entrada é estornada **CD → Fornecedor**. |
| Quebras / Conserto / Descarte | `/avarias/*` | Vazios → Quebrados; Quebrados → Vazios; descarte com **pop-up "De qual pulmão este pallet será descartado/destruído?"** (Vazios ou Quebrados). |
| Compra de Pallets | `/pallets/adicionar` | Leitura da chave da NF-e; **Compra → Vazios**. |
| Ajuste Manual (Master) | `/estoque/ajuste` | **Somente MASTER**: inclui/remove saldo em qualquer estoque com justificativa obrigatória (contrapartida: conta Ajuste). |
| Auditoria | `/auditoria` | Log imutável: data/hora, usuário, tipo de ação, estoque origem, estoque destino, quantidade e justificativa. Filtros por período, usuário e tipo; exportação **Excel** e **PDF**. |
| Relatórios | `/relatorios` | Movimentações por período/tipo e exportação Excel/CSV completa. |
| Cadastros | `/cadastros/*` | Transportadoras, fornecedores, CDs e **usuários com permissões por tela**. |
| PDF do vale | `/api/vales/[id]/pdf` | PDF A4 com 2 vias (Martin Brower / Fornecedor), logotipo, remetente, número, data/hora, fornecedor, transportadora, **número da NF** (ou **"SEM NOTA FISCAL"** com observação de destaque), quantidade e tipo, status atual, código de barras e assinaturas (Conferente, com o nome / Motorista). |

### Conta corrente em partida dobrada

Toda movimentação registra uma **conta de origem** e uma **conta de destino** com a mesma quantidade: nenhum pallet surge ou desaparece. Os três **estoques físicos** são VAZIOS, CD e QUEBRADOS; FORNECEDOR, COMPRA, DESCARTE e AJUSTE são as **contrapartidas externas**. A soma de todas as contas é sempre zero.

| Operação | Origem (subtrai) | Destino (soma) |
|---|---|---|
| Transferência para o CD | Vazios | CD |
| Retorno do CD | CD | Vazios |
| Recebimento de fornecedor (gera vale) | Fornecedor | CD |
| Baixa de pagamento (devolução) | Vazios | Fornecedor |
| Exclusão de vale (estorno) | CD | Fornecedor |
| Quebra | Vazios | Quebrados |
| Conserto / reparo | Quebrados | Vazios |
| Descarte / destruição | Vazios **ou** Quebrados (pop-up) | Descarte |
| Compra | Compra | Vazios |
| Ajuste manual (somente MASTER) | Ajuste ↔ qualquer estoque | |

- **ACID:** cada operação roda numa transação do PostgreSQL com bloqueio consultivo; um estoque nunca fica negativo, mesmo com usuários simultâneos.
- **Imutável:** triggers no banco impedem `UPDATE`/`DELETE` em `Movimentacao` e `Auditoria`; correções são feitas por novos lançamentos (estorno/ajuste).
- **Migração do histórico:** a migração `partida_dobrada_dados` converte os lançamentos antigos (pulmão/avariados) para origem/destino e **aborta** se qualquer linha divergir dos saldos antigos.

> **Banco zerado em 01/10/2026:** a migração `20261001160000_zerar_dados` apagou (uma única vez, no deploy seguinte) todos os dados e cadastros e reiniciou a numeração de vales e agendas, mantendo apenas as contas de usuário.

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

## Sair (logout)

O botão **Sair** fica fixo no topo do menu lateral (ao lado do tema) e no cabeçalho do celular, além do rodapé do menu. Ao sair, o token da sessão é **revogado no servidor** (tabela `SessaoRevogada`), o cookie é apagado, o logout é auditado e o usuário volta para o login. Uma cópia antiga do cookie deixa de funcionar, e as páginas autenticadas não ficam em cache do navegador.

## Tema claro / escuro

O botão de sol/lua no menu (ou no cabeçalho, no celular, e na tela de login) alterna o tema. A escolha fica salva no navegador (cookie) e é aplicada já na renderização do servidor, sem piscar.

## Leitores de código de barras

Leitores USB/Bluetooth funcionam como teclado (digitam o código e dão Enter): basta deixar o cursor no campo de leitura. No celular (Chrome/Edge no Android), o botão **Ler com a câmera** usa a câmera.

## Perfis de acesso (RBAC)

- **MASTER:** todas as telas e o **ajuste manual de saldos** (exclusivo). Só um MASTER cria/edita outro MASTER.
- **ADMIN:** todas as telas e a gestão de usuários, **sem** ajuste manual.
- **OPERADOR:** apenas as telas marcadas no cadastro (Dashboard, Transferências do CD, Entrada de fornecedor, Vales/consulta, Agendamento e baixa, Excluir vale, Avarias, Compras, Relatórios, Auditoria, Cadastros, CDs). Sem acesso ao Dashboard, o operador entra na primeira tela liberada.

As permissões valem nas telas, nas ações do servidor e nas APIs (exportações e PDF retornam 403 sem permissão). Na migração, administradores existentes viraram MASTER e operadores mantiveram o acesso que tinham.
