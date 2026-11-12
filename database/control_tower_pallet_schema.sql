--
-- PostgreSQL database dump
--

\restrict RCcYcobMNbVMs9rMresSawueoTxVhwft6ykNTTlohiDc0YvllEhCDIGyx9BnPVz

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: AcaoOcorrencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."AcaoOcorrencia" AS ENUM (
    'ABERTURA',
    'RECUSA',
    'ACEITE'
);


--
-- Name: Conta; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Conta" AS ENUM (
    'VAZIOS',
    'QUEBRADOS',
    'TRANSITO',
    'OCORRENCIA',
    'ENVIADO',
    'RECEBIDO',
    'SOBRA',
    'PERDA',
    'DESCARTE',
    'AJUSTE',
    'COMPRA',
    'FORNECEDOR',
    'CARGA',
    'REMESSA_CROSS'
);


--
-- Name: MotivoCancelamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MotivoCancelamento" AS ENUM (
    'FORNECEDOR_INCORRETO',
    'TRANSPORTADORA_INCORRETA',
    'QUANTIDADE_INCORRETA',
    'DOCUMENTO_ERRADO',
    'DESTINO_INCORRETO'
);


--
-- Name: Perfil; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Perfil" AS ENUM (
    'MASTER',
    'ADMIN',
    'OPERADOR'
);


--
-- Name: ResolucaoOcorrencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ResolucaoOcorrencia" AS ENUM (
    'ACEITA_REMETENTE',
    'ACEITA_RECEBEDOR'
);


--
-- Name: StatusAgenda; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusAgenda" AS ENUM (
    'ABERTA',
    'VALIDADA',
    'CANCELADA'
);


--
-- Name: StatusVale; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusVale" AS ENUM (
    'PENDENTE',
    'AGENDADO',
    'FINALIZADO',
    'CANCELADO'
);


--
-- Name: TipoMovimentacao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoMovimentacao" AS ENUM (
    'ENVIO',
    'BAIXA_TRANSITO',
    'RECEBIMENTO',
    'FALTA',
    'SOBRA',
    'DIVERGENCIA_ENVIADO',
    'DIVERGENCIA_RECEBIDO',
    'OCORRENCIA_PERDA',
    'ESTORNO_ENVIO',
    'QUEBRA',
    'RECUPERADO',
    'CANIBALIZACAO',
    'DESCARTE',
    'INCLUSAO_MANUAL',
    'REMOCAO_MANUAL',
    'COMPRA',
    'RECEBIMENTO_FORNECEDOR',
    'DEVOLUCAO_FORNECEDOR',
    'ESTORNO_VALE'
);


--
-- Name: TipoOcorrencia; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoOcorrencia" AS ENUM (
    'FALTA',
    'SOBRA'
);


--
-- Name: TipoUnidade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoUnidade" AS ENUM (
    'CD',
    'CROSS'
);


--
-- Name: TipoVale; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoVale" AS ENUM (
    'ENVIO',
    'OCORRENCIA',
    'FORNECEDOR'
);


--
-- Name: bloquear_alteracao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bloquear_alteracao() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Registro imutável: % não pode ser alterado nem excluído.', TG_TABLE_NAME;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AgendaDevolucao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AgendaDevolucao" (
    id text NOT NULL,
    numero integer NOT NULL,
    "cdId" text NOT NULL,
    "fornecedorId" text NOT NULL,
    "dataPrevista" timestamp(3) without time zone NOT NULL,
    status public."StatusAgenda" DEFAULT 'ABERTA'::public."StatusAgenda" NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" text NOT NULL,
    "validadoEm" timestamp(3) without time zone,
    "validadoPorId" text,
    "canceladoEm" timestamp(3) without time zone
);


--
-- Name: AgendaDevolucao_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."AgendaDevolucao_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: AgendaDevolucao_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."AgendaDevolucao_numero_seq" OWNED BY public."AgendaDevolucao".numero;


--
-- Name: Auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Auditoria" (
    id text NOT NULL,
    acao text NOT NULL,
    entidade text NOT NULL,
    "entidadeId" text,
    origem public."Conta",
    destino public."Conta",
    quantidade integer,
    observacao text,
    detalhes jsonb,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usuarioId" text,
    "cdId" text
);


