# Control Tower Pallet — Gestão de Pallets PBR

Sistema web da **Torre de Controle Nível Brasil** de pallets PBR: estoque de pallets bons e quebrados em cada CD e Ponto de Cross, envios com Vale-Pallet (A4 em 2 vias com código de barras), conferência de recebimento com ocorrências de falta/sobra, conserto no CD Hub (CDJC), descarte, ajustes de administrador e TV gerencial. Toda operação registra **data, hora, usuário e unidade** em log imutável.

**Stack:** Next.js 15 (App Router, Server Actions) · React 19 · Tailwind CSS · Prisma 6 · PostgreSQL · pronto para a **Vercel** (com Neon Postgres).

---

## Funcionalidades

### Unidades, usuários e visão

- **Unidades:** **CDs** e **Pontos de Cross**, todos com estoque próprio de **Pallets PBR** e **Pallets Quebrados**. O **CD Hub (CDJC)** recebe os quebrados das filiais, faz o conserto e devolve Pallets PBR. Cada Ponto de Cross é vinculado a **um ou mais CDs** (tabela `CrossCD`, N:N) e só troca pallets com os CDs vinculados.
- **Cada usuário pertence a exatamente uma unidade.**
  - **Operadores:** pertencem a 1 CD ou 1 Ponto de Cross e veem e operam somente essa unidade (fixa, com cadeado no menu).
  - **Master e Administrador:** únicos com acesso cruzado a todos os CDs e Pontos de Cross. Escolhem a unidade de operação no modal *"Em qual unidade você vai operar?"* e podem trocá-la no menu (*Trocar unidade*).
  - **Usuários do Hub (CDJC):** operam somente o CDJC; têm acesso de leitura à TV Nível Brasil.
  - **Usuários de Ponto de Cross:** exclusivamente o painel do próprio Cross, recebimento/conferência dos vales enviados pelos CDs, **retorno ao CD** (escolhendo na lista qual CD vinculado recebe a devolução) e lançar quebrado.
- A unidade escolhida fica num cookie **revalidado no servidor a cada requisição**. Vales, PDFs e ocorrências só são visíveis às duas unidades envolvidas, ou a quem tem visão global.

### Telas

| Módulo | Rota | O que faz |
|---|---|---|
| Painel | `/` | KPIs da unidade: bons, quebrados, em trânsito, a receber e faltas em aberto. Mostra o estoque por Ponto de Cross (todos na visão global; os da região num CD regional) e os vales em trânsito. Indicadores do período: enviados, recebidos, faltas, recuperados e descartados. Inclui consolidação por transportadora e o extrato dos estoques. |
| **Torre de Controle (TV)** | `/tv` | Somente visão global, sem dados de fornecedores. Mostra bons e quebrados por CD e Cross e os **ativos fora do Hub** de cada filial (bons, quebrados, em trânsito ao CDJC, recebidos x enviados e **acuracidade**). Tem tela cheia (Esc volta) e auto-refresh a cada nova movimentação em qualquer unidade. |
| **Envio de Pallets** | `/envio` | Abas: *para Ponto de Cross*, *para CD* e *quebrados para o CDJC*. Informa bons e/ou quebrados, transportador, placa e, no envio a Cross, rota e data de faturamento. **Saldo nunca negativo:** a tela bloqueia e o servidor revalida com o saldo travado. Antes de gravar aparece a confirmação *"Tem certeza do [CD/Cross] selecionado e da quantidade informada (X pallets)?"*. Gera o **Vale-Pallet de Envio** (VE-) ou o **Vale de Pallets Quebrados**; os pallets ficam em trânsito. Um Ponto de Cross envia só para CDs. |
| **Recebimento / Conferência** | `/recebimento` | Seleciona os vales pendentes do remetente (soma automática) e informa a contagem física de **bons** e **quebrados**. Bons entram nos vazios e quebrados nos quebrados. Uma divergência exige confirmação e justificativa. **Falta:** gera o **Vale de Ocorrência** (VO-) devolutivo ao remetente. **Sobra:** entra no estoque e é registrada num VO de sobra. Cada conferência recebe um número (RC-). |
| **Ocorrências** | `/ocorrencias` | Auditoria de faltas e sobras com data/hora, vale, conferência, remetente e recebedor, visível às duas pontas. O administrador resolve cada falta: **localizada** (volta ao estoque do remetente) ou **perda**. |
| Lançar Quebrado / Conserto / Descarte | `/avarias/*` | Quebra: bons → quebrados. **Conserto:** só no Hub, com trava matemática (recuperados + utilizados ≤ quebrados). **Descarte:** todos os usuários, com pop-up de confirmação, e lista imutável de **Pallets Descartados**. |
| **Ajuste de Saldo (Admin)** | `/estoque/inclusao`, `/estoque/remocao` | Inclusão de bons ou quebrados em qualquer CD/Cross com motivo (**Compra, Devolução, Ajuste Estoque, Inventário**) e observação obrigatória. Remoção com justificativa e confirmação *"Tem certeza?"*. Nunca deixa saldo negativo e tudo vai para a auditoria. |
| Recebimento Pallet Fornecedor | `/fornecedor/entrada`, `/vales`, `/agendas` | **Desligado por padrão**: o Master libera por CD em *Cadastros → CDs → Editar → Configurações do Master*. Inclui NF-e/Sem NF, Vale-Pallet de Fornecedor (VP-), agendas e baixa. |
| Consulta / Excluir Vale | `/vales/consulta`, `/vales/excluir` | Consulta dos vales da unidade (todos, na visão global). A exclusão de um envio ainda não conferido devolve os pallets do trânsito ao estoque de origem. |
| Compra de Pallets | `/pallets/adicionar` | Leitura da NF-e (visão global); Compra → Vazios. |
| Cadastros | `/cadastros/*` | Fornecedor, CD e Ponto de Cross: **só Sigla e Nome são obrigatórios**. CNPJ (máscara e validação), contato responsável, telefone (máscara) e e-mail são opcionais e só validados se preenchidos. O Ponto de Cross marca **um ou mais CDs atendidos**. Usuários têm unidade obrigatória. |
| Auditoria / Relatórios | `/auditoria`, `/relatorios` | Log imutável (filtro por unidade; *Todas as unidades* na visão global) e Excel completo: movimentações, vales, conferências, posição por unidade, auditoria. |

