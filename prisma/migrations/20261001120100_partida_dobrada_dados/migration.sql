-- Partida dobrada (2/2): converte o histórico sem perder nenhuma quantidade.
-- Mapeamento por tipo (regras novas):
--   ENVIO_CD                VAZIOS     -> CD
--   RECEBIMENTO_CD          CD         -> VAZIOS
--   RECEBIMENTO_FORNECEDOR  FORNECEDOR -> CD          (vale-pallet soma no CD)
--   DEVOLUCAO_FORNECEDOR    VAZIOS     -> FORNECEDOR  (baixa sai dos vazios)
--   ESTORNO_VALE            CD         -> FORNECEDOR  (exclusão do vale sai do CD)
--   QUEBRA                  VAZIOS     -> QUEBRADOS
--   RECUPERADO (conserto)   QUEBRADOS  -> VAZIOS
--   DESCARTE                QUEBRADOS  -> DESCARTE    (no modelo antigo só havia descarte de avariados)
--   COMPRA                  COMPRA     -> VAZIOS
--   AJUSTE_ENTRADA          AJUSTE     -> VAZIOS
--   AJUSTE_SAIDA            VAZIOS     -> AJUSTE
UPDATE "Movimentacao" SET "origem" = CASE "tipo"
    WHEN 'ENVIO_CD' THEN 'VAZIOS' WHEN 'RECEBIMENTO_CD' THEN 'CD'
    WHEN 'RECEBIMENTO_FORNECEDOR' THEN 'FORNECEDOR' WHEN 'DEVOLUCAO_FORNECEDOR' THEN 'VAZIOS'
    WHEN 'ESTORNO_VALE' THEN 'CD' WHEN 'QUEBRA' THEN 'VAZIOS' WHEN 'RECUPERADO' THEN 'QUEBRADOS'
    WHEN 'DESCARTE' THEN 'QUEBRADOS' WHEN 'COMPRA' THEN 'COMPRA'
    WHEN 'AJUSTE_ENTRADA' THEN 'AJUSTE' WHEN 'AJUSTE_SAIDA' THEN 'VAZIOS' END::"Conta",
  "destino" = CASE "tipo"
    WHEN 'ENVIO_CD' THEN 'CD' WHEN 'RECEBIMENTO_CD' THEN 'VAZIOS'
    WHEN 'RECEBIMENTO_FORNECEDOR' THEN 'CD' WHEN 'DEVOLUCAO_FORNECEDOR' THEN 'FORNECEDOR'
    WHEN 'ESTORNO_VALE' THEN 'FORNECEDOR' WHEN 'QUEBRA' THEN 'QUEBRADOS' WHEN 'RECUPERADO' THEN 'VAZIOS'
    WHEN 'DESCARTE' THEN 'DESCARTE' WHEN 'COMPRA' THEN 'VAZIOS'
    WHEN 'AJUSTE_ENTRADA' THEN 'VAZIOS' WHEN 'AJUSTE_SAIDA' THEN 'AJUSTE' END::"Conta";

-- Verificação linha a linha contra os saldos antigos. Qualquer divergência aborta a migração.
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT count(*) INTO n FROM "Movimentacao" WHERE "origem" IS NULL OR "destino" IS NULL OR "origem" = "destino";
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % movimentação(ões) sem origem/destino válidos', n; END IF;

  -- Avariados (modelo antigo) = Quebrados (modelo novo), linha a linha.
  SELECT count(*) INTO n FROM "Movimentacao"
   WHERE "deltaAvaria" <> (CASE WHEN "destino" = 'QUEBRADOS' THEN "quantidade" ELSE 0 END)
                        - (CASE WHEN "origem"  = 'QUEBRADOS' THEN "quantidade" ELSE 0 END);
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % linha(s) divergem no estoque de quebrados', n; END IF;

  -- Pulmão antigo = Vazios + CD (o CD era externo só nas transferências ENVIO_CD/RECEBIMENTO_CD).
  SELECT count(*) INTO n FROM "Movimentacao"
   WHERE "deltaPulmao" <>
         (CASE WHEN "destino" = 'VAZIOS' THEN "quantidade" ELSE 0 END) - (CASE WHEN "origem" = 'VAZIOS' THEN "quantidade" ELSE 0 END)
       + (CASE WHEN "tipo" IN ('ENVIO_CD', 'RECEBIMENTO_CD') THEN 0 ELSE
           (CASE WHEN "destino" = 'CD' THEN "quantidade" ELSE 0 END) - (CASE WHEN "origem" = 'CD' THEN "quantidade" ELSE 0 END) END);
  IF n > 0 THEN RAISE EXCEPTION 'Migração abortada: % linha(s) divergem no pulmão', n; END IF;
END $$;

ALTER TABLE "Movimentacao" ALTER COLUMN "origem" SET NOT NULL;
ALTER TABLE "Movimentacao" ALTER COLUMN "destino" SET NOT NULL;
ALTER TABLE "Movimentacao" DROP COLUMN "deltaPulmao";
ALTER TABLE "Movimentacao" DROP COLUMN "deltaAvaria";
CREATE INDEX "Movimentacao_origem_idx" ON "Movimentacao"("origem");
CREATE INDEX "Movimentacao_destino_idx" ON "Movimentacao"("destino");

-- Usuários: administradores existentes já faziam ajuste de inventário -> viram MASTER.
-- Operadores recebem as permissões equivalentes ao acesso que já tinham.
UPDATE "Usuario" SET "perfil" = 'MASTER' WHERE "perfil" = 'ADMIN';
UPDATE "Usuario" SET "permissoes" =
  ARRAY['dashboard','cd','entrada','vales','agendas','excluir_vale','avarias','relatorios','cadastros']
  || CASE WHEN "podeAdicionarPallets" THEN ARRAY['compras'] ELSE ARRAY[]::TEXT[] END
WHERE "perfil" = 'OPERADOR';
ALTER TABLE "Usuario" DROP COLUMN "podeAdicionarPallets";

-- Auditoria antiga das movimentações ganha origem/destino/quantidade/observação.
UPDATE "Auditoria" a SET "origem" = m."origem", "destino" = m."destino", "quantidade" = m."quantidade", "observacao" = m."observacao"
FROM "Movimentacao" m WHERE a."entidade" = 'Movimentacao' AND a."entidadeId" = m."id";

-- Log imutável: lançamentos e auditoria não podem ser alterados nem apagados.
CREATE OR REPLACE FUNCTION bloquear_alteracao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável: % não permite %', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_imutavel BEFORE UPDATE OR DELETE ON "Auditoria"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
CREATE TRIGGER movimentacao_imutavel BEFORE UPDATE OR DELETE ON "Movimentacao"
  FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao();