--
-- Name: CentroDistribuicao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CentroDistribuicao" (
    id text NOT NULL,
    codigo text NOT NULL,
    nome text NOT NULL,
    tipo public."TipoUnidade" DEFAULT 'CD'::public."TipoUnidade" NOT NULL,
    hub boolean DEFAULT false NOT NULL,
    cnpj text,
    contato text,
    telefone text,
    email text,
    "recebimentoFornecedor" boolean DEFAULT false NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cep text,
    cidade text,
    endereco text,
    uf text
);


--
-- Name: Compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Compra" (
    id text NOT NULL,
    "cdId" text NOT NULL,
    "chaveAcesso" text NOT NULL,
    "notaFiscal" text NOT NULL,
    serie text NOT NULL,
    "fornecedorId" text NOT NULL,
    quantidade integer NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usuarioId" text NOT NULL
);


--
-- Name: Conferencia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Conferencia" (
    id text NOT NULL,
    numero integer NOT NULL,
    "cdId" text NOT NULL,
    "remetenteId" text NOT NULL,
    "totalDeclarado" integer NOT NULL,
    "recebidoBons" integer NOT NULL,
    "recebidoQuebrados" integer NOT NULL,
    diferenca integer DEFAULT 0 NOT NULL,
    placa text,
    transportadora text,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usuarioId" text NOT NULL
);


--
-- Name: Conferencia_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."Conferencia_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: Conferencia_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."Conferencia_numero_seq" OWNED BY public."Conferencia".numero;


--
-- Name: CrossCD; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CrossCD" (
    "crossId" text NOT NULL,
    "cdId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Fornecedor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Fornecedor" (
    id text NOT NULL,
    nome text NOT NULL,
    cnpj text,
    contato text,
    telefone text,
    email text,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sigla text
);


--
-- Name: Movimentacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Movimentacao" (
    id text NOT NULL,
    tipo public."TipoMovimentacao" NOT NULL,
    quantidade integer NOT NULL,
    origem public."Conta" NOT NULL,
    destino public."Conta" NOT NULL,
    observacao text,
    motivo text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "usuarioId" text NOT NULL,
    "cdId" text NOT NULL,
    "unidadeId" text,
    "fornecedorId" text,
    "valeId" text,
    "agendaId" text,
    "compraId" text,
    "conferenciaId" text,
    CONSTRAINT "Movimentacao_quantidade_positiva" CHECK ((quantidade > 0))
);


--
-- Name: OcorrenciaInteracao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OcorrenciaInteracao" (
    id text NOT NULL,
    "valeId" text NOT NULL,
    acao public."AcaoOcorrencia" NOT NULL,
    "unidadeId" text NOT NULL,
    "usuarioId" text NOT NULL,
    justificativa text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: SessaoRevogada; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SessaoRevogada" (
    jti text NOT NULL,
    "usuarioId" text NOT NULL,
    "expiraEm" timestamp(3) without time zone NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Transportadora; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Transportadora" (
    id text NOT NULL,
    nome text NOT NULL,
    cnpj text NOT NULL,
    contato text,
    telefone text,
    email text,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Usuario" (
    id text NOT NULL,
    nome text NOT NULL,
    login text NOT NULL,
    "senhaHash" text NOT NULL,
    perfil public."Perfil" DEFAULT 'OPERADOR'::public."Perfil" NOT NULL,
    permissoes text[] DEFAULT ARRAY[]::text[],
    "unidadeId" text NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: UsuarioUnidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."UsuarioUnidade" (
    "usuarioId" text NOT NULL,
    "unidadeId" text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ValePallet; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ValePallet" (
    id text NOT NULL,
    numero integer NOT NULL,
    tipo public."TipoVale" NOT NULL,
    ocorrencia public."TipoOcorrencia",
    "cdId" text NOT NULL,
    "unidadeId" text,
    "fornecedorId" text,
    "quantidadeBons" integer DEFAULT 0 NOT NULL,
    "quantidadeQuebrados" integer DEFAULT 0 NOT NULL,
    quantidade integer NOT NULL,
    transportadora text,
    placa text,
    rota text,
    "dataFaturamento" date,
    "notaFiscal" text,
    "serieNf" text,
    "chaveNfe" text,
    "semNotaFiscal" boolean DEFAULT false NOT NULL,
    conferente text,
    status public."StatusVale" DEFAULT 'PENDENTE'::public."StatusVale" NOT NULL,
    observacao text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "criadoPorId" text NOT NULL,
    "agendaId" text,
    "finalizadoEm" timestamp(3) without time zone,
    "conferenciaId" text,
    "conferenciaOrigemId" text,
    resolucao public."ResolucaoOcorrencia",
    "resolvidoEm" timestamp(3) without time zone,
    "resolvidoPorId" text,
    "observacaoResolucao" text,
    "canceladoEm" timestamp(3) without time zone,
    "canceladoPorId" text,
    "motivoCancelamento" public."MotivoCancelamento",
    "observacaoCancelamento" text,
    "aguardandoId" text,
    recusas integer DEFAULT 0 NOT NULL,
    "consomeEstoque" boolean DEFAULT true NOT NULL,
    CONSTRAINT "ValePallet_quantidades_validas" CHECK ((("quantidadeBons" >= 0) AND ("quantidadeQuebrados" >= 0) AND (quantidade >= 0)))
);


