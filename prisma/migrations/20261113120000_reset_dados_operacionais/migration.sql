-- =====================================================================================
-- LIMPEZA DOS DADOS OPERACIONAIS (pedido de 13/11/2026)
--    Zera: saldos (livro de movimentações), vales-pallet gerados, enviados e recebidos,
--    conferências, ocorrências e seu histórico, quebrados, recuperados (conserto),
--    descartados, ajustes manuais, agendas de devolução, compras e a trilha de auditoria.
--    PRESERVA: usuários (e as unidades vinculadas a eles), fornecedores, transportadoras,
--    CDs, Pontos de Cross-Docking e seus vínculos com os CDs (CrossCD), além das sessões
--    encerradas (SessaoRevogada), para que tokens revogados não voltem a valer.
--    TRUNCATE não dispara os gatilhos de imutabilidade (que são de UPDATE/DELETE por linha)
--    e reinicia a numeração dos vales e conferências.
-- =====================================================================================
TRUNCATE TABLE
  "Movimentacao",
  "OcorrenciaInteracao",
  "Auditoria",
  "ValePallet",
  "Conferencia",
  "AgendaDevolucao",
  "Compra"
RESTART IDENTITY;

-- Marco na nova trilha de auditoria.
INSERT INTO "Auditoria" ("id", "acao", "entidade", "observacao", "criadoEm")
VALUES ('auditoria_reset_operacao_20261113', 'RESET_DADOS_OPERACAO', 'Sistema',
        'Dados operacionais zerados: mantidos usuários, fornecedores, transportadoras, CDs e Pontos de Cross.', now());
