--
-- PostgreSQL database dump
--

\restrict z7egv5Jl4coi1MtwsR6Y4YJl0a5ONB5HEQyRl4l4Z7atoaXxjDySG2pesj5e3do

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
-- Data for Name: AgendaDevolucao; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Auditoria; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Auditoria" (id, acao, entidade, "entidadeId", origem, destino, quantidade, observacao, detalhes, "criadoEm", "usuarioId", "cdId") VALUES ('auditoria_reset_operacao_20261113', 'RESET_DADOS_OPERACAO', 'Sistema', NULL, NULL, NULL, NULL, 'Dados operacionais zerados: mantidos usuários, fornecedores, transportadoras, CDs e Pontos de Cross.', NULL, '2026-11-13 14:51:18.388', NULL, NULL);
INSERT INTO public."Auditoria" (id, acao, entidade, "entidadeId", origem, destino, quantidade, observacao, detalhes, "criadoEm", "usuarioId", "cdId") VALUES ('cmwf3h7we00027dqwfx8z69ku', 'SEED_HUB', 'CentroDistribuicao', 'cmwf3h7wb00007dqwkkka7mvh', NULL, NULL, NULL, NULL, NULL, '2026-11-13 14:51:19.742', NULL, 'cmwf3h7wb00007dqwkkka7mvh');
INSERT INTO public."Auditoria" (id, acao, entidade, "entidadeId", origem, destino, quantidade, observacao, detalhes, "criadoEm", "usuarioId", "cdId") VALUES ('cmwf3h7z900067dqwf7s2xoje', 'SEED_ADMIN', 'Usuario', 'cmwf3h7z300047dqw5ldiut1f', NULL, NULL, NULL, NULL, NULL, '2026-11-13 14:51:19.845', NULL, 'cmwf3h7wb00007dqwkkka7mvh');


--
-- Data for Name: CentroDistribuicao; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CentroDistribuicao" (id, codigo, nome, tipo, hub, cnpj, contato, telefone, email, "recebimentoFornecedor", ativo, "criadoEm", cep, cidade, endereco, uf) VALUES ('cmwf3h7wb00007dqwkkka7mvh', 'CDJC', 'CD Jacareí (Hub Nível Brasil)', 'CD', true, '59568428001150', 'Administrador', NULL, NULL, false, true, '2026-11-13 14:51:19.74', '12334403', 'Jacareí', 'Rua Harold Barnsley Holland, 2130, Galpão B, Sala 01, Rio Abaixo', 'SP');


--
-- Data for Name: Compra; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Conferencia; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: CrossCD; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Fornecedor; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Movimentacao; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: OcorrenciaInteracao; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: SessaoRevogada; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Transportadora; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Usuario" (id, nome, login, "senhaHash", perfil, permissoes, "unidadeId", ativo, "criadoEm", "atualizadoEm") VALUES ('cmwf3h7z300047dqw5ldiut1f', 'Administrador', 'admin', '$2b$10$A2ZkA4ZhKJbafHD.VdH5YeLUXOGPXRkeY0uM6oOKCXtOlxabswZZu', 'MASTER', '{}', 'cmwf3h7wb00007dqwkkka7mvh', true, '2026-11-13 14:51:19.839', '2026-11-13 14:51:19.839');


--
-- Data for Name: UsuarioUnidade; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."UsuarioUnidade" ("usuarioId", "unidadeId", "criadoEm") VALUES ('cmwf3h7z300047dqw5ldiut1f', 'cmwf3h7wb00007dqwkkka7mvh', '2026-11-13 14:51:19.839');


