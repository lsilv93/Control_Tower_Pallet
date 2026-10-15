import { incluirSaldoDevedor } from "@/actions/pallets";
import { AbasAjustes } from "@/components/AbasAjustes";
import { FormAcao } from "@/components/FormAcao";
import { SaldosDevedores } from "@/components/SaldosDevedores";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Cabecalho, Painel } from "@/components/ui";
import { requireAdminCD } from "@/lib/auth";
import { rotuloTipoUnidade } from "@/lib/formatos";
import { ehMaster } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Saldo Devedor" };

export default async function SaldoDevedorPage() {
  const u = await requireAdminCD();
  const unidades = await prisma.centroDistribuicao.findMany({
    where: { ativo: true, id: { not: u.cd.id } },
    orderBy: [{ tipo: "asc" }, { codigo: "asc" }],
  });
  return (
    <>
      <Cabecalho
        titulo="Inclusão Manual de Saldo Devedor (Admin)"
        descricao={`Inclui saldo devedor de um CD destino ou Ponto de Cross com ${u.cd.codigo}. Gera um Vale de Ajuste pendente, baixado na conferência de retorno. Para reduzir, exclua o vale em Excluir Vale.`}
      />
      <AbasAjustes ativo="/estoque/devedor" master={ehMaster(u)} />
      <div className="grid gap-6 xl:grid-cols-3">
        <Painel titulo="Nova inclusão de saldo devedor">
          <FormAcao acao={incluirSaldoDevedor} botao="Incluir saldo devedor" confirmar="Confirmar a inclusão de saldo devedor? A operação fica registrada na Auditoria.">
            <div>
              <label className="label" htmlFor="unidadeId">CD / Ponto de Cross *</label>
              <select id="unidadeId" name="unidadeId" className="input" required defaultValue="">
                <option value="" disabled>Selecione...</option>
                {unidades.map((x) => (
                  <option key={x.id} value={x.id}>{rotuloTipoUnidade[x.tipo]} · {x.codigo} - {x.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="quantidade">Quantidade *</label>
              <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="observacao">Observação *</label>
              <textarea id="observacao" name="observacao" rows={2} className="input" required minLength={5} maxLength={500} />
            </div>
            <div>
              <label className="label" htmlFor="justificativa">Justificativa *</label>
              <textarea id="justificativa" name="justificativa" rows={3} className="input" required minLength={10} maxLength={500} />
            </div>
          </FormAcao>
        </Painel>
        <div className="space-y-6 xl:col-span-2">
          <SaldosDevedores cdId={u.cd.id} />
          <UltimasMovimentacoes cdId={u.cd.id} tipos={["INCLUSAO_DEVEDOR", "ESTORNO_ENVIO", "MIGRACAO_CUSTODIA"]} titulo="Últimos ajustes de saldo devedor" />
        </div>
      </div>
    </>
  );
}
