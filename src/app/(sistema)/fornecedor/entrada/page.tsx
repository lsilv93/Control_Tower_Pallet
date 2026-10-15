import { requirePermissao } from "@/lib/auth";
import { FormRecebimento } from "@/components/FormRecebimento";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { SaldosEstoques } from "@/components/Contas";
import { Cabecalho, Painel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Recebimento de Pallets" };

export default async function EntradaFornecedorPage() {
  const usuario = await requirePermissao("entrada");
  const transportadoras = await prisma.transportadora.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });

  return (
    <>
      <Cabecalho
        titulo="Recebimento de Pallets"
        descricao={`Bipe o código de barras da NF-e (ou use a opção Sem Nota Fiscal). Gera o Vale-Pallet de Fornecedor e sobe o saldo de ${usuario.cd.codigo} com o fornecedor (pendente de devolução/pagamento). Os vazios só saem na baixa/pagamento.`}
      />
      <SaldosEstoques cdId={usuario.cd.id} destaque={["FORNECEDOR"]} />
      <Painel titulo="Recebimento de pallets">
        <FormRecebimento transportadoras={transportadoras.map((t) => t.nome)} conferentePadrao={usuario.nome} />
      </Painel>
      <div className="mt-6">
        <UltimasMovimentacoes cdId={usuario.cd.id} tipos={["RECEBIMENTO_FORNECEDOR"]} titulo="Últimos recebimentos de fornecedor" />
      </div>
    </>
  );
}
