import { AbasRota } from "@/components/AbasRota";
import { Cabecalho } from "@/components/ui";
import { requireUsuario } from "@/lib/auth";
import { ehAdmin } from "@/lib/permissoes";

export default async function CadastrosLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requireUsuario();
  const itens = [
    { href: "/cadastros/transportadoras", rotulo: "Transportadoras" },
    { href: "/cadastros/fornecedores", rotulo: "Fornecedores" },
    ...(ehAdmin(usuario)
      ? [
          { href: "/cadastros/cds", rotulo: "Centros de Distribuição" },
          { href: "/cadastros/usuarios", rotulo: "Usuários" },
        ]
      : []),
  ];
  return (
    <>
      <Cabecalho titulo="Cadastros" descricao="Transportadoras, fornecedores, centros de distribuição e usuários. Toda alteração é auditada." />
      <AbasRota itens={itens} />
      {children}
    </>
  );
}
