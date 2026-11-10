import Link from "next/link";
import { FormEnvio } from "@/components/FormEnvio";
import { SaldosEstoques } from "@/components/Contas";
import { UltimasMovimentacoes } from "@/components/UltimasMovimentacoes";
import { Abas, Cabecalho, Painel, Tabela, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { obterSaldos } from "@/lib/conta";
import { acumuladoresEnvio } from "@/lib/consultas";
import { formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, numeroVale } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Envio de Pallets" };

const MODOS = {
  CROSS: { rotulo: "Enviar para Ponto de Cross", descricao: "Gera o Vale-Pallet de Envio para um Ponto de Cross vinculado a esta unidade. Não exige nem consome o estoque do CD: soma no total enviado para Cross." },
  CD: { rotulo: "Enviar para CD", descricao: "Gera o Vale-Pallet de Envio para outro CD (ex.: CDJC devolvendo Pallets PBR às filiais)." },
  HUB: { rotulo: "Pallets Quebrados para o CDJC", descricao: "Gera o Vale de Pallets Quebrados para conserto no CD Hub (CDJC)." },
} as const;
// Ponto de Cross: um único fluxo, o retorno aos CDs vinculados.
const RETORNO_CROSS = { rotulo: "Retorno ao CD", descricao: "Devolve Pallets PBR e Pallets Quebrados a um dos CDs vinculados a este Ponto de Cross." };

/** Envio de pallets: sai do estoque da unidade e fica em trânsito até a conferência no destino. */
export default async function EnvioPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const u = await requirePermissao("envio");
  const pedido = (await searchParams).modo?.toUpperCase();
  // Ponto de Cross: só o retorno aos CDs vinculados. O Hub não envia quebrados para si mesmo.
  const ehCross = u.cd.tipo === "CROSS";
  const disponiveis = (ehCross ? ["CD"] : u.cd.hub ? ["CROSS", "CD"] : ["CROSS", "CD", "HUB"]) as (keyof typeof MODOS)[];
  const modo = disponiveis.includes(pedido as keyof typeof MODOS) ? (pedido as keyof typeof MODOS) : disponiveis[0];
  const [destinos, transportadoras, acumulado, saldos, pendentes] = await Promise.all([
    prisma.centroDistribuicao.findMany({
      where: {
        ativo: true,
        id: { not: u.cd.id },
        // Cross ↔ CD somente com vínculo cadastrado (um Cross pode atender vários CDs).
        ...(ehCross
          ? { tipo: "CD" as const, crossesAtendidos: { some: { crossId: u.cd.id } } }
          : modo === "CROSS"
            ? { tipo: "CROSS" as const, cdsAtendidos: { some: { cdId: u.cd.id } } }
            : modo === "HUB"
              ? { hub: true }
              : { tipo: "CD" as const }),
      },
      select: { id: true, codigo: true, nome: true, tipo: true, hub: true },
      orderBy: [{ hub: "desc" }, { codigo: "asc" }],
    }),
    prisma.transportadora.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    acumuladoresEnvio(u.cd.id),
    obterSaldos(u.cd.id),
    prisma.valePallet.findMany({
      where: { cdId: u.cd.id, tipo: "ENVIO", status: "PENDENTE" },
      include: { unidade: true },
      orderBy: { criadoEm: "desc" },
      take: 20,
    }),
  ]);

  const info = ehCross ? RETORNO_CROSS : MODOS[modo];
  return (
    <>
      <Cabecalho titulo={ehCross ? "Retorno de Pallets ao CD" : "Envio de Pallets"} descricao={`${info.descricao} ${modo === "CROSS" && !ehCross ? "" : `Os pallets saem do estoque de ${u.cd.codigo} (bloqueado se não houver saldo) e `}ficam em trânsito até a conferência no destino.`} />
      {disponiveis.length > 1 && <Abas ativo={`/envio?modo=${modo.toLowerCase()}`} itens={disponiveis.map((m) => ({ href: `/envio?modo=${m.toLowerCase()}`, rotulo: MODOS[m].rotulo }))} />}
      <SaldosEstoques cdId={u.cd.id} destaque={modo === "HUB" ? ["QUEBRADOS"] : ["VAZIOS", "TRANSITO"]} />
      {!ehCross && (
        <div className="-mt-2 mb-6 grid grid-cols-2 gap-3 sm:gap-4" data-testid="acumuladores-envio">
          <div className="card-sm p-4 sm:p-5">
            <p className="label !mb-0.5">Total de Pallets Enviados para Cross</p>
            <p className="num text-[22px] font-semibold text-t1 sm:text-[26px]" data-testid="total-enviado-cross">{n(acumulado.paraCross)}</p>
            <p className="text-[11px] text-t4">remessas sem consumo do estoque</p>
          </div>
          <div className="card-sm p-4 sm:p-5">
            <p className="label !mb-0.5">Total de Pallets Enviados para CDs</p>
            <p className="num text-[22px] font-semibold text-t1 sm:text-[26px]" data-testid="total-enviado-cds">{n(acumulado.paraCds)}</p>
            <p className="text-[11px] text-t4">saem do estoque de {u.cd.codigo}</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo={info.rotulo} className="lg:col-span-2">
          {destinos.length === 0 ? (
            <Vazio>
              {ehCross
                ? `Nenhum CD vinculado a ${u.cd.codigo}. Peça a um administrador para vincular os CDs em Cadastros → Pontos de Cross.`
                : modo === "HUB"
                  ? "Nenhum CD Hub cadastrado."
                  : modo === "CROSS"
                    ? `Nenhum Ponto de Cross ativo vinculado a ${u.cd.codigo}. Vincule em Cadastros → Pontos de Cross.`
                    : "Nenhum CD ativo disponível."}
            </Vazio>
          ) : transportadoras.length === 0 ? (
            <p className="poco-erro px-4 py-3 text-[12px] text-erro-claro">
              Nenhuma transportadora cadastrada.{" "}
              <Link href="/cadastros/transportadoras" className="font-semibold underline">Cadastrar transportadora</Link>
            </p>
          ) : (
            <FormEnvio key={modo} modo={modo} destinos={destinos} transportadoras={transportadoras} saldo={{ vazios: saldos.vazios, quebrados: saldos.quebrados }} origem={u.cd.codigo} retorno={ehCross} consomeEstoque={!(modo === "CROSS" && !ehCross)} />
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