### Conta corrente em partida dobrada (um livro por unidade)

Cada movimentação tem conta de origem e de destino com a mesma quantidade, no livro da unidade dona do lançamento.

- **Contas controladas (nunca negativas):** VAZIOS (bons), QUEBRADOS, TRANSITO (enviados e ainda não conferidos) e OCORRENCIA (faltas em apuração). Todas as saídas passam por um lock consultivo do PostgreSQL, então duas operações simultâneas não deixam saldo negativo.
- **Envio:** origem VAZIOS/QUEBRADOS → TRANSITO.
- **Conferência:**
  - No livro do remetente: TRANSITO → ENVIADO, e a falta vai para TRANSITO → OCORRENCIA.
  - No livro do recebedor: RECEBIDO → VAZIOS/QUEBRADOS, e a sobra vai para SOBRA → estoque.
- **Ocorrência resolvida:** OCORRENCIA → estoque (localizada) ou OCORRENCIA → PERDA.
- **Invariantes:** ΣENVIADO = ΣRECEBIDO. Gatilhos no banco impedem UPDATE/DELETE em `Movimentacao` e `Auditoria`.

### Reset total (27/10/2026)

A migração `20261027120000_torre_controle_reset_total` **apaga todas as tabelas e dados** e recria o schema limpo. Em seguida o seed cria o **CD Hub CDJC** e o usuário MASTER (`SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD`, padrão `admin` / `admin123`). Os saldos começam zerados e entram por *Ajuste de Saldo → Inclusão manual* (motivo Inventário).

A migração `20261028120000_zerar_dados_para_testes` zera de novo **todos os dados** (cadastros, usuários, vales e movimentações) para o início dos testes, mantendo o schema e os gatilhos de imutabilidade. O seed recria o CDJC e o MASTER.

**Listas de seleção:** transportadora, CD, Ponto de Cross e fornecedor são sempre escolhidos em listas suspensas carregadas com os registros cadastrados e ativos (sem digitação livre). O servidor revalida cada escolha.

**Sair:** apaga os cookies de sessão e de unidade antes de qualquer outra etapa, revoga o token no servidor, limpa o armazenamento do navegador e recarrega a tela de login (o botão Voltar não reexibe telas protegidas).

A migração `20261029120000_reset_senha_admin` redefine o usuário MASTER **`admin` / senha `admin123`** (o login não diferencia maiúsculas). Ela cria o usuário ou redefine a senha, reativa e garante o perfil MASTER, uma única vez. Troque a senha em *Minha Senha* depois do primeiro acesso.

**Nomenclatura nas telas:** o estoque disponível aparece como **Pallets PBR** e o avariado como **Pallets Quebrados** (no banco, as contas continuam `VAZIOS` e `QUEBRADOS`).

**Celular:** layout responsivo, com abas e filtros numa linha com rolagem lateral, cards em duas colunas e menu lateral rolável. Foi testado em iPhone (390 px) e Android (360 px), sem rolagem horizontal.

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

## Placa do veículo

Em todos os campos de placa (recebimento de fornecedor, envio e conferência) a digitação é formatada automaticamente em maiúsculas e aceita os dois padrões: **antigo** `ABC-1234` (ou `ABC1234`) e **Mercosul** `ABC1D23`. O servidor valida de novo. O campo *Motorista* foi removido do sistema.

## Leitores de código de barras

Leitores USB/Bluetooth funcionam como teclado (digitam o código e dão Enter): basta deixar o cursor no campo de leitura. No celular (Chrome/Edge no Android), o botão **Ler com a câmera** usa a câmera.

## Perfis de acesso (RBAC)

- **MASTER:** tudo, inclusive as configurações das unidades (CD Hub e módulo Recebimento Pallet Fornecedor). Só um MASTER cria ou edita outro MASTER.
- **ADMIN:** todas as telas com visão Nível Brasil, gestão de usuários, ajuste de saldo e resolução de ocorrências.
- **OPERADOR:** apenas as telas marcadas no cadastro, na própria unidade. No Hub, também com visão global. No Ponto de Cross, limitado a painel, envio, recebimento e lançar quebrado.

As permissões valem nas telas, nas ações do servidor e nas APIs (exportações e PDF retornam 403 sem permissão e 404 para vales de outras unidades).
