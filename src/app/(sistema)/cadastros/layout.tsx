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
    ...(tem(usuario, "cds")
      ? [
          { href: "/cadastros/cds", rotulo: "Centros de Distribuição" },
          { href: "/cadastros/cross", rotulo: "Pontos de Cross" },
        ]
      : []),
    ...(ehAdmin(usuario) ? [{ href: "/cadastros/usuarios", rotulo: "Usuários e Permissões" }] : []),
  ];
  return (
    <>
      <Cabecalho titulo="Cadastros" descricao="Transportadoras, fornecedores, CDs, Pontos de Cross e usuários (com os CDs em que operam). Toda alteração é auditada." />
      <AbasRota itens={itens} />
      {children}
    </>
  );
}
