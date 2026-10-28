import { redirect } from "next/navigation";
import { registrarQuebra } from "@/actions/avarias";
import { requireCD } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { ehUsuarioCross, tem } from "@/lib/permissoes";
import { Fluxo, SaldosEstoques } from "./Contas";
import { FormAcao } from "./FormAcao";
import { FormDescarte } from "./FormDescarte";
import { FormReparo } from "./FormReparo";
import { PalletsDescartados } from "./PalletsDescartados";
import { UltimasMovimentacoes } from "./UltimasMovimentacoes";
import { Abas, Cabecalho, Painel } from "./ui";

const config = {
  quebras: {
    titulo: "Lançar Quebrado",
    descricao: "Origem: Pallets PBR (subtrai) → Destino: Pallets Quebrados (soma).",
    tipo: "QUEBRA",
  },
  recuperados: {
    titulo: "Conserto / Reparo de Pallets",
    descricao: "Exclusivo do CD Hub (CDJC). Recuperados: Pallets Quebrados → Pallets PBR. Pallets Quebrados desmontados para o reparo: Pallets Quebrados → Descartados. A soma nunca ultrapassa o saldo de quebrados.",
    tipo: "RECUPERADO",
  },
  descarte: {
    titulo: "Descarte / Destruição de Pallets",
    descricao: "Baixa definitiva e imutável, disponível a todos os usuários. Ao confirmar, escolha de qual estoque os pallets saem: Pallets PBR ou Pallets Quebrados.",
    tipo: "DESCARTE",
  },
} as const;

export async function PaginaAvaria({ modo }: { modo: keyof typeof config }) {
  const u = await requireCD();
  // Descarte: todos os usuários de CD (fora do escopo do Ponto de Cross). Quebra: permissão
  // "quebras". Reparo: permissão "reparo" e somente no Hub.
  if (modo === "descarte" && ehUsuarioCross(u)) redirect("/sem-acesso?modulo=cross");
  if (modo === "quebras" && !tem(u, "quebras")) redirect("/sem-acesso");
  if (modo === "recuperados" && (!tem(u, "reparo") || !u.cd.hub)) redirect("/sem-acesso?modulo=reparo");
  const c = config[modo];
  const abas = [
    ...(tem(u, "quebras") ? [{ href: "/avarias/quebras", rotulo: "Lançar Quebrado" }] : []),
    ...(u.cd.hub && tem(u, "reparo") ? [{ href: "/avarias/recuperados", rotulo: "Conserto / Reparo" }] : []),
    ...(ehUsuarioCross(u) ? [] : [{ href: "/avarias/descarte", rotulo: "Descarte" }]),
  ];
  const saldos = await obterSaldos(u.cd.id);

  return (
    <>
      <Cabecalho titulo={c.titulo} descricao={`${c.descricao} · Unidade ${u.cd.codigo}`} />
      {abas.length > 1 && <Abas ativo={`/avarias/${modo}`} itens={abas} />}
      <SaldosEstoques cdId={u.cd.id} destaque={["VAZIOS", "QUEBRADOS"]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo="Novo lançamento">
          <p className="mb-4">
            {modo === "quebras" && <Fluxo origem="VAZIOS" destino="QUEBRADOS" />}
            {modo === "recuperados" && <Fluxo origem="QUEBRADOS" destino="VAZIOS" />}
            {modo === "descarte" && <span className="text-[12px] text-t3">Pallets PBR ou Pallets Quebrados → Descarte</span>}
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
        <div className="space-y-6 lg:col-span-2">
          {modo === "descarte" && <PalletsDescartados cdId={u.cd.id} global={u.global} />}
          {modo !== "descarte" && <UltimasMovimentacoes cdId={u.cd.id} tipos={modo === "recuperados" ? ["RECUPERADO", "CANIBALIZACAO"] : [c.tipo]} titulo="Últimos lançamentos" />}
        </div>
      </div>
    </>
  );
}
