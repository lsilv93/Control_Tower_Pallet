-- Multi-CD (2/2): migra os dados existentes sem perder nenhuma quantidade.
--
-- 1. Cria o "CD Principal" (código PRINCIPAL) quando há dados operacionais (ou nenhuma
--    unidade cadastrada) e vincula a ele todo o histórico: movimentações, vales, agendas
--    e compras. Renomeie-o em Cadastros > CDs.
-- 2. Operadores existentes passam a operar no CD Principal (administradores operam
--    qualquer CD).
-- 3. Transferências antigas para CDs (Vazios → CD) ainda não retornadas viram saldo
--    devedor do respectivo CD destino: um vale de ajuste "Saldo migrado" por CD, que
--    poderá ser baixado na conferência de retorno.
-- Saldos de Vazios, Quebrados e vales de fornecedor ficam exatamente como estavam.
DO $$
DECLARE
  principal TEXT;
  autor TEXT;
  r RECORD;
  vale_id TEXT;
  mov_id TEXT;
  migrados INTEGER := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM "Movimentacao") OR EXISTS (SELECT 1 FROM "ValePallet")
     OR EXISTS (SELECT 1 FROM "AgendaDevolucao") OR EXISTS (SELECT 1 FROM "Compra")
     OR NOT EXISTS (SELECT 1 FROM "CentroDistribuicao") THEN
    SELECT id INTO principal FROM "CentroDistribuicao" WHERE codigo = 'PRINCIPAL';
    IF principal IS NULL THEN
      principal := 'cd_principal';
      INSERT INTO "CentroDistribuicao" (id, codigo, nome, tipo, ativo, "criadoEm")
      VALUES (principal, 'PRINCIPAL', 'CD Principal', 'CD', true, CURRENT_TIMESTAMP);
    ELSE
      UPDATE "CentroDistribuicao" SET tipo = 'CD', ativo = true WHERE id = principal;
    END IF;
  END IF;

  IF principal IS NULL THEN
    RETURN;
  END IF;

  -- Histórico imutável: o gatilho é desligado só durante o preenchimento do novo campo.
  ALTER TABLE "Movimentacao" DISABLE TRIGGER movimentacao_imutavel;
  UPDATE "Movimentacao" SET "cdId" = principal WHERE "cdId" IS NULL;
  ALTER TABLE "Movimentacao" ENABLE TRIGGER movimentacao_imutavel;

  UPDATE "ValePallet" SET "cdId" = principal WHERE "cdId" IS NULL;
  UPDATE "AgendaDevolucao" SET "cdId" = principal WHERE "cdId" IS NULL;
  UPDATE "Compra" SET "cdId" = principal WHERE "cdId" IS NULL;

  INSERT INTO "_UsuarioCDs" ("A", "B")
  SELECT principal, id FROM "Usuario" WHERE perfil = 'OPERADOR'
  ON CONFLICT DO NOTHING;

  SELECT id INTO autor FROM "Usuario" ORDER BY (perfil = 'MASTER') DESC, "criadoEm" ASC LIMIT 1;
  IF autor IS NOT NULL THEN
    FOR r IN
      SELECT "unidadeId" AS unidade,
             SUM(CASE WHEN tipo = 'ENVIO_CD' THEN quantidade ELSE -quantidade END)::INTEGER AS saldo
        FROM "Movimentacao"
       WHERE tipo IN ('ENVIO_CD', 'RECEBIMENTO_CD') AND "unidadeId" IS NOT NULL AND "unidadeId" <> principal
       GROUP BY "unidadeId"
      HAVING SUM(CASE WHEN tipo = 'ENVIO_CD' THEN quantidade ELSE -quantidade END) > 0
    LOOP
      vale_id := 'migr_vale_' || r.unidade;
      mov_id := 'migr_mov_' || r.unidade;
      INSERT INTO "ValePallet" (id, tipo, "cdId", "unidadeId", quantidade, status, observacao, "criadoEm", "criadoPorId")
      VALUES (vale_id, 'AJUSTE', principal, r.unidade, r.saldo, 'PENDENTE',
              'Saldo migrado: transferências para este CD anteriores ao multi-CD ainda não retornadas.',
              CURRENT_TIMESTAMP, autor);
      INSERT INTO "Movimentacao" (id, tipo, quantidade, origem, destino, observacao, "criadoEm", "usuarioId", "cdId", "unidadeId", "valeId")
      VALUES (mov_id, 'MIGRACAO_CUSTODIA', r.saldo, 'CD', 'CUSTODIA',
              'Migração multi-CD: transferências antigas não retornadas viram saldo devedor',
              CURRENT_TIMESTAMP, autor, principal, r.unidade, vale_id);
      INSERT INTO "Auditoria" (id, acao, entidade, "entidadeId", "usuarioId", origem, destino, quantidade, observacao, "cdId", "criadoEm")
      VALUES ('migr_aud_' || r.unidade, 'MOVIMENTACAO_MIGRACAO_CUSTODIA', 'Movimentacao', mov_id, autor, 'CD', 'CUSTODIA', r.saldo,
              'Migração multi-CD: transferências antigas não retornadas viram saldo devedor', principal, CURRENT_TIMESTAMP);
      migrados := migrados + 1;
    END LOOP;

    INSERT INTO "Auditoria" (id, acao, entidade, "entidadeId", "usuarioId", observacao, detalhes, "cdId", "criadoEm")
    VALUES ('migr_aud_multi_cd', 'MIGRACAO_MULTI_CD', 'CentroDistribuicao', principal, autor,
            'Histórico vinculado ao CD Principal na implantação do multi-CD',
            jsonb_build_object('saldosDevedoresMigrados', migrados), principal, CURRENT_TIMESTAMP);
  END IF;
END $$;

ALTER TABLE "Movimentacao" ALTER COLUMN "cdId" SET NOT NULL;
ALTER TABLE "ValePallet" ALTER COLUMN "cdId" SET NOT NULL;
ALTER TABLE "AgendaDevolucao" ALTER COLUMN "cdId" SET NOT NULL;
ALTER TABLE "Compra" ALTER COLUMN "cdId" SET NOT NULL;
