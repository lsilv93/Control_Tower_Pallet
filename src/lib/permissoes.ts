type ComPerfil = { perfil: "ADMIN" | "OPERADOR"; podeAdicionarPallets?: boolean };

export const ehAdmin = (u: ComPerfil) => u.perfil === "ADMIN";

/** Adicionar pallets (compra / ajuste): administradores ou usuários com a permissão específica. */
export const podeAdicionarPallets = (u: ComPerfil) => ehAdmin(u) || !!u.podeAdicionarPallets;
