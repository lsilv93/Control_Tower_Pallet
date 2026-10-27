// Controle de acesso (RBAC + escopo por unidade). Módulo puro: usado no servidor e no menu (cliente).

/** Permissões granulares por tela/funcionalidade, atribuíveis a operadores. */
export const PERMISSOES = [
  { chave: "dashboard", rotulo: "Painel da unidade" },
  { chave: "tv", rotulo: "Tela TV · Torre de Controle (somente visão global)" },
  { chave: "envio", rotulo: "Envio de pallets (CD, Cross e quebrados ao CDJC)" },
  { chave: "recebimento", rotulo: "Recebimento / conferência de pallets" },
  { chave: "quebras", rotulo: "Lançar quebrado" },
  { chave: "reparo", rotulo: "Conserto / reparo de quebrados (Hub CDJC)" },
  { chave: "vales", rotulo: "Consulta de vales" },
  { chave: "excluir_vale", rotulo: "Excluir vale (antes da conferência)" },
  { chave: "fornecedor", rotulo: "Recebimento Pallet Fornecedor (se liberado no CD)" },
  { chave: "compras", rotulo: "Compra de pallets (leitura de NF-e)" },
  { chave: "relatorios", rotulo: "Relatórios e exportação" },
  { chave: "auditoria", rotulo: "Auditoria" },
  { chave: "cadastros", rotulo: "Cadastro de fornecedores e transportadoras" },
  { chave: "cds", rotulo: "Cadastro de CDs e Pontos de Cross" },
] as const;

export type Permissao = (typeof PERMISSOES)[number]["chave"];
export const CHAVES_PERMISSAO = PERMISSOES.map((p) => p.chave) as Permissao[];

/** Usuários de Ponto de Cross: só o painel, envio, recebimento/conferência e lançar quebrado. */
export const PERMISSOES_CROSS: readonly Permissao[] = ["dashboard", "envio", "recebimento", "quebras"];

export type Perfil = "MASTER" | "ADMIN" | "OPERADOR";
export type UnidadeAcesso = { tipo: "CD" | "CROSS"; hub: boolean };
type ComAcesso = { perfil: Perfil; permissoes?: string[]; unidade?: UnidadeAcesso };

export const ROTULO_PERFIL: Record<Perfil, string> = {
  MASTER: "Master",
  ADMIN: "Administrador",
  OPERADOR: "Operador",
};

export const ehMaster = (u: { perfil: Perfil }) => u.perfil === "MASTER";
/** Administração: MASTER e ADMIN. */
export const ehAdmin = (u: { perfil: Perfil }) => u.perfil === "MASTER" || u.perfil === "ADMIN";
/** Usuário de Ponto de Cross (não administrador). */
export const ehUsuarioCross = (u: ComAcesso) => !ehAdmin(u) && u.unidade?.tipo === "CROSS";
/** Visão global (Nível Brasil): Master, Administrador e usuários do Hub CDJC. */
export const temVisaoGlobal = (u: ComAcesso) => ehAdmin(u) || !!u.unidade?.hub;

/**
 * MASTER e ADMIN têm todas as telas; OPERADOR só as permissões marcadas. Usuários de
 * Ponto de Cross ficam limitados ao painel, envio, recebimento e lançar quebrado.
 */
export function tem(u: ComAcesso, p: Permissao): boolean {
  if (ehAdmin(u)) return true;
  if (ehUsuarioCross(u) && !PERMISSOES_CROSS.includes(p)) return false;
  return !!u.permissoes?.includes(p);
}

/** Tela inicial de cada permissão (para quem não tem acesso ao painel). */
const ROTA_INICIAL: Record<Permissao, string> = {
  dashboard: "/",
  tv: "/tv",
  envio: "/envio",
  recebimento: "/recebimento",
  quebras: "/avarias/quebras",
  reparo: "/avarias/recuperados",
  vales: "/vales/consulta",
  excluir_vale: "/vales/excluir",
  fornecedor: "/fornecedor/entrada",
  compras: "/pallets/adicionar",
  relatorios: "/relatorios",
  auditoria: "/auditoria",
  cadastros: "/cadastros/fornecedores",
  cds: "/cadastros/cds",
};

export function primeiraRota(u: ComAcesso): string {
  const p = CHAVES_PERMISSAO.find((c) => c !== "tv" && c !== "fornecedor" && c !== "reparo" && tem(u, c));
  return p ? ROTA_INICIAL[p] : "/avarias/descarte";
}