--
-- Name: ValePallet_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."ValePallet_numero_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ValePallet_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."ValePallet_numero_seq" OWNED BY public."ValePallet".numero;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: AgendaDevolucao numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgendaDevolucao" ALTER COLUMN numero SET DEFAULT nextval('public."AgendaDevolucao_numero_seq"'::regclass);


--
-- Name: Conferencia numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conferencia" ALTER COLUMN numero SET DEFAULT nextval('public."Conferencia_numero_seq"'::regclass);


--
-- Name: ValePallet numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet" ALTER COLUMN numero SET DEFAULT nextval('public."ValePallet_numero_seq"'::regclass);


--
-- Name: AgendaDevolucao AgendaDevolucao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgendaDevolucao"
    ADD CONSTRAINT "AgendaDevolucao_pkey" PRIMARY KEY (id);


--
-- Name: Auditoria Auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_pkey" PRIMARY KEY (id);


--
-- Name: CentroDistribuicao CentroDistribuicao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CentroDistribuicao"
    ADD CONSTRAINT "CentroDistribuicao_pkey" PRIMARY KEY (id);


--
-- Name: Compra Compra_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_pkey" PRIMARY KEY (id);


--
-- Name: Conferencia Conferencia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conferencia"
    ADD CONSTRAINT "Conferencia_pkey" PRIMARY KEY (id);


--
-- Name: CrossCD CrossCD_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossCD"
    ADD CONSTRAINT "CrossCD_pkey" PRIMARY KEY ("crossId", "cdId");


--
-- Name: Fornecedor Fornecedor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Fornecedor"
    ADD CONSTRAINT "Fornecedor_pkey" PRIMARY KEY (id);


--
-- Name: Movimentacao Movimentacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_pkey" PRIMARY KEY (id);


--
-- Name: OcorrenciaInteracao OcorrenciaInteracao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcorrenciaInteracao"
    ADD CONSTRAINT "OcorrenciaInteracao_pkey" PRIMARY KEY (id);


--
-- Name: SessaoRevogada SessaoRevogada_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SessaoRevogada"
    ADD CONSTRAINT "SessaoRevogada_pkey" PRIMARY KEY (jti);


--
-- Name: Transportadora Transportadora_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Transportadora"
    ADD CONSTRAINT "Transportadora_pkey" PRIMARY KEY (id);


--
-- Name: UsuarioUnidade UsuarioUnidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsuarioUnidade"
    ADD CONSTRAINT "UsuarioUnidade_pkey" PRIMARY KEY ("usuarioId", "unidadeId");


--
-- Name: Usuario Usuario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_pkey" PRIMARY KEY (id);


--
-- Name: ValePallet ValePallet_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AgendaDevolucao_cdId_dataPrevista_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgendaDevolucao_cdId_dataPrevista_idx" ON public."AgendaDevolucao" USING btree ("cdId", "dataPrevista");


--
-- Name: AgendaDevolucao_numero_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AgendaDevolucao_numero_key" ON public."AgendaDevolucao" USING btree (numero);


--
-- Name: AgendaDevolucao_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AgendaDevolucao_status_idx" ON public."AgendaDevolucao" USING btree (status);


--
-- Name: Auditoria_acao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Auditoria_acao_idx" ON public."Auditoria" USING btree (acao);


--
-- Name: Auditoria_cdId_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Auditoria_cdId_criadoEm_idx" ON public."Auditoria" USING btree ("cdId", "criadoEm");


--
-- Name: Auditoria_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Auditoria_criadoEm_idx" ON public."Auditoria" USING btree ("criadoEm");


