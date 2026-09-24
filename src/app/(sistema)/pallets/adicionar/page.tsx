import { ClipboardPen, ScanBarcode } from "lucide-react";
import { ajustarInventario } from "@/actions/pallets";
import { FluxoCompra } from "@/components/FluxoCompra";
import { FormAcao } from "@/components/FormAcao";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Abas, Cabecalho, Indicador, Painel } from "@/components/ui";
import { requirePermissaoPallets } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { formatarNumero } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Adicionar Pallets" };

export default async function AdicionarPalletsPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  await requirePermissaoPallets();
  const { modo: m } = await searchParams;
  const modo = m === "ajuste" ? "ajuste" : "compra";
  const [saldos, fornecedores] = await Promise.all([
    obterSaldos(),
    prisma.fornecedor.findMany({ where: { ativo: true }, select: { cnpj: true } }),
  ]);

  return (
    <>
      <Cabecalho
        titulo="Adicionar Pallets"
        descricao="Injeta novos pallets na operação por compra (leitura da NF-e) ou por ajuste de inventário. Acesso restrito; toda inclusão registra data, hora e usuário."
      />
      <Abas
        ativo={`/pallets/adicionar?modo=${modo}`}
        itens={[
          { href: "/pallets/adicionar?modo=compra", rotulo: "Compra", icone: <ScanBarcode className="h-4 w-4" /> },
          { href: "/pallets/adicionar?modo=ajuste", rotulo: "Ajuste de Inventário", icone: <ClipboardPen className="h-4 w-4" /> },
        ]}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {modo === "compra" ? (
            <Painel titulo="Compra de pallets">
              <FluxoCompra cnpjsCadastrados={fornecedores.map((f) => f.cnpj)} />
            </Painel>
          ) : (
            <Painel titulo="Ajuste de inventário (inclusão manual)">
              <FormAcao acao={ajustarInventario} botao="Registrar ajuste" confirmar="Confirmar a inclusão destes pallets no pulmão?">
                <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                  <div>
                    <label className="label" htmlFor="quantidade">Quantidade *</label>
                    <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
                  </div>
                  <div>
                    <label className="label" htmlFor="motivo">Motivo do ajuste *</label>
                    <input id="motivo" name="motivo" className="input" required minLength={5} maxLength={500} placeholder="Ex.: contagem física de 24/09" />
                  </div>
                </div>
              </FormAcao>
            </Painel>
          )}
        </div>
        <Indicador titulo="Saldo atual no pulmão" valor={formatarNumero(saldos.pulmao)} destaque />
      </div>
      <div className="mt-6">
        <UltimasMovimentacoes
          tipos={modo === "compra" ? ["COMPRA"] : ["AJUSTE_ENTRADA", "AJUSTE_SAIDA"]}
          titulo={modo === "compra" ? "Últimas compras" : "Últimos ajustes"}
        />
      </div>
    </>
  );
}
