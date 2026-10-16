"use client";

import { useState } from "react";
import { GraficoRosca, type FatiaRosca } from "./GraficoRosca";

/** Vales-pallet pendentes: alterna entre a distribuição por fornecedor e por idade (aging). */
export function PainelValesFornecedor({ porFornecedor, porIdade }: { porFornecedor: FatiaRosca[]; porIdade: FatiaRosca[] }) {
  const [modo, setModo] = useState<"fornecedor" | "idade">("fornecedor");
  return (
    <div>
      <div className="abas mb-4 w-fit" role="tablist" aria-label="Agrupar vales pendentes">
        {(
          [
            ["fornecedor", "Por fornecedor"],
            ["idade", "Por idade (aging)"],
          ] as const
        ).map(([v, r]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={modo === v}
            onClick={() => setModo(v)}
            className={modo === v ? "aba aba-ativa" : "aba"}
          >
            {r}
          </button>
        ))}
      </div>
      <GraficoRosca
        key={modo}
        dados={modo === "fornecedor" ? porFornecedor : porIdade}
        rotuloTotal="pallets em vales"
        vazio="Nenhum vale-pallet pendente com fornecedores."
      />
    </div>
  );
}