--
-- Name: Auditoria_usuarioId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Auditoria_usuarioId_idx" ON public."Auditoria" USING btree ("usuarioId");


--
-- Name: CentroDistribuicao_cnpj_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CentroDistribuicao_cnpj_key" ON public."CentroDistribuicao" USING btree (cnpj);


--
-- Name: CentroDistribuicao_codigo_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "CentroDistribuicao_codigo_key" ON public."CentroDistribuicao" USING btree (codigo);


--
-- Name: CentroDistribuicao_tipo_ativo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CentroDistribuicao_tipo_ativo_idx" ON public."CentroDistribuicao" USING btree (tipo, ativo);


--
-- Name: Compra_chaveAcesso_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Compra_chaveAcesso_key" ON public."Compra" USING btree ("chaveAcesso");


--
-- Name: Conferencia_cdId_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conferencia_cdId_criadoEm_idx" ON public."Conferencia" USING btree ("cdId", "criadoEm");


--
-- Name: Conferencia_numero_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Conferencia_numero_key" ON public."Conferencia" USING btree (numero);


--
-- Name: Conferencia_remetenteId_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Conferencia_remetenteId_criadoEm_idx" ON public."Conferencia" USING btree ("remetenteId", "criadoEm");


--
-- Name: CrossCD_cdId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CrossCD_cdId_idx" ON public."CrossCD" USING btree ("cdId");


--
-- Name: Fornecedor_cnpj_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Fornecedor_cnpj_key" ON public."Fornecedor" USING btree (cnpj);


--
-- Name: Fornecedor_sigla_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Fornecedor_sigla_key" ON public."Fornecedor" USING btree (sigla);


--
-- Name: Movimentacao_cdId_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movimentacao_cdId_criadoEm_idx" ON public."Movimentacao" USING btree ("cdId", "criadoEm");


--
-- Name: Movimentacao_cdId_destino_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movimentacao_cdId_destino_idx" ON public."Movimentacao" USING btree ("cdId", destino);


--
-- Name: Movimentacao_cdId_origem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movimentacao_cdId_origem_idx" ON public."Movimentacao" USING btree ("cdId", origem);


--
-- Name: Movimentacao_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movimentacao_criadoEm_idx" ON public."Movimentacao" USING btree ("criadoEm");


--
-- Name: Movimentacao_tipo_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Movimentacao_tipo_criadoEm_idx" ON public."Movimentacao" USING btree (tipo, "criadoEm");


--
-- Name: OcorrenciaInteracao_valeId_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "OcorrenciaInteracao_valeId_criadoEm_idx" ON public."OcorrenciaInteracao" USING btree ("valeId", "criadoEm");


--
-- Name: SessaoRevogada_expiraEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SessaoRevogada_expiraEm_idx" ON public."SessaoRevogada" USING btree ("expiraEm");


--
-- Name: Transportadora_cnpj_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Transportadora_cnpj_key" ON public."Transportadora" USING btree (cnpj);


--
-- Name: UsuarioUnidade_unidadeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "UsuarioUnidade_unidadeId_idx" ON public."UsuarioUnidade" USING btree ("unidadeId");


--
-- Name: Usuario_login_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Usuario_login_key" ON public."Usuario" USING btree (login);


--
-- Name: Usuario_unidadeId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Usuario_unidadeId_idx" ON public."Usuario" USING btree ("unidadeId");


--
-- Name: ValePallet_aguardandoId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ValePallet_aguardandoId_status_idx" ON public."ValePallet" USING btree ("aguardandoId", status);


--
-- Name: ValePallet_cdId_tipo_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ValePallet_cdId_tipo_status_idx" ON public."ValePallet" USING btree ("cdId", tipo, status);


--
-- Name: ValePallet_chaveNfe_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ValePallet_chaveNfe_key" ON public."ValePallet" USING btree ("chaveNfe");


--
-- Name: ValePallet_fornecedorId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ValePallet_fornecedorId_status_idx" ON public."ValePallet" USING btree ("fornecedorId", status);


--
-- Name: ValePallet_numero_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ValePallet_numero_key" ON public."ValePallet" USING btree (numero);


--
-- Name: ValePallet_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ValePallet_status_idx" ON public."ValePallet" USING btree (status);


--
-- Name: ValePallet_unidadeId_tipo_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ValePallet_unidadeId_tipo_status_idx" ON public."ValePallet" USING btree ("unidadeId", tipo, status);


