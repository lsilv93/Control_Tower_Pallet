import { FluxoCompra } from "@/components/FluxoCompra";
import { Fluxo, SaldosEstoques } from "@/components/Contas";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Cabecalho, Painel } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Compra de Pallets" };

export default async function CompraPalletsPage() {
  await requirePermissao("compras");
  const fornecedores = await prisma.fornecedor.findMany({ where: { ativo: true }, select: { cnpj: true } });

  return (
    <>
      <Cabecalho
        titulo="Compra de Pallets"
        descricao="Entrada de pallets novos pela leitura do código de barras da NF-e. Destino: Estoque de Vazios."
      />
      <SaldosEstoques destaque={["VAZIOS"]} />
      <Painel titulo={<span className="flex items-center gap-3">Compra <Fluxo origem="COMPRA" destino="VAZIOS" /></span>}>
        <FluxoCompra cnpjsCadastrados={fornecedores.map((f) => f.cnpj)} />
      </Painel>
      <div className="mt-6">
        <UltimasMovimentacoes tipos={["COMPRA"]} titulo="Últimas compras" />
      </div>
    </>
  );
}
