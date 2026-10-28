import Link from "next/link";
import { FormEnvio } from "@/components/FormEnvio";
import { SaldosEstoques } from "@/components/Contas";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Abas, Cabecalho, Painel, Tabela, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, numeroVale } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Envio de Pallets" };

const MODOS = {
  CROSS: { rotulo: "Enviar para Ponto de Cross", descricao: "Gera o Vale-Pallet de Envio para um Ponto de Cross." },
  CD: { rotulo: "Enviar para CD", descricao: "Gera o Vale-Pallet de Envio para outro CD (ex.: CDJC devolvendo Pallets PBR às filiais)." },
  HUB: { rotulo: "Pallets Quebrados para o CDJC", descricao: "Gera o Vale de Pallets Quebrados para conserto no CD Hub (CDJC)." },
} as const;

/** Envio de pallets: sai do estoque da unidade e fica em trânsito até a conferência no destino. */
export default async function EnvioPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const u = await requirePermissao("envio");
  const pedido = (await searchParams).modo?.toUpperCase();
  // Ponto de Cross envia somente para CDs (retorno); o Hub não envia quebrados para si mesmo.
  const disponiveis = (u.cd.tipo === "CROSS" ? ["CD", "HUB"] : u.cd.hub ? ["CROSS", "CD"] : ["CROSS", "CD", "HUB"]) as (keyof typeof MODOS)[];
  const modo = disponiveis.includes(pedido as keyof typeof MODOS) ? (pedido as keyof typeof MODOS) : disponiveis[0];
  const [destinos, transportadoras, saldos, pendentes] = await Promise.all([
    prisma.centroDistribuicao.findMany({
      where: {
        ativo: true,
        id: { not: u.cd.id },
        ...(modo === "CROSS" ? { tipo: "CROSS" as const } : modo === "HUB" ? { hub: true } : { tipo: "CD" as const }),
      },
      select: { id: true, codigo: true, nome: true, tipo: true, hub: true },
      orderBy: [{ hub: "desc" }, { codigo: "asc" }],
    }),
    prisma.transportadora.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    obterSaldos(u.cd.id),
    prisma.valePallet.findMany({
      where: { cdId: u.cd.id, tipo: "ENVIO", status: "PENDENTE" },
      include: { unidade: true },
      orderBy: { criadoEm: "desc" },
      take: 20,
    }),
  ]);

  return (
    <>
      <Cabecalho titulo="Envio de Pallets" descricao={`${MODOS[modo].descricao} Os pallets saem do estoque de ${u.cd.codigo} (bloqueado se não houver saldo) e ficam em trânsito até a conferência no destino.`} />
      <Abas ativo={`/envio?modo=${modo.toLowerCase()}`} itens={disponiveis.map((m) => ({ href: `/envio?modo=${m.toLowerCase()}`, rotulo: MODOS[m].rotulo }))} />
      <SaldosEstoques cdId={u.cd.id} destaque={modo === "HUB" ? ["QUEBRADOS"] : ["VAZIOS", "TRANSITO"]} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo={MODOS[modo].rotulo} className="lg:col-span-2">
          {destinos.length === 0 ? (
            <Vazio>{modo === "HUB" ? "Nenhum CD Hub cadastrado." : `Nenhum ${modo === "CROSS" ? "Ponto de Cross" : "CD"} ativo disponível.`}</Vazio>
          ) : transportadoras.length === 0 ? (
            <p className="poco-erro px-4 py-3 text-[12px] text-erro-claro">
              Nenhuma transportadora cadastrada.{" "}
              <Link href="/cadastros/transportadoras" className="font-semibold underline">Cadastrar transportadora</Link>
            </p>
          ) : (
            <FormEnvio key={modo} modo={modo} destinos={destinos} transportadoras={transportadoras} saldo={{ vazios: saldos.vazios, quebrados: saldos.quebrados }} origem={u.cd.codigo} />
          )}
        </Painel>
        <div className="space-y-6 lg:col-span-3">
          <Painel titulo="Enviados em trânsito (aguardando conferência no destino)">
            {pendentes.length === 0 ? (
              <Vazio>Nenhum envio em trânsito.</Vazio>
            ) : (
              <Tabela>
                <table className="tabela" data-testid="envios-transito">
                  <thead><tr><th>Vale</th><th>Destino</th><th className="text-right">Pallets PBR</th><th className="text-right">Pallets Quebrados</th><th>Emissão</th></tr></thead>
                  <tbody>
                    {pendentes.map((v) => (
                      <tr key={v.id}>
                        <td><Link prefetch={false} href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{numeroVale(v.numero, v.tipo)}</Link></td>
                        <td>{v.unidade ? `${v.unidade.codigo} - ${v.unidade.nome}` : "—"}</td>
                        <td className="num text-right">{n(v.quantidadeBons)}</td>
                        <td className="num text-right">{n(v.quantidadeQuebrados)}</td>
                        <td className="num">{formatarDataHora(v.criadoEm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Tabela>
            )}
          </Painel>
          <UltimasMovimentacoes cdId={u.cd.id} tipos={["ENVIO", "BAIXA_TRANSITO", "ESTORNO_ENVIO"]} titulo="Últimos envios" />
        </div>
      </div>
    </>
  );
}
