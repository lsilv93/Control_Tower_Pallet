-- =====================================================================================
-- Control Tower Pallet · Torre de Controle Nível Brasil de pallets PBR
-- Estrutura do banco para MySQL 8.0 (InnoDB, utf8mb4). Tradução fiel do modelo anterior
-- (PostgreSQL/Prisma): mesmas tabelas, colunas, enums, índices, chaves e regras de exclusão.
--   * Datas/horas gravadas em UTC (DATETIME(3)); a aplicação exibe no fuso America/Sao_Paulo.
--   * Identificadores: texto (cuid) — compatíveis com os dados já existentes.
--   * Livro de movimentações e auditoria são imutáveis (gatilhos bloqueiam UPDATE/DELETE).
-- Uso: mysql -u usuario -p banco < database/schema.sql
-- =====================================================================================
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `CentroDistribuicao` (
  `id`                    VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `codigo`                VARCHAR(40)  NOT NULL,
  `nome`                  VARCHAR(191) NOT NULL,
  `tipo`                  ENUM('CD','CROSS') NOT NULL DEFAULT 'CD',
  `hub`                   TINYINT(1)   NOT NULL DEFAULT 0,
  `cnpj`                  VARCHAR(14)  NULL,
  `contato`               VARCHAR(191) NULL,
  `telefone`              VARCHAR(20)  NULL,
  `email`                 VARCHAR(191) NULL,
  `endereco`              VARCHAR(255) NULL,
  `cidade`                VARCHAR(120) NULL,
  `uf`                    CHAR(2)      NULL,
  `cep`                   VARCHAR(8)   NULL,
  `recebimentoFornecedor` TINYINT(1)   NOT NULL DEFAULT 0,
  `ativo`                 TINYINT(1)   NOT NULL DEFAULT 1,
  `criadoEm`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CentroDistribuicao_codigo_key` (`codigo`),
  UNIQUE KEY `CentroDistribuicao_cnpj_key` (`cnpj`),
  KEY `CentroDistribuicao_tipo_ativo_idx` (`tipo`, `ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Usuario` (
  `id`           VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `nome`         VARCHAR(191) NOT NULL,
  `login`        VARCHAR(64)  NOT NULL,
  `senhaHash`    VARCHAR(255) NOT NULL,
  `perfil`       ENUM('MASTER','ADMIN','OPERADOR') NOT NULL DEFAULT 'OPERADOR',
  `permissoes`   JSON         NOT NULL,
  `unidadeId`    VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `ativo`        TINYINT(1)   NOT NULL DEFAULT 1,
  `criadoEm`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizadoEm` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Usuario_login_key` (`login`),
  KEY `Usuario_unidadeId_idx` (`unidadeId`),
  CONSTRAINT `Usuario_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `UsuarioUnidade` (
  `usuarioId` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unidadeId` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `criadoEm`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`usuarioId`, `unidadeId`),
  KEY `UsuarioUnidade_unidadeId_idx` (`unidadeId`),
  CONSTRAINT `UsuarioUnidade_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `UsuarioUnidade_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `CrossCD` (
  `crossId`  VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `cdId`     VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `criadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`crossId`, `cdId`),
  KEY `CrossCD_cdId_idx` (`cdId`),
  CONSTRAINT `CrossCD_crossId_fkey` FOREIGN KEY (`crossId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `CrossCD_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Fornecedor` (
  `id`       VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `sigla`    VARCHAR(40)  NULL,
  `nome`     VARCHAR(191) NOT NULL,
  `cnpj`     VARCHAR(14)  NULL,
  `contato`  VARCHAR(191) NULL,
  `telefone` VARCHAR(20)  NULL,
  `email`    VARCHAR(191) NULL,
  `ativo`    TINYINT(1)   NOT NULL DEFAULT 1,
  `criadoEm` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Fornecedor_sigla_key` (`sigla`),
  UNIQUE KEY `Fornecedor_cnpj_key` (`cnpj`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Transportadora` (
  `id`       VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `nome`     VARCHAR(191) NOT NULL,
  `cnpj`     VARCHAR(14)  NOT NULL,
  `contato`  VARCHAR(191) NULL,
  `telefone` VARCHAR(20)  NULL,
  `email`    VARCHAR(191) NULL,
  `ativo`    TINYINT(1)   NOT NULL DEFAULT 1,
  `criadoEm` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `Transportadora_cnpj_key` (`cnpj`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Compra` (
  `id`           VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `cdId`         VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `chaveAcesso`  VARCHAR(44)  NOT NULL,
  `notaFiscal`   VARCHAR(20)  NOT NULL,
  `serie`        VARCHAR(5)   NOT NULL,
  `fornecedorId` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `quantidade`   INT          NOT NULL,
  `observacao`   TEXT         NULL,
  `criadoEm`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usuarioId`    VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Compra_chaveAcesso_key` (`chaveAcesso`),
  CONSTRAINT `Compra_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `Compra_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `Fornecedor` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `Compra_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Conferencia` (
  `id`                VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `numero`            INT          NOT NULL AUTO_INCREMENT,
  `cdId`              VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `remetenteId`       VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `totalDeclarado`    INT          NOT NULL,
  `recebidoBons`      INT          NOT NULL,
  `recebidoQuebrados` INT          NOT NULL,
  `diferenca`         INT          NOT NULL DEFAULT 0,
  `placa`             VARCHAR(10)  NULL,
  `transportadora`    VARCHAR(191) NULL,
  `observacao`        TEXT         NULL,
  `criadoEm`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usuarioId`         VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Conferencia_numero_key` (`numero`),
  KEY `Conferencia_cdId_criadoEm_idx` (`cdId`, `criadoEm`),
  KEY `Conferencia_remetenteId_criadoEm_idx` (`remetenteId`, `criadoEm`),
  CONSTRAINT `Conferencia_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `Conferencia_remetenteId_fkey` FOREIGN KEY (`remetenteId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `Conferencia_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `AgendaDevolucao` (
  `id`            VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `numero`        INT          NOT NULL AUTO_INCREMENT,
  `cdId`          VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `fornecedorId`  VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `dataPrevista`  DATETIME(3)  NOT NULL,
  `status`        ENUM('ABERTA','VALIDADA','CANCELADA') NOT NULL DEFAULT 'ABERTA',
  `observacao`    TEXT         NULL,
  `criadoEm`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `criadoPorId`   VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `validadoEm`    DATETIME(3)  NULL,
  `validadoPorId` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `canceladoEm`   DATETIME(3)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `AgendaDevolucao_numero_key` (`numero`),
  KEY `AgendaDevolucao_status_idx` (`status`),
  KEY `AgendaDevolucao_cdId_dataPrevista_idx` (`cdId`, `dataPrevista`),
  CONSTRAINT `AgendaDevolucao_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `AgendaDevolucao_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `Fornecedor` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `AgendaDevolucao_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `AgendaDevolucao_validadoPorId_fkey` FOREIGN KEY (`validadoPorId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `ValePallet` (
  `id`                     VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `numero`                 INT          NOT NULL AUTO_INCREMENT,
  `tipo`                   ENUM('ENVIO','OCORRENCIA','FORNECEDOR') NOT NULL,
  `ocorrencia`             ENUM('FALTA','SOBRA') NULL,
  `cdId`                   VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unidadeId`              VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `fornecedorId`           VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `quantidadeBons`         INT          NOT NULL DEFAULT 0,
  `quantidadeQuebrados`    INT          NOT NULL DEFAULT 0,
  `quantidade`             INT          NOT NULL,
  `transportadora`         VARCHAR(191) NULL,
  `placa`                  VARCHAR(10)  NULL,
  `rota`                   VARCHAR(60)  NULL,
  `dataFaturamento`        DATE         NULL,
  `notaFiscal`             VARCHAR(20)  NULL,
  `serieNf`                VARCHAR(5)   NULL,
  `chaveNfe`               VARCHAR(44)  NULL,
  `semNotaFiscal`          TINYINT(1)   NOT NULL DEFAULT 0,
  `consomeEstoque`         TINYINT(1)   NOT NULL DEFAULT 1,
  `conferente`             VARCHAR(191) NULL,
  `status`                 ENUM('PENDENTE','AGENDADO','FINALIZADO','CANCELADO') NOT NULL DEFAULT 'PENDENTE',
  `observacao`             TEXT         NULL,
  `criadoEm`               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `criadoPorId`            VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `agendaId`               VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `finalizadoEm`           DATETIME(3)  NULL,
  `conferenciaId`          VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `conferenciaOrigemId`    VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `aguardandoId`           VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `recusas`                INT          NOT NULL DEFAULT 0,
  `resolucao`              ENUM('ACEITA_REMETENTE','ACEITA_RECEBEDOR') NULL,
  `resolvidoEm`            DATETIME(3)  NULL,
  `resolvidoPorId`         VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `observacaoResolucao`    TEXT         NULL,
  `canceladoEm`            DATETIME(3)  NULL,
  `canceladoPorId`         VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `motivoCancelamento`     ENUM('FORNECEDOR_INCORRETO','TRANSPORTADORA_INCORRETA','QUANTIDADE_INCORRETA','DOCUMENTO_ERRADO','DESTINO_INCORRETO') NULL,
  `observacaoCancelamento` TEXT         NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ValePallet_numero_key` (`numero`),
  UNIQUE KEY `ValePallet_chaveNfe_key` (`chaveNfe`),
  KEY `ValePallet_status_idx` (`status`),
  KEY `ValePallet_cdId_tipo_status_idx` (`cdId`, `tipo`, `status`),
  KEY `ValePallet_unidadeId_tipo_status_idx` (`unidadeId`, `tipo`, `status`),
  KEY `ValePallet_fornecedorId_status_idx` (`fornecedorId`, `status`),
  KEY `ValePallet_aguardandoId_status_idx` (`aguardandoId`, `status`),
  CONSTRAINT `ValePallet_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `ValePallet_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `Fornecedor` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_criadoPorId_fkey` FOREIGN KEY (`criadoPorId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `ValePallet_canceladoPorId_fkey` FOREIGN KEY (`canceladoPorId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_resolvidoPorId_fkey` FOREIGN KEY (`resolvidoPorId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_aguardandoId_fkey` FOREIGN KEY (`aguardandoId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_agendaId_fkey` FOREIGN KEY (`agendaId`) REFERENCES `AgendaDevolucao` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_conferenciaId_fkey` FOREIGN KEY (`conferenciaId`) REFERENCES `Conferencia` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `ValePallet_conferenciaOrigemId_fkey` FOREIGN KEY (`conferenciaOrigemId`) REFERENCES `Conferencia` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `OcorrenciaInteracao` (
  `id`            VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `valeId`        VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `acao`          ENUM('ABERTURA','RECUSA','ACEITE') NOT NULL,
  `unidadeId`     VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `usuarioId`     VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `justificativa` TEXT        NULL,
  `criadoEm`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `OcorrenciaInteracao_valeId_criadoEm_idx` (`valeId`, `criadoEm`),
  CONSTRAINT `OcorrenciaInteracao_valeId_fkey` FOREIGN KEY (`valeId`) REFERENCES `ValePallet` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `OcorrenciaInteracao_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `OcorrenciaInteracao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Movimentacao` (
  `id`            VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `tipo`          ENUM('ENVIO','BAIXA_TRANSITO','RECEBIMENTO','FALTA','SOBRA','DIVERGENCIA_ENVIADO','DIVERGENCIA_RECEBIDO','OCORRENCIA_PERDA','ESTORNO_ENVIO','QUEBRA','RECUPERADO','CANIBALIZACAO','DESCARTE','INCLUSAO_MANUAL','REMOCAO_MANUAL','COMPRA','RECEBIMENTO_FORNECEDOR','DEVOLUCAO_FORNECEDOR','ESTORNO_VALE') NOT NULL,
  `quantidade`    INT         NOT NULL,
  `origem`        ENUM('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA','ENVIADO','RECEBIDO','SOBRA','PERDA','DESCARTE','AJUSTE','COMPRA','FORNECEDOR','CARGA','REMESSA_CROSS') NOT NULL,
  `destino`       ENUM('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA','ENVIADO','RECEBIDO','SOBRA','PERDA','DESCARTE','AJUSTE','COMPRA','FORNECEDOR','CARGA','REMESSA_CROSS') NOT NULL,
  `observacao`    TEXT        NULL,
  `motivo`        VARCHAR(60) NULL,
  `criadoEm`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usuarioId`     VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `cdId`          VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `unidadeId`     VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `fornecedorId`  VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `valeId`        VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `agendaId`      VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `compraId`      VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `conferenciaId` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`id`),
  KEY `Movimentacao_criadoEm_idx` (`criadoEm`),
  KEY `Movimentacao_tipo_criadoEm_idx` (`tipo`, `criadoEm`),
  KEY `Movimentacao_cdId_criadoEm_idx` (`cdId`, `criadoEm`),
  KEY `Movimentacao_cdId_origem_idx` (`cdId`, `origem`),
  KEY `Movimentacao_cdId_destino_idx` (`cdId`, `destino`),
  CONSTRAINT `Movimentacao_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `Movimentacao_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `Movimentacao_unidadeId_fkey` FOREIGN KEY (`unidadeId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `Movimentacao_fornecedorId_fkey` FOREIGN KEY (`fornecedorId`) REFERENCES `Fornecedor` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `Movimentacao_valeId_fkey` FOREIGN KEY (`valeId`) REFERENCES `ValePallet` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `Movimentacao_agendaId_fkey` FOREIGN KEY (`agendaId`) REFERENCES `AgendaDevolucao` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `Movimentacao_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `Compra` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `Movimentacao_conferenciaId_fkey` FOREIGN KEY (`conferenciaId`) REFERENCES `Conferencia` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `Auditoria` (
  `id`         VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `acao`       VARCHAR(80)  NOT NULL,
  `entidade`   VARCHAR(80)  NOT NULL,
  `entidadeId` VARCHAR(40)  NULL,
  `origem`     ENUM('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA','ENVIADO','RECEBIDO','SOBRA','PERDA','DESCARTE','AJUSTE','COMPRA','FORNECEDOR','CARGA','REMESSA_CROSS') NULL,
  `destino`    ENUM('VAZIOS','QUEBRADOS','TRANSITO','OCORRENCIA','ENVIADO','RECEBIDO','SOBRA','PERDA','DESCARTE','AJUSTE','COMPRA','FORNECEDOR','CARGA','REMESSA_CROSS') NULL,
  `quantidade` INT          NULL,
  `observacao` TEXT         NULL,
  `detalhes`   JSON         NULL,
  `criadoEm`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `usuarioId`  VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  `cdId`       VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NULL,
  PRIMARY KEY (`id`),
  KEY `Auditoria_criadoEm_idx` (`criadoEm`),
  KEY `Auditoria_acao_idx` (`acao`),
  KEY `Auditoria_usuarioId_idx` (`usuarioId`),
  KEY `Auditoria_cdId_criadoEm_idx` (`cdId`, `criadoEm`),
  CONSTRAINT `Auditoria_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `Usuario` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `Auditoria_cdId_fkey` FOREIGN KEY (`cdId`) REFERENCES `CentroDistribuicao` (`id`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `SessaoRevogada` (
  `jti`       VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `usuarioId` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `expiraEm`  DATETIME(3) NOT NULL,
  `criadoEm`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`jti`),
  KEY `SessaoRevogada_expiraEm_idx` (`expiraEm`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Versão da estrutura aplicada (substitui a tabela de migrações do Prisma).
CREATE TABLE IF NOT EXISTS `_versao_schema` (
  `versao`     VARCHAR(60) NOT NULL,
  `aplicadoEm` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`versao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO `_versao_schema` (`versao`) VALUES ('20261113120000_mysql_inicial');

-- =====================================================================================
-- Imutabilidade: o livro de movimentações e a trilha de auditoria não aceitam UPDATE nem
-- DELETE (TRUNCATE, usado apenas em limpezas autorizadas, não dispara gatilhos).
-- =====================================================================================
DROP TRIGGER IF EXISTS `movimentacao_imutavel_upd`;
DROP TRIGGER IF EXISTS `movimentacao_imutavel_del`;
DROP TRIGGER IF EXISTS `auditoria_imutavel_upd`;
DROP TRIGGER IF EXISTS `auditoria_imutavel_del`;
CREATE TRIGGER `movimentacao_imutavel_upd` BEFORE UPDATE ON `Movimentacao` FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro imutável: Movimentacao não pode ser alterado nem excluído.';
CREATE TRIGGER `movimentacao_imutavel_del` BEFORE DELETE ON `Movimentacao` FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro imutável: Movimentacao não pode ser alterado nem excluído.';
CREATE TRIGGER `auditoria_imutavel_upd` BEFORE UPDATE ON `Auditoria` FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro imutável: Auditoria não pode ser alterado nem excluído.';
CREATE TRIGGER `auditoria_imutavel_del` BEFORE DELETE ON `Auditoria` FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registro imutável: Auditoria não pode ser alterado nem excluído.';