--
-- Name: Auditoria auditoria_imutavel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auditoria_imutavel BEFORE DELETE OR UPDATE ON public."Auditoria" FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao();


--
-- Name: Movimentacao movimentacao_imutavel; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER movimentacao_imutavel BEFORE DELETE OR UPDATE ON public."Movimentacao" FOR EACH ROW EXECUTE FUNCTION public.bloquear_alteracao();


--
-- Name: AgendaDevolucao AgendaDevolucao_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgendaDevolucao"
    ADD CONSTRAINT "AgendaDevolucao_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AgendaDevolucao AgendaDevolucao_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgendaDevolucao"
    ADD CONSTRAINT "AgendaDevolucao_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AgendaDevolucao AgendaDevolucao_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgendaDevolucao"
    ADD CONSTRAINT "AgendaDevolucao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Fornecedor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: AgendaDevolucao AgendaDevolucao_validadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AgendaDevolucao"
    ADD CONSTRAINT "AgendaDevolucao_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auditoria Auditoria_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Auditoria Auditoria_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Auditoria"
    ADD CONSTRAINT "Auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Compra Compra_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Compra Compra_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Fornecedor"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Compra Compra_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Compra"
    ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Conferencia Conferencia_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conferencia"
    ADD CONSTRAINT "Conferencia_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Conferencia Conferencia_remetenteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conferencia"
    ADD CONSTRAINT "Conferencia_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Conferencia Conferencia_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Conferencia"
    ADD CONSTRAINT "Conferencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CrossCD CrossCD_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossCD"
    ADD CONSTRAINT "CrossCD_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CrossCD CrossCD_crossId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CrossCD"
    ADD CONSTRAINT "CrossCD_crossId_fkey" FOREIGN KEY ("crossId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Movimentacao Movimentacao_agendaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES public."AgendaDevolucao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimentacao Movimentacao_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Movimentacao Movimentacao_compraId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES public."Compra"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimentacao Movimentacao_conferenciaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES public."Conferencia"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimentacao Movimentacao_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Fornecedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimentacao Movimentacao_unidadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Movimentacao Movimentacao_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Movimentacao Movimentacao_valeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Movimentacao"
    ADD CONSTRAINT "Movimentacao_valeId_fkey" FOREIGN KEY ("valeId") REFERENCES public."ValePallet"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: OcorrenciaInteracao OcorrenciaInteracao_unidadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcorrenciaInteracao"
    ADD CONSTRAINT "OcorrenciaInteracao_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcorrenciaInteracao OcorrenciaInteracao_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcorrenciaInteracao"
    ADD CONSTRAINT "OcorrenciaInteracao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: OcorrenciaInteracao OcorrenciaInteracao_valeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OcorrenciaInteracao"
    ADD CONSTRAINT "OcorrenciaInteracao_valeId_fkey" FOREIGN KEY ("valeId") REFERENCES public."ValePallet"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: UsuarioUnidade UsuarioUnidade_unidadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsuarioUnidade"
    ADD CONSTRAINT "UsuarioUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UsuarioUnidade UsuarioUnidade_usuarioId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."UsuarioUnidade"
    ADD CONSTRAINT "UsuarioUnidade_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Usuario Usuario_unidadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "Usuario_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ValePallet ValePallet_agendaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_agendaId_fkey" FOREIGN KEY ("agendaId") REFERENCES public."AgendaDevolucao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_aguardandoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_aguardandoId_fkey" FOREIGN KEY ("aguardandoId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_canceladoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_canceladoPorId_fkey" FOREIGN KEY ("canceladoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_cdId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_cdId_fkey" FOREIGN KEY ("cdId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ValePallet ValePallet_conferenciaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_conferenciaId_fkey" FOREIGN KEY ("conferenciaId") REFERENCES public."Conferencia"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_conferenciaOrigemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_conferenciaOrigemId_fkey" FOREIGN KEY ("conferenciaOrigemId") REFERENCES public."Conferencia"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_criadoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ValePallet ValePallet_fornecedorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES public."Fornecedor"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_resolvidoPorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES public."Usuario"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ValePallet ValePallet_unidadeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ValePallet"
    ADD CONSTRAINT "ValePallet_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES public."CentroDistribuicao"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict RCcYcobMNbVMs9rMresSawueoTxVhwft6ykNTTlohiDc0YvllEhCDIGyx9BnPVz

