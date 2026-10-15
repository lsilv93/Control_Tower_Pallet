import Link from "next/link";
import { incluirVazios } from "@/actions/pallets";
import { AbasAjustes } from "@/components/AbasAjustes";
import { SaldosEstoques } from "@/components/Contas";
import { FormAcao } from "@/components/FormAcao";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Cabecalho, Painel } from "@/components/ui";
import { requireAdminCD } from "@/lib/auth";
import { MOTIVOS_INCLUSAO } from "@/lib/formatos";
import { ehMaster } from "@/lib/permissoes";

export const metadata = { title: "Inclusão de Vazios" };

export default async function InclusaoVaziosPage() {
  const u = await requireAdminCD();
  return (
    <>
      <Cabecalho
        titulo="Inclusão Manual de Vazios (Admin)"
        descricao={`Sobe o pulmão de vazios de ${u.cd.codigo}. Motivo e observação são obrigatórios e ficam na Auditoria.`}
      />
      <AbasAjustes ativo="/estoque/vazios" master={ehMaster(u)} />
      <SaldosEstoques cdId={u.cd.id} destaque={["VAZIOS"]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo="Nova inclusão">
          <p className="poco mb-4 px-4 py-3 text-[11px] text-t3">
            Devolução de CD ou Ponto de Cross deve ser lançada na{" "}
            <Link href="/retorno" className="font-semibold text-lima hover:underline">conferência de retorno</Link>, que também baixa o saldo devedor.
          </p>
          <FormAcao acao={incluirVazios} botao="Incluir vazios" confirmar="Confirmar a inclusão manual de vazios? A operação fica registrada na Auditoria.">
            <div>
              <label className="label" htmlFor="motivo">Motivo *</label>
              <select id="motivo" name="motivo" className="input" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {Object.entries(MOTIVOS_INCLUSAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quantidade">Quantidade *</label>
              <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="observacao">Observação / detalhamento *</label>
              <textarea id="observacao" name="observacao" rows={3} className="input" required minLength={10} maxLength={500} placeholder="Ex.: NF 1234 da compra de 100 pallets novos..." />
            </div>
          </FormAcao>
        </Painel>
        <div className="xl:col-span-2">
          <UltimasMovimentacoes cdId={u.cd.id} tipos={["INCLUSAO_VAZIOS"]} titulo="Últimas inclusões de vazios" />
        </div>
      </div>
    </>
  );
}
