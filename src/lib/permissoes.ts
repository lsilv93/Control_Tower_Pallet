// Controle de acesso (RBAC). Módulo puro: usado no servidor e no menu (cliente).

/** Permissões granulares por tela/funcionalidade, atribuíveis a operadores. */
export const PERMISSOES = [
  { chave: "dashboard", rotulo: "Dashboard" },
  { chave: "cd", rotulo: "Transferências do CD (envio e retorno)" },
  { chave: "entrada", rotulo: "Entrada de fornecedor (gerar vale-pallet)" },
  { chave: "vales", rotulo: "Vales pendentes e consulta / PDF de vales" },
  { chave: "agendas", rotulo: "Agendamento de retirada e baixa de pagamento" },
  { chave: "excluir_vale", rotulo: "Excluir vale-pallet" },
  { chave: "avarias", rotulo: "Quebras, conserto e descarte" },
  { chave: "compras", rotulo: "Compra de pallets (leitura de NF-e)" },
  { chave: "relatorios", rotulo: "Relatórios e exportação" },
  { chave: "auditoria", rotulo: "Auditoria (consulta e exportação)" },
  { chave: "cadastros", rotulo: "Cadastro de transportadoras e fornecedores" },
  { chave: "cds", rotulo: "Cadastro de centros de distribuição" },
] as const;

export type Permissao = (typeof PERMISSOES)[number]["chave"];
export const CHAVES_PERMISSAO = PERMISSOES.map((p) => p.chave) as Permissao[];

export type Perfil = "MASTER" | "ADMIN" | "OPERADOR";
type ComAcesso = { perfil: Perfil; permissoes?: string[] };

export const ROTULO_PERFIL: Record<Perfil, string> = {
  MASTER: "Master",
  ADMIN: "Administrador",
  OPERADOR: "Operador",
};

export const ehMaster = (u: ComAcesso) => u.perfil === "MASTER";
/** Administração (usuários etc.): MASTER e ADMIN. */
export const ehAdmin = (u: ComAcesso) => u.perfil === "MASTER" || u.perfil === "ADMIN";

/** MASTER e ADMIN têm todas as telas; OPERADOR só as permissões marcadas. */
export function tem(u: ComAcesso, p: Permissao): boolean {
  return ehAdmin(u) || !!u.permissoes?.includes(p);
}

/** Inclusão/remoção manual de saldo em qualquer estoque: exclusivo do MASTER. */
export const podeAjustarManual = (u: ComAcesso) => ehMaster(u);

/** Tela inicial de cada permissão (para quem não tem acesso ao Dashboard). */
const ROTA_INICIAL: Record<Permissao, string> = {
  dashboard: "/",
  cd: "/cd/envio",
  entrada: "/fornecedor/entrada",
  vales: "/vales/consulta",
  agendas: "/vales",
  excluir_vale: "/vales/excluir",
  avarias: "/avarias/quebras",
  compras: "/pallets/adicionar",
  relatorios: "/relatorios",
  auditoria: "/auditoria",
  cadastros: "/cadastros/transportadoras",
  cds: "/cadastros/cds",
};

export function primeiraRota(u: ComAcesso): string {
  const p = CHAVES_PERMISSAO.find((c) => tem(u, c));
  return p ? ROTA_INICIAL[p] : "/conta";
}
