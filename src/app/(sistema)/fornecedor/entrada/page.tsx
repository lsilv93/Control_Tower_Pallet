import { registrarRecebimentoFornecedor } from "@/actions/fornecedor";
import { CamposFornecedor } from "@/components/CamposFornecedor";
import { FormAcao } from "@/components/FormAcao";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Cabecalho, Painel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Entrada de Fornecedor" };

export default async function EntradaFornecedorPage() {
  const [fornecedores, transportadoras] = await Promise.all([
    prisma.fornecedor.findMany({ where: { ativo: true }, select: { cnpj: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.transportadora.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Recebimento de Fornecedor"
        descricao="Registra a entrada de pallets no pulmão e gera automaticamente o Vale-Pallet (impressão A4 em 2 vias)."
      />
      <Painel titulo="Dados do recebimento">
        <FormAcao acao={registrarRecebimentoFornecedor} botao="Salvar e gerar Vale-Pallet" limpar={false}>
          <div className="grid gap-4 md:grid-cols-2">
            <CamposFornecedor fornecedores={fornecedores} />
            <div>
              <label className="label" htmlFor="transportadora">Transportadora *</label>
              <input id="transportadora" name="transportadora" className="input" required maxLength={200} list="lista-transportadoras" autoComplete="off" />
              <datalist id="lista-transportadoras">
                {transportadoras.map((t) => (
                  <option key={t.id} value={t.nome} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="label" htmlFor="placa">Placa do veículo *</label>
              <input
                id="placa"
                name="placa"
                className="input uppercase"
                required
                placeholder="ABC1D23"
                maxLength={8}
                pattern="[A-Za-z]{3}-?[0-9][A-Za-z0-9][0-9]{2}"
                title="Placa no formato ABC1234 ou ABC1D23"
              />
            </div>
            <div>
              <label className="label" htmlFor="notaFiscal">Número da Nota Fiscal *</label>
              <input id="notaFiscal" name="notaFiscal" className="input" required maxLength={50} />
            </div>
            <div>
              <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
              <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
            </div>
            <div className="md:col-span-2">
              <label className="label" htmlFor="observacao">Observação</label>
              <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} />
            </div>
          </div>
        </FormAcao>
      </Painel>
      <div className="mt-6">
        <UltimasMovimentacoes tipos={["RECEBIMENTO_FORNECEDOR"]} titulo="Últimos recebimentos de fornecedor" />
      </div>
    </>
  );
}
