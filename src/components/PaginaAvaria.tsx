import { Boxes, Hammer } from "lucide-react";
import { registrarDescarte, registrarQuebra, registrarRecuperado } from "@/actions/avarias";
import { obterSaldos } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";
import { FormAcao } from "./FormAcao";
import { UltimasMovimentacoes } from "./UltimasMovimentacoes";
import { Abas, Cabecalho, Indicador, Painel } from "./ui";

const config = {
  quebras: {
    titulo: "Apontamento de Quebras",
    descricao: "Retira pallets danificados da conta corrente principal (pulmão) e os envia ao estoque de avariados.",
    acao: registrarQuebra,
    botao: "Registrar quebra",
    classe: "btn-danger w-full",
    tipo: "QUEBRA",
    obsObrigatoria: true,
    rotuloObs: "Observação (motivo da quebra) *",
  },
  recuperados: {
    titulo: "Apontamento de Recuperados",
    descricao: "Retorna pallets avariados que foram recuperados para a conta corrente principal (pulmão).",
    acao: registrarRecuperado,
    botao: "Registrar recuperação",
    classe: "btn-success w-full",
    tipo: "RECUPERADO",
    obsObrigatoria: false,
    rotuloObs: "Observação",
  },
  descarte: {
    titulo: "Descarte de Pallets",
    descricao: "Baixa definitiva de pallets avariados irrecuperáveis. Esta operação não pode ser desfeita.",
    acao: registrarDescarte,
    botao: "Confirmar descarte",
    classe: "btn-danger w-full",
    tipo: "DESCARTE",
    obsObrigatoria: true,
    rotuloObs: "Justificativa do descarte *",
  },
} as const;

export async function PaginaAvaria({ modo }: { modo: keyof typeof config }) {
  const c = config[modo];
  const saldos = await obterSaldos();

  return (
    <>
      <Cabecalho titulo={c.titulo} descricao={c.descricao} />
      <Abas
        ativo={`/avarias/${modo}`}
        itens={[
          { href: "/avarias/quebras", rotulo: "Quebras" },
          { href: "/avarias/recuperados", rotulo: "Recuperados" },
          { href: "/avarias/descarte", rotulo: "Descarte" },
        ]}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Indicador titulo="Saldo no pulmão" valor={formatarNumero(saldos.pulmao)} icone={<Boxes className="h-6 w-6" />} />
        <Indicador
          titulo="Estoque de avariados"
          valor={formatarNumero(saldos.avaria)}
          detalhe="aguardando recuperação ou descarte"
          cor="erro"
          icone={<Hammer className="h-6 w-6" />}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo="Novo apontamento">
          <FormAcao
            acao={c.acao}
            botao={c.botao}
            classeBotao={c.classe}
            confirmar={modo === "descarte" ? "Confirmar o descarte definitivo destes pallets?" : undefined}
          >
            <div>
              <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
              <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="observacao">{c.rotuloObs}</label>
              <textarea
                id="observacao"
                name="observacao"
                rows={3}
                className="input"
                required={c.obsObrigatoria}
                minLength={c.obsObrigatoria ? 5 : undefined}
                maxLength={500}
              />
            </div>
          </FormAcao>
        </Painel>
        <div className="lg:col-span-2">
          <UltimasMovimentacoes tipos={[c.tipo]} titulo="Últimos apontamentos" />
        </div>
      </div>
    </>
  );
}
