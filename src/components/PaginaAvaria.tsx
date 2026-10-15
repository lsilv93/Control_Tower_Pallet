import { registrarQuebra } from "@/actions/avarias";
import { requirePermissao } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { Fluxo, SaldosEstoques } from "./Contas";
import { FormAcao } from "./FormAcao";
import { FormDescarte } from "./FormDescarte";
import { FormReparo } from "./FormReparo";
import { UltimasMovimentacoes } from "./UltimasMovimentacoes";
import { Abas, Cabecalho, Painel } from "./ui";

const config = {
  quebras: {
    titulo: "Lançamento de Pallets Quebrados",
    descricao: "Origem: Estoque de Vazios (subtrai) → Destino: Estoque de Quebrados (soma).",
    tipo: "QUEBRA",
  },
  recuperados: {
    titulo: "Conserto / Reparo de Pallets",
    descricao: "Recuperados: Quebrados → Vazios. Pallets quebrados desmontados para o reparo: Quebrados → Descartados. A soma nunca ultrapassa o saldo de quebrados.",
    tipo: "RECUPERADO",
  },
  descarte: {
    titulo: "Descarte / Destruição de Pallets",
    descricao: "Baixa definitiva. Ao confirmar, escolha de qual pulmão os pallets saem: Vazios ou Quebrados.",
    tipo: "DESCARTE",
  },
} as const;

export async function PaginaAvaria({ modo }: { modo: keyof typeof config }) {
  const u = await requirePermissao("avarias");
  const c = config[modo];
  const saldos = await obterSaldos(u.cd.id);

  return (
    <>
      <Cabecalho titulo={c.titulo} descricao={`${c.descricao} · CD ${u.cd.codigo}`} />
      <Abas
        ativo={`/avarias/${modo}`}
        itens={[
          { href: "/avarias/quebras", rotulo: "Quebras" },
          { href: "/avarias/recuperados", rotulo: "Conserto / Reparo" },
          { href: "/avarias/descarte", rotulo: "Descarte" },
        ]}
      />
      <SaldosEstoques cdId={u.cd.id} destaque={["VAZIOS", "QUEBRADOS"]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo="Novo lançamento">
          <p className="mb-4">
            {modo === "quebras" && <Fluxo origem="VAZIOS" destino="QUEBRADOS" />}
            {modo === "recuperados" && <Fluxo origem="QUEBRADOS" destino="VAZIOS" />}
            {modo === "descarte" && <span className="text-[12px] text-t3">Vazios ou Quebrados → Descarte</span>}
          </p>
          {modo === "descarte" ? (
            <FormDescarte saldoVazios={saldos.vazios} saldoQuebrados={saldos.quebrados} />
          ) : modo === "recuperados" ? (
            <FormReparo saldoQuebrados={saldos.quebrados} />
          ) : (
            <FormAcao acao={registrarQuebra} botao="Registrar quebra" classeBotao="btn-danger w-full">
              <div>
                <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
                <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="observacao">Observação (motivo da quebra) *</label>
                <textarea id="observacao" name="observacao" rows={3} className="input" required minLength={5} maxLength={500} />
              </div>
            </FormAcao>
          )}
        </Painel>
        <div className="lg:col-span-2">
          <UltimasMovimentacoes cdId={u.cd.id} tipos={modo === "recuperados" ? ["RECUPERADO", "CANIBALIZACAO"] : modo === "descarte" ? ["DESCARTE", "CANIBALIZACAO"] : [c.tipo]} titulo="Últimos lançamentos" />
        </div>
      </div>
    </>
  );
}
