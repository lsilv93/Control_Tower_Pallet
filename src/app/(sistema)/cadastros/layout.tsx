import { AbasRota } from "@/components/AbasRota";
import { Cabecalho } from "@/components/ui";
import { requireUsuario } from "@/lib/auth";
import { ehAdmin, tem } from "@/lib/permissoes";

export default async function CadastrosLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  const itens = [
    ...(tem(usuario, "cadastros")
      ? [
          { href: "/cadastros/transportadoras", rotulo: "Transportadoras" },
          { href: "/cadastros/fornecedores", rotulo: "Fornecedores" },
        ]
      : []),
    ...(tem(usuario, "cds") ? [{ href: "/cadastros/cds", rotulo: "Centros de Distribuição" }] : []),
    ...(ehAdmin(usuario) ? [{ href: "/cadastros/usuarios", rotulo: "Usuários e Permissões" }] : []),
  ];
  return (
    <>
      <Cabecalho titulo="Cadastros" descricao="Transportadoras, fornecedores, centros de distribuição e usuários. Toda alteração é auditada." />
      <AbasRota itens={itens} />
      {children}
    </>
  );
}