--
-- Data for Name: ValePallet; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('0ccb4833-bcad-4718-b9d4-061407390879', 'e50f721b3e285d21f7840f0fa42b03ee8e97c8c2b88ad04ba8107b7897bd035a', '2026-11-13 14:51:18.04778+00', '20260924173451_init', NULL, NULL, '2026-11-13 14:51:18.012684+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('800bdd9b-df13-42d0-8b5a-f5182c88518c', '42b8f75d45f8c717e4e2d29acb160f295aea1464d92d283141b144133706484e', '2026-11-13 14:51:18.307452+00', '20261028150000_usuario_admin_master', NULL, NULL, '2026-11-13 14:51:18.304496+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('1b1d9d34-ea5a-45b5-b032-52ec6a5a6569', '011856d687bd8004ae7570f4d1279740d777588f5a322bbbe3f1566b78a5b371', '2026-11-13 14:51:18.062082+00', '20260924202513_cadastros_compras_permissoes', NULL, NULL, '2026-11-13 14:51:18.049131+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('fa8880cd-2444-42d0-92c4-714b9b6a54d5', 'ef34cbd416fcc9fdb2f1b2e79caa46e72805ab7138b40700120ec793d767fc22', '2026-11-13 14:51:18.067856+00', '20260930122924_cancelamento_vales', NULL, NULL, '2026-11-13 14:51:18.063855+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('edbf75ee-c6f3-4424-b9f0-5f1654c24dcb', '8a29042f0870880281eafea2062502eca31620225d6106d673a044d44bdc120b', '2026-11-13 14:51:18.075787+00', '20260930131543_sessao_revogada', NULL, NULL, '2026-11-13 14:51:18.068924+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('ac2053ab-1f3c-453a-819c-30801b7904f6', '55c8a147dfc55d19266e131674b37c8f83bb02b36089b912b38fb6564e4d44a9', '2026-11-13 14:51:18.318356+00', '20261028180000_cross_multiplos_cds_fornecedor_sigla', NULL, NULL, '2026-11-13 14:51:18.308179+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('6859e90d-b13b-4770-b89c-fc84c11a5f8a', 'a8eb1aabe79aa4b3d8c5e72f7f5a9b51a6ca310d648cc606465bbbe3bf9268a8', '2026-11-13 14:51:18.082562+00', '20261001120000_partida_dobrada_estrutura', NULL, NULL, '2026-11-13 14:51:18.076646+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('25e9f858-b8da-4f66-ae3e-9b3eeb57767d', '94c1e29498f492c5749619b741471d549367afd2f08fb1a6ba9427e817699e2c', '2026-11-13 14:51:18.090787+00', '20261001120100_partida_dobrada_dados', NULL, NULL, '2026-11-13 14:51:18.083428+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('e2e6498d-8ad3-4d44-a567-732d3c470b3f', 'c316ada28d003d152e660b363e75af8c559283b0f4b0dbc0e56fec3b221ebf83', '2026-11-13 14:51:18.096114+00', '20261001150000_recebimento_nf_sem_nf', NULL, NULL, '2026-11-13 14:51:18.0917+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('1425d983-5dd7-4875-88a6-5a122173b11a', 'dd1f50376c1af14639c1338d4091fa84d802d81228e9e9d38a74f8c827a0a5bc', '2026-11-13 14:51:18.321733+00', '20261029120000_reset_senha_admin', NULL, NULL, '2026-11-13 14:51:18.319089+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('0fae6e2a-8eba-4bf3-9b1b-31fc639c2277', '05d9259e8555afc5efb9239f9e3def03d52b60df907db683c210f03e567c049a', '2026-11-13 14:51:18.133396+00', '20261001160000_zerar_dados', NULL, NULL, '2026-11-13 14:51:18.096941+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('76755ffd-3fcf-46e7-b39c-d9ae1aec75f4', '70a42df8771ca419c8a7e4a5babcc8f92cbd5309e7fefbec1067ac430652cfc4', '2026-11-13 14:51:18.158163+00', '20261015120000_multi_cd_estrutura', NULL, NULL, '2026-11-13 14:51:18.134211+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('ef869a6c-63be-437b-92a3-3bfd614e5b0c', '918ab217f7c65f358625e38ba53b6dac03d555792e788c45465cc08be3c4d9c0', '2026-11-13 14:51:18.164831+00', '20261015120100_multi_cd_dados', NULL, NULL, '2026-11-13 14:51:18.159103+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('2bf39b33-e09b-4f5a-89a6-d67edc6b6433', '9e796ca3dcfcb284db0f4b5f984661140a36a5140821d556bb01c288943602be', '2026-11-13 14:51:18.381214+00', '20261106120000_ocorrencia_bidirecional_usuario_multiunidade_reset', NULL, NULL, '2026-11-13 14:51:18.32248+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('afcf3edd-4db1-4675-be92-cd783f0d97fe', 'e117c96586e2f92a9d6315147ea2289b8bb2eee294d72101ee3002be37cf84ca', '2026-11-13 14:51:18.169451+00', '20261016120000_rota_faturamento_sem_motorista', NULL, NULL, '2026-11-13 14:51:18.165667+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('944dffe9-3a06-4676-bc30-86638fc75eb9', 'b640038f76f40eb82fd852401ab3c622134f8fbff34654f70c137cf62c319d7a', '2026-11-13 14:51:18.252729+00', '20261027120000_torre_controle_reset_total', NULL, NULL, '2026-11-13 14:51:18.170343+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('0d99d9b9-7b27-4908-8994-cb6448ac0ca3', 'ff78530e9b688d7d35b01a92894a0a1e0196d05f9f19dc72c032a1ffa167820c', '2026-11-13 14:51:18.303592+00', '20261028120000_zerar_dados_para_testes', NULL, NULL, '2026-11-13 14:51:18.253475+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('094eff12-36b3-476b-96ce-c1c66663aea3', 'd3ac0c5129cbeeeef2ea511a5db4918feabafca7a02d18e56f20f1f8c9368a52', '2026-11-13 14:51:18.386209+00', '20261110120000_endereco_unidade_remessa_cross', NULL, NULL, '2026-11-13 14:51:18.382052+00', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('99c2b319-790e-48c0-9eec-3bae2ea430bc', 'd18c76b20ca545f0020a750bde556fe585fbdb4e20ee895908c4545c2e283138', '2026-11-13 14:51:18.426055+00', '20261113120000_reset_dados_operacionais', NULL, NULL, '2026-11-13 14:51:18.38699+00', 1);


--
-- Name: AgendaDevolucao_numero_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AgendaDevolucao_numero_seq"', 1, false);


--
-- Name: Conferencia_numero_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."Conferencia_numero_seq"', 1, false);


--
-- Name: ValePallet_numero_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."ValePallet_numero_seq"', 1, false);


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

\unrestrict z7egv5Jl4coi1MtwsR6Y4YJl0a5ONB5HEQyRl4l4Z7atoaXxjDySG2pesj5e3do

