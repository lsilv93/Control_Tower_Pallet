import { ajustarInventario } from "@/actions/pallets";
import { SaldosEstoques } from "@/components/Contas";
import { FormAcao } from "@/components/FormAcao";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { AbasAjustes } from "@/components/AbasAjustes";
import { Cabecalho, Painel } from "@/components/ui";
import { requireMaster } from "@/lib/auth";

export const metadata = { title: "Correção de Inventário" };

export default async function AjusteManualPage() {
  const u = await requireMaster();
  return (
    <>
      <Cabecalho
        titulo="Correção de Inventário (Master)"
        descricao={`Exclusivo do usuário MASTER. Inclui ou remove saldo do Estoque de Vazios ou de Quebrados de ${u.cd.codigo} (contrapartida: conta AJUSTE). A justificativa é obrigatória e fica registrada na Auditoria.`}
      />
      <AbasAjustes ativo="/estoque/ajuste" master />
      <SaldosEstoques cdId={u.cd.id} destaque={["VAZIOS", "QUEBRADOS"]} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo="Nova correção">
          <FormAcao
            acao={ajustarInventario}
            botao="Registrar correção"
            confirmar="Confirmar a correção de inventário? A operação fica registrada na Auditoria."
          >
            <div>
              <label className="label" htmlFor="estoque">Estoque *</label>
              <select id="estoque" name="estoque" className="input" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                <option value="VAZIOS">Estoque de Vazios</option>
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
          <UltimasMovimentacoes cdId={u.cd.id} tipos={["AJUSTE_ENTRADA", "AJUSTE_SAIDA"]} titulo="Últimas correções de inventário" />
        </div>
      </div>
    </>
  );
}
