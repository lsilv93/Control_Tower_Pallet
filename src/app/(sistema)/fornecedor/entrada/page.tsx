import { requirePermissao } from "@/lib/auth";
import { FormRecebimento } from "@/components/FormRecebimento";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
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
        descricao="Bipe o código de barras da NF-e (ou use a opção Sem Nota Fiscal). Fornecedor → Estoque do CD (soma) e o Vale-Pallet é gerado automaticamente."
      />
      <Painel titulo="Recebimento de pallets">
        <FormRecebimento transportadoras={transportadoras.map((t) => t.nome)} conferentePadrao={usuario.nome} />
      </Painel>
      <div className="mt-6">
        <UltimasMovimentacoes tipos={["RECEBIMENTO_FORNECEDOR"]} titulo="Últimos recebimentos de fornecedor" />
      </div>
    </>
  );
}
