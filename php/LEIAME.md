# Control Tower Pallet — versão PHP 8.4 + MySQL 8

Migração completa da aplicação Next.js/TypeScript/PostgreSQL para **PHP puro** (sem framework e sem
Composer) e **MySQL 8.0**, com as mesmas regras de negócio, telas (HTML/CSS e classes), fluxos e
mensagens. O front-end é HTML5 + CSS3 + JavaScript puro.

## Estrutura

```
php/
├── public/              raiz web (DocumentRoot)
│   ├── index.php        front controller (páginas, APIs e ações POST /acao/{grupo}/{nome})
│   ├── .htaccess        reescrita para Apache
│   └── assets/          CSS gerado, JavaScript (app, telas, gráficos, TV) e ícones
├── app/
│   ├── bootstrap.php    carrega .env, núcleo, bibliotecas e componentes
│   ├── rotas.php        mapa de páginas, APIs e ações
│   ├── Core/            Db (PDO MySQL, transações, bloqueio da conta corrente), Http, View
│   ├── Lib/             regras de negócio (conta corrente, permissões, faróis, NF-e, sessão,
│   │                    consultas, TV, documento do vale, PDF, Excel, código de barras)
│   ├── Actions/         ações dos formulários (cadastros, envio, conferência, ocorrências,
│   │                    vales, avarias, compras, fornecedor, autenticação)
│   ├── Api/             TV (versão), PDF do vale, exportações Excel/CSV/PDF
│   └── Views/           layout, menu, componentes e uma página por tela (Views/paginas)
├── database/
│   ├── schema.sql       schema MySQL 8 (tabelas, chaves, índices e gatilhos de imutabilidade)
│   ├── seed.php         CD Hub CDJC + usuário MASTER
│   └── demo.php         dados de demonstração (opcional)
├── scripts/             migração PostgreSQL → MySQL e ferramentas de desenvolvimento
├── tests/               testes ponta a ponta (Playwright)
├── api/index.php        entrada para a Vercel
└── vercel.json          configuração da Vercel (runtime vercel-php, PHP 8.4)
```

Equivalências principais:

| Next.js / Prisma | PHP / MySQL |
|---|---|
| Server Actions | `POST /acao/{grupo}/{nome}` → `acao_{grupo}_{nome}()` em `app/Actions` |
| Componentes React (cliente) | `public/assets/app.js`, `telas.js`, `graficos.js`, `tv.js` |
| Prisma Client | `Db` (PDO, sempre com *prepared statements*) |
| `pg_advisory_xact_lock` | `GET_LOCK('ctp_conta_corrente')` dentro da transação |
| Gatilhos de imutabilidade (PL/pgSQL) | Gatilhos MySQL `BEFORE UPDATE/DELETE` (SIGNAL 45000) |
| Sessão JWT (jose) | JWT HS256 próprio (`app/Lib/sessao.php`), mesmo cookie `ctp_session` |
| pdfkit / bwip-js | Gerador PDF próprio (`app/Lib/pdf.php`) e Code 128 vetorial |
| ExcelJS | Gerador XLSX próprio (`app/Lib/xlsx.php`) |
| Tailwind (build do Next) | CSS já compilado em `public/assets/app.css` |

As senhas existentes (bcrypt `$2b$`) continuam válidas: o PHP as verifica com `password_verify`.

## Requisitos

- PHP **8.4** com as extensões `pdo_mysql`, `mbstring`, `iconv`, `zlib`, `openssl`, `json`
  (todas padrão). Funciona também no 8.3.
- MySQL **8.0** (ou compatível), `utf8mb4`.

## Instalação (servidor próprio / hospedagem PHP)

1. Crie o banco e aplique o schema:
   ```sh
   mysql -u root -p -e "CREATE DATABASE pallet CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
   mysql -u root -p pallet < database/schema.sql
   ```
2. Configure as variáveis: copie `.env.example` para `.env` e preencha `DATABASE_URL` (ou `DB_*`) e
   `AUTH_SECRET` (gere com `php -r "echo bin2hex(random_bytes(32));"`).
3. Crie o CD Hub e o usuário MASTER: `php database/seed.php` (opcional: `php database/demo.php`).
4. Aponte o servidor web para a pasta `public/`:
   - **Apache**: `DocumentRoot .../php/public` com `AllowOverride All` (o `.htaccess` já reescreve).
   - **Nginx**:
     ```nginx
     root /caminho/php/public;
     location /assets/ { try_files $uri =404; expires 1y; }
     location / { try_files $uri /index.php$is_args$args; }
     location = /index.php { include fastcgi_params; fastcgi_param SCRIPT_FILENAME $document_root/index.php; fastcgi_pass unix:/run/php/php8.4-fpm.sock; }
     ```
   - **Desenvolvimento**: `php -S 127.0.0.1:3200 -t public public/index.php`
5. Acesse com `admin` / `admin123` e altere a senha em **Minha Senha**.

## Deploy na Vercel

A Vercel não tem runtime PHP oficial; usa-se o runtime comunitário **vercel-php@0.8.0** (PHP 8.4,
com `pdo_mysql`). O banco MySQL precisa ser externo (ex.: Aiven, PlanetScale, AWS RDS, Azure,
DigitalOcean, TiDB Cloud) — a Vercel não oferece MySQL.

1. Crie o banco MySQL e aplique `database/schema.sql` e `php database/seed.php` (com as variáveis
   apontando para ele).
2. Na Vercel, crie um projeto a partir do repositório com **Root Directory = `php`**
   (Framework Preset: *Other*; sem comando de build).
3. Cadastre as variáveis de ambiente `DATABASE_URL` (mysql://...) e `AUTH_SECRET`; se o provedor exigir
   TLS, `DB_SSL_CA=/etc/pki/tls/certs/ca-bundle.crt`.
4. Faça o deploy. O `vercel.json` encaminha `/assets/*` para os arquivos estáticos e todo o resto para
   `api/index.php`.

## Migração dos dados do PostgreSQL

Copia todas as tabelas (mesmos IDs, números de vale/agenda/conferência, datas em UTC, senhas) e, ao
final, confere a contagem de linhas e os saldos por unidade/conta nos dois bancos:

```sh
ORIGEM_URL="postgresql://usuario:senha@host:5432/banco?sslmode=require" \
DATABASE_URL="mysql://usuario:senha@host:3306/pallet" \
php scripts/migrar-postgres.php --simular   # confere sem gravar
php scripts/migrar-postgres.php             # grava (destino vazio; --apagar substitui os dados)
```

Requer `pdo_pgsql` na máquina que executa o script. Rode com o sistema antigo parado (ou em modo
somente leitura) para não perder lançamentos feitos durante a cópia.

## Testes

Com o servidor PHP rodando em `:3200` sobre um banco recém-criado (`schema.sql` + `seed.php` + `demo.php`):

```sh
node tests/e2e.mjs                # 31 etapas: fluxos de envio, conferência, ocorrências, TV, permissões
node tests/e2e-complementar.mjs   # 12 etapas: compra, fornecedor, agenda, exclusão, relatórios, exportações
```

Variáveis: `BASE_URL`, `DB_USER`, `DB_PASS`, `DB_NAME`, `PLAYWRIGHT` (caminho do módulo, se necessário).

## Desenvolvimento do visual

O CSS é gerado pelo Tailwind a partir de `assets-src/app.css` e `tailwind.config.js` (só em
desenvolvimento; o servidor não precisa de Node):

```sh
bash scripts/gerar-css.sh          # recompila public/assets/app.css
node scripts/gerar-icones.mjs      # atualiza os ícones (lucide) usados nas telas
```
