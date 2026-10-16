-- Envio para Ponto de Cross: rota (texto livre) e data de faturamento (opcionais).
ALTER TABLE "ValePallet" ADD COLUMN IF NOT EXISTS "rota" TEXT;
ALTER TABLE "ValePallet" ADD COLUMN IF NOT EXISTS "dataFaturamento" DATE;

-- Campo "Motorista" removido do sistema (telas, ações, vales, conferências e relatórios).
-- As colunas antigas "motorista" ficam sem uso no banco (não são lidas nem gravadas):
-- assim um deploy de teste (Preview) que compartilhe o banco não quebra a versão em
-- produção durante a transição. Podem ser apagadas numa migração futura.
