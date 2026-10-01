import { ajustarInventario } from "@/actions/pallets";
import { SaldosEstoques } from "@/components/Contas";
import { FormAcao } from "@/components/FormAcao";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Cabecalho, Painel } from "@/components/ui";
import { requireMaster } from "@/lib/auth";

export const metadata = { title: "Ajuste Manual de Estoque" };

export default async function AjusteManualPage() {
  await requireMaster();
  return (
    <>
      <Cabecalho
        titulo="Ajuste Manual de Estoque"
        descricao="Exclusivo do usuário MASTER. Inclui ou remove saldo de um estoque com a conta AJUSTE como contrapartida. A justificativa é obrigatória e fica registrada na Auditoria."
      />
      <SaldosEstoques />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo="Novo ajuste">
          <FormAcao
            acao={ajustarInventario}
            botao="Registrar ajuste"
            confirmar="Confirmar o ajuste manual de saldo? A operação fica registrada na Auditoria."
          >
            <div>
              <label className="label" htmlFor="estoque">Estoque *</label>
              <select id="estoque" name="estoque" className="input" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                <option value="VAZIOS">Estoque de Vazios</option>
                <option value="CD">Estoque do CD</option>
                <option value="QUEBRADOS">Estoque de Quebrados</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="sentido">Operação *</label>
                <select id="sentido" name="sentido" className="input" required defaultValue="INCLUIR">
                  <option value="INCLUIR">Incluir (+)</option>
                  <option value="REMOVER">Remover (−)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="quantidade">Quantidade *</label>
                <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="justificativa">Justificativa *</label>
              <textarea id="justificativa" name="justificativa" rows={3} className="input" required minLength={10} maxLength={500} placeholder="Ex.: inventário físico de 01/10 encontrou divergência de..." />
            </div>
          </FormAcao>
        </Painel>
        <div className="xl:col-span-2">
          <UltimasMovimentacoes tipos={["AJUSTE_ENTRADA", "AJUSTE_SAIDA"]} titulo="Últimos ajustes manuais" />
        </div>
      </div>
    </>
  );
}
