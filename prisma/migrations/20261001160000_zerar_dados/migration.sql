-- ZERAR DADOS (execução única, solicitada pelo usuário em 01/10/2026 para iniciar
-- o uso do sistema do zero). Apaga todos os dados operacionais e cadastros e
-- reinicia a numeração de vales (VP-000001) e agendas (AG-00001).
-- Mantém apenas as contas de usuário (logins, perfis e permissões).
--
-- Observação: TRUNCATE não dispara os gatilhos de linha que tornam
-- Movimentacao/Auditoria imutáveis; por isso a limpeza é feita aqui, uma única vez.
TRUNCATE TABLE
  "Movimentacao",
  "Auditoria",
  "Compra",
  "ValePallet",
  "AgendaDevolucao",
  "Fornecedor",
  "Transportadora",
  "CentroDistribuicao",
  "SessaoRevogada"
RESTART IDENTITY;
