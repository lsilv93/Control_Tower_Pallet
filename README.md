# Control Tower Pallet — Gestão de Pallets PBR

Sistema web para controlar a **conta corrente de pallets PBR**: saldo do pulmão, envios e recebimentos de CDs, recebimento de fornecedores com **Vale-Pallet** (impressão A4 em 2 vias), agendas de devolução, avarias e relatórios em Excel. Toda operação registra **data, hora e usuário**.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS · Prisma 6 · PostgreSQL · pronto para a **Vercel** (com Neon Postgres).

---

## Funcionalidades

### Multi-CD e sessão

- **Unidades:** **CDs** (operam o sistema, com estoques próprios, e também recebem envios) e **Pontos de Cross-Docking** (só recebem envios). Cadastros em *Cadastros → CDs* e *Cadastros → Pontos de Cross*.
- **Usuário x CDs:** no cadastro de usuários marcam-se os CDs em que cada um opera.
  - **1 CD:** selecionado automaticamente ao entrar; a troca fica bloqueada (cadeado no menu).
  - **Mais de 1 CD:** a cada acesso abre o **modal obrigatório "Em qual CD você vai operar?"**; o botão *Trocar CD* do menu reabre o modal.
  - Administradores sem CD marcado operam em todos; operadores precisam de ao menos 1 CD.
- O CD escolhido fica num cookie **revalidado no servidor a cada requisição** (só CDs permitidos ao usuário). Todas as telas, ações, relatórios, PDFs e a auditoria usam o CD ativo; dados de outro CD não aparecem nem podem ser alterados.

### Telas

| Módulo | Rota | O que faz |
|---|---|---|
| Dashboard (Control Tower) | `/` | Cards do CD: **Vazios**, **Saldo do CD (entradas de fornecedores)**, **Quebrados**, **Saldo devedor de CDs/Cross**. Indicadores do período (entradas, envios, retornos e faltas, recuperados, descartados), **saldos devedores por Ponto de Cross e CD destino**, **vales pendentes por fornecedor**, **consolidação por transportadora/motorista**, extrato dos estoques físicos, Farol Vale-pallet, cancelados e últimas movimentações. Filtros: Dia, Semana do Ano, Mês, Intervalo, Geral e Fornecedor. |
| **Tela TV (Control Center)** | `/tv` | Tela cheia para monitores da gerência: Vazios, Quebrados, Recuperados e Descartados (Dia/Mês/Geral), entradas e envios, vales pendentes (total e por fornecedor), saldo devedor por CD/Cross, recebidos no dia por unidade (com faltas) e retiradas agendadas para hoje. **Auto-refresh:** consulta a cada 10 s se houve novo lançamento e recarrega na hora; recarrega também a cada 60 s. |
| Envio para CD / Ponto de Cross | `/cd/envio`, `/cross/envio` | Gera o **Vale-Pallet de Envio** (VE-). **Não subtrai dos Vazios**: só soma no saldo devedor e nos vales pendentes do destino. |
| **Retorno / Conferência** | `/retorno` | Seleciona os vales devolvidos pelo CD/Cross (soma automática) e a **quantidade física contada**. Física menor que os vales: aviso *"Quantidade física (290) menor que o total dos vales (300). Confirmar a falta de 10 pallets?"*; ao confirmar, **placa, transportadora e justificativa são obrigatórias**. Entra nos Vazios só o físico, os vales são baixados e é gerado automaticamente o **Vale-Ocorrência** (VO-) com a diferença, que volta ao saldo devedor do remetente. Física maior que os vales é bloqueada. |
| Recebimento de Pallets | `/fornecedor/entrada` | Leitura da chave da NF-e (ou *Sem Nota Fiscal*), com motorista opcional. Gera o **Vale-Pallet de Fornecedor** (VP-) e **sobe o saldo do CD com o fornecedor**; os Vazios não mudam. |
| Agendar Retirada / Baixa de Pagamento | `/vales`, `/agendas` | Agenda a retirada dos vales de fornecedor; a baixa **subtrai dos Vazios** e reduz a dívida com o fornecedor. |
| Consulta de Vales | `/vales/consulta`, `/vales/[id]` | Todos os tipos (VP, VE, VO, VA), com filtros por tipo, fornecedor, CD/Cross, status e período. PDF e impressão A4 em 2 vias com código de barras. |
| Excluir Vale | `/vales/excluir` | Cancela qualquer tipo de vale pendente com motivo. Fornecedor: estorna o saldo com o fornecedor. Envio, ocorrência ou ajuste: reduz o saldo devedor. |
| Quebras / Conserto / Descarte | `/avarias/*` | Quebra: Vazios → Quebrados. **Reparo** pergunta se outros quebrados foram desmontados; com a **trava matemática** recuperados + utilizados ≤ saldo de quebrados (*"Restam no máximo X pallets para utilização"*), validada no servidor. Recuperados voltam aos Vazios e os utilizados vão para Descartados. Descarte de Vazios ou Quebrados. |
| Compra de Pallets | `/pallets/adicionar` | Leitura da NF-e; Compra → Vazios. |
| **Inclusão de Vazios (Admin)** | `/estoque/vazios` | MASTER/ADMIN sobem o pulmão com **motivo (Compra, Estorno, Devolução)** e observação. Devolução de CD/Cross vai pela conferência de retorno. |
| **Saldo Devedor (Admin)** | `/estoque/devedor` | MASTER/ADMIN incluem saldo devedor de um CD/Cross com **observação e justificativa**; gera um Vale de Ajuste (VA-) baixável no retorno. |
| Correção de Inventário (Master) | `/estoque/ajuste` | Somente MASTER: inclui/remove em Vazios ou Quebrados com justificativa. |
| Auditoria | `/auditoria` | Log imutável com data/hora, usuário, **CD da operação**, tipo, origem/destino, quantidade e observação. Filtro por CD (administrador: "Todos os CDs"), período, usuário e ação; exportação Excel e PDF. |
| Relatórios | `/relatorios` | Movimentações do CD e Excel completo (vales de todos os tipos, conferências de retorno, saldos devedores, agendas, compras, pendências e auditoria). |

