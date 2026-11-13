# Banco de dados · Control Tower Pallet (PostgreSQL)

| Arquivo | Conteúdo |
|---|---|
| `control_tower_pallet.sql` | Estrutura completa (15 tabelas, enums, índices, chaves, triggers de imutabilidade) **+ dados iniciais** + histórico das 19 migrações (`_prisma_migrations`). |
| `control_tower_pallet_schema.sql` | Somente a estrutura, sem nenhum dado. |

Dados iniciais incluídos no `control_tower_pallet.sql`:

- **CDJC** – CD Jacareí (Hub Nível Brasil), CNPJ 59.568.428/0011-50, Rua Harold Barnsley Holland, 2130, Galpão B, Sala 01, Rio Abaixo · Jacareí/SP · CEP 12334-403.
- Usuário **MASTER** `admin`, senha `admin123` (troque em *Minha Senha* após o primeiro acesso).
- Movimentações, vales, conferências e ocorrências: zerados.

## Como subir no servidor oficial

PostgreSQL 14 ou superior, banco **vazio**:

```bash
createdb control_tower_pallet
psql "postgresql://usuario:senha@servidor:5432/control_tower_pallet" -v ON_ERROR_STOP=1 -f database/control_tower_pallet.sql
```

Depois aponte a aplicação para esse banco (`DATABASE_URL` e `DATABASE_URL_UNPOOLED`). Como a tabela
`_prisma_migrations` já vem preenchida, o `prisma migrate deploy` do build reconhece o banco como
atualizado e aplica só as migrações futuras.

Alternativa sem o arquivo SQL: com o banco vazio, `npx prisma migrate deploy && npx prisma db seed`
gera exatamente a mesma estrutura e os mesmos dados iniciais.

## Exportar os valores atuais de um banco em uso (ex.: produção da Vercel)

```bash
DATABASE_URL="postgresql://usuario:senha@host:5432/banco" bash scripts/exportar-banco.sh database
```

Gera os dois arquivos acima com **todos os dados atuais** daquele banco (usuários, CDs, Cross,
transportadoras, fornecedores, vales e movimentações), prontos para importar no servidor oficial
com o mesmo comando `psql`. Requer o `pg_dump` (cliente PostgreSQL) na mesma versão principal do
servidor de origem ou superior.
