import { requireModuloFornecedor } from "@/lib/auth";
import { FormRecebimento } from "@/components/FormRecebimento";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { SaldosEstoques } from "@/components/Contas";
import { Cabecalho, Painel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Recebimento Pallet Fornecedor" };

export default async function EntradaFornecedorPage() {
  const usuario = await requireModuloFornecedor();
  const [transportadoras, fornecedores] = await Promise.all([
    prisma.transportadora.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.fornecedor.findMany({ where: { ativo: true }, select: { id: true, sigla: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Recebimento Pallet Fornecedor"
        descricao={`Bipe o código de barras da NF-e (ou use a opção Sem Nota Fiscal). Gera o Vale-Pallet de Fornecedor e sobe o saldo de ${usuario.cd.codigo} com o fornecedor (pendente de devolução/pagamento). Os Pallets PBR só saem na baixa/pagamento.`}
      />
      <SaldosEstoques cdId={usuario.cd.id} />
      <Painel titulo="Recebimento pallet fornecedor">
        <FormRecebimento transportadoras={transportadoras} fornecedores={fornecedores} conferentePadrao={usuario.nome} />
      </Painel>
      <div className="mt-6">
        <UltimasMovimentacoes cdId={usuario.cd.id} tipos={["RECEBIMENTO_FORNECEDOR"]} titulo="Últimos recebimentos de fornecedor" />
      </div>
    </>
  );
}
