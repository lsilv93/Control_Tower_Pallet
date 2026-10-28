-- Zera 100% dos dados (cadastros, usuários, vales, conferências, movimentações e auditoria)
-- para iniciar os testes com o banco limpo. O schema, os gatilhos de imutabilidade e o
-- histórico de migrações são mantidos. Em seguida o seed recria o CD Hub CDJC e o MASTER.
-- TRUNCATE não dispara os gatilhos de linha (BEFORE UPDATE OR DELETE) do livro e da auditoria.
TRUNCATE TABLE
  "Movimentacao",
  "Auditoria",
  "ValePallet",
  "Conferencia",
  "AgendaDevolucao",
  "Compra",
  "SessaoRevogada",
  "Usuario",
  "Fornecedor",
  "Transportadora",
  "CentroDistribuicao"
RESTART IDENTITY CASCADE;
