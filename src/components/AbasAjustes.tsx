import { Abas } from "./ui";

/** Abas das telas de ajuste manual (inclusões: MASTER/ADMIN; correção: MASTER). */
export function AbasAjustes({ ativo, master }: { ativo: string; master: boolean }) {
  return (
    <Abas
      ativo={ativo}
      itens={[
        { href: "/estoque/vazios", rotulo: "Inclusão de Vazios" },
        { href: "/estoque/devedor", rotulo: "Saldo Devedor" },
        ...(master ? [{ href: "/estoque/ajuste", rotulo: "Correção de Inventário" }] : []),
      ]}
    />
  );
}
