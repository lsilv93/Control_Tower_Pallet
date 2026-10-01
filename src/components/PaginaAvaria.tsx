import { registrarQuebra, registrarRecuperado } from "@/actions/avarias";
import { requirePermissao } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { Fluxo, SaldosEstoques } from "./Contas";
import { FormAcao } from "./FormAcao";
import { FormDescarte } from "./FormDescarte";
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
    descricao: "Origem: Estoque de Quebrados (subtrai) → Destino: Estoque de Vazios (soma).",
    tipo: "RECUPERADO",
  },
  descarte: {
    titulo: "Descarte / Destruição de Pallets",
    descricao: "Baixa definitiva. Ao confirmar, escolha de qual pulmão os pallets saem: Vazios ou Quebrados.",
    tipo: "DESCARTE",
  },
} as const;

export async function PaginaAvaria({ modo }: { modo: keyof typeof config }) {
  await requirePermissao("avarias");
  const c = config[modo];
  const saldos = await obterSaldos();

  return (
    <>
      <Cabecalho titulo={c.titulo} descricao={c.descricao} />
      <Abas
        ativo={`/avarias/${modo}`}
        itens={[
          { href: "/avarias/quebras", rotulo: "Quebras" },
          { href: "/avarias/recuperados", rotulo: "Conserto / Reparo" },
          { href: "/avarias/descarte", rotulo: "Descarte" },
        ]}
      />
      <SaldosEstoques destaque={["VAZIOS", "QUEBRADOS"]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo="Novo lançamento">
          <p className="mb-4">
            {modo === "quebras" && <Fluxo origem="VAZIOS" destino="QUEBRADOS" />}
            {modo === "recuperados" && <Fluxo origem="QUEBRADOS" destino="VAZIOS" />}
            {modo === "descarte" && <span className="text-[12px] text-t3">Vazios ou Quebrados → Descarte</span>}
          </p>
          {modo === "descarte" ? (
            <FormDescarte saldoVazios={saldos.vazios} saldoQuebrados={saldos.quebrados} />
          ) : (
            <FormAcao
              acao={modo === "quebras" ? registrarQuebra : registrarRecuperado}
              botao={modo === "quebras" ? "Registrar quebra" : "Registrar conserto"}
              classeBotao={modo === "quebras" ? "btn-danger w-full" : "btn-primary w-full"}
            >
              <div>
                <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
                <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="observacao">
                  {modo === "quebras" ? "Observação (motivo da quebra) *" : "Observação"}
                </label>
                <textarea
                  id="observacao"
                  name="observacao"
                  rows={3}
                  className="input"
                  required={modo === "quebras"}
                  minLength={modo === "quebras" ? 5 : undefined}
                  maxLength={500}
                />
              </div>
            </FormAcao>
          )}
        </Painel>
        <div className="lg:col-span-2">
          <UltimasMovimentacoes tipos={[c.tipo]} titulo="Últimos lançamentos" />
        </div>
      </div>
    </>
  );
}