### Conta corrente em partida dobrada (por CD)

Cada movimentação tem uma conta de origem e uma de destino com a mesma quantidade, sempre dentro do CD da operação.

- **Estoques físicos** (nunca negativos): VAZIOS e QUEBRADOS.
- **CUSTODIA:** saldo devedor de cada CD destino / Ponto de Cross (nunca negativo).
- **FORNECEDOR:** saldo negativo = pallets devidos aos fornecedores.
- CARGA, COMPRA, DESCARTE e AJUSTE são contrapartidas.

| Operação | Origem | Destino | Efeito |
|---|---|---|---|
| Recebimento de fornecedor (VP) | Fornecedor | Carga | sobe o saldo do CD com o fornecedor |
| Baixa / pagamento ao fornecedor | Vazios | Fornecedor | −Vazios, −dívida |
| Envio para CD / Cross (VE) | Carga | Custódia | +saldo devedor (Vazios inalterados) |
| Retorno de CD / Cross | Custódia | Vazios | +físico nos Vazios, −saldo devedor |
| Falta na conferência (VO) | — | — | a diferença permanece no saldo devedor |
| Quebra | Vazios | Quebrados | |
| Reparo: recuperados / utilizados | Quebrados | Vazios / Descarte | trava: recuperados + utilizados ≤ quebrados |
| Descarte | Vazios ou Quebrados | Descarte | |
| Compra / Inclusão de vazios | Compra / Ajuste | Vazios | |
| Inclusão de saldo devedor (VA) | Ajuste | Custódia | |
| Exclusão de vale | estorno do lançamento original | | |

- **ACID:** cada operação roda numa transação com bloqueio consultivo; nenhum saldo fica negativo, mesmo com usuários simultâneos.
- **Imutável:** triggers no banco impedem `UPDATE`/`DELETE` em `Movimentacao` e `Auditoria`.
- **Invariantes conferidos nos testes:**
  - a soma de todas as contas de cada CD é zero;
  - o saldo devedor de cada unidade é igual à soma dos seus vales pendentes;
  - a dívida com fornecedores é igual à soma dos vales de fornecedor em aberto.

### Migração para multi-CD (15/10/2026)

As migrações `multi_cd_estrutura` e `multi_cd_dados` rodam sozinhas no próximo deploy:

1. Criam o **CD Principal** (código `PRINCIPAL`) e vinculam a ele todo o histórico (movimentações, vales, agendas, compras). **Renomeie-o em Cadastros → CDs.**
2. Operadores existentes passam a operar no CD Principal; administradores operam em todos.
3. Transferências antigas para CDs ainda não retornadas viram **saldo devedor** do CD destino (um Vale de Ajuste "Saldo migrado" por CD).
4. Os saldos de Vazios, Quebrados e vales de fornecedor ficam **exatamente iguais**.

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
5. Entre com o administrador, **troque a senha** em *Minha Senha*, renomeie o **CD Principal** e cadastre os demais CDs e Pontos de Cross em *Cadastros*, vincule os usuários aos CDs e lance o **saldo inicial** em *Inclusão de Vazios*.

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

- **MASTER:** todas as telas, inclusões manuais e a **correção de inventário** (exclusiva). Só um MASTER cria ou edita outro MASTER.
- **ADMIN:** todas as telas, gestão de usuários e as **inclusões manuais de vazios e de saldo devedor**, sem correção de inventário.
- **OPERADOR:** apenas as telas marcadas no cadastro e somente nos CDs vinculados.
  - Telas disponíveis: Dashboard, Tela TV, Envio/Retorno de CDs e Cross, Entrada de fornecedor, Vales, Agendamento e baixa, Excluir vale, Avarias, Compras, Relatórios, Auditoria, Cadastros, CDs/Cross.

As permissões valem nas telas, nas ações do servidor e nas APIs (exportações e PDF retornam 403 sem permissão e 404 para vales de outro CD).
