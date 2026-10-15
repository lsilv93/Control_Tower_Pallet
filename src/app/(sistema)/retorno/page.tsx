import Link from "next/link";
import { BannerOk } from "@/components/Cadastro";
import { SaldosEstoques } from "@/components/Contas";
import { FormRetorno } from "@/components/FormRetorno";
import { SaldosDevedores } from "@/components/SaldosDevedores";
import { Abas, Cabecalho, Painel, Tabela, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { valesDevedoresPendentes } from "@/lib/consultas";
import { formatarData, formatarDataHora } from "@/lib/datas";
import { formatarNumero as n, formatarPlaca, numeroRetorno, numeroVale, rotuloTipoVale } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Retorno / Conferência" };

export default async function RetornoPage({ searchParams }: { searchParams: Promise<{ ok?: string; unidade?: string }> }) {
  const u = await requirePermissao("cd");
  const { ok, unidade } = await searchParams;
  const [vales, retornos] = await Promise.all([
    valesDevedoresPendentes(u.cd.id),
    prisma.retornoConferencia.findMany({
      where: { cdId: u.cd.id },
      include: { unidade: true, usuario: { select: { login: true } }, ocorrencia: { select: { id: true, numero: true } }, _count: { select: { vales: true } } },
      orderBy: { criadoEm: "desc" },
      take: 15,
    }),
  ]);
  const unidades = [...new Map(vales.filter((v) => v.unidade).map((v) => [v.unidade!.id, v.unidade!])).values()].sort((a, b) => a.codigo.localeCompare(b.codigo));

  return (
    <>
      <Cabecalho
        titulo="Retorno / Conferência de CD e Ponto de Cross"
        descricao={`Selecione os vales devolvidos e informe a contagem física. A quantidade física soma no Estoque de Vazios de ${u.cd.codigo} e baixa o saldo devedor; uma falta gera automaticamente um Vale-Ocorrência com a diferença.`}
      />
      <Abas
        ativo="/retorno"
        itens={[
          { href: "/cd/envio", rotulo: "Envio para CD" },
          { href: "/cross/envio", rotulo: "Envio para Ponto de Cross" },
          { href: "/retorno", rotulo: "Retorno / Conferência" },
        ]}
      />
      <BannerOk mensagem={ok} />
      <SaldosEstoques cdId={u.cd.id} destaque={["VAZIOS", "CUSTODIA"]} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Painel titulo="Nova conferência de retorno" className="lg:col-span-2">
          {unidades.length === 0 ? (
            <Vazio>Nenhum vale de envio pendente neste CD.</Vazio>
          ) : (
            <FormRetorno
              unidades={unidades}
              unidadeInicial={unidade}
              vales={vales.map((v) => ({
                id: v.id,
                codigo: numeroVale(v.numero, v.tipo),
                unidadeId: v.unidadeId!,
                quantidade: v.quantidade,
                tipoRotulo: rotuloTipoVale[v.tipo],
                data: formatarData(v.criadoEm),
                transportadora: v.transportadora,
              }))}
            />
          )}
        </Painel>
        <div className="space-y-6 lg:col-span-3">
          <SaldosDevedores cdId={u.cd.id} />
          <Painel titulo="Últimas conferências de retorno">
            {retornos.length === 0 ? (
              <Vazio>Nenhuma conferência registrada.</Vazio>
            ) : (
              <Tabela>
                <table className="tabela">
                  <thead>
                    <tr><th>Conferência</th><th>Data/Hora</th><th>Remetente</th><th className="text-right">Vales</th><th className="text-right">Físico</th><th>Divergência</th><th>Usuário</th></tr>
                  </thead>
                  <tbody>
                    {retornos.map((r) => (
                      <tr key={r.id}>
                        <td className="num font-semibold text-t1">{numeroRetorno(r.numero)}</td>
                        <td className="tabular-nums">{formatarDataHora(r.criadoEm)}</td>
                        <td>{r.unidade.codigo}</td>
                        <td className="num text-right">{n(r.totalVales)} <span className="text-[11px] text-t4">({r._count.vales})</span></td>
                        <td className="num text-right font-semibold text-lima">{n(r.quantidadeFisica)}</td>
                        <td>
                          {r.falta > 0 && r.ocorrencia ? (
                            <Link prefetch={false} href={`/vales/${r.ocorrencia.id}`} className="font-semibold text-erro hover:underline">
                              Falta {n(r.falta)} · {numeroVale(r.ocorrencia.numero, "OCORRENCIA")}
                            </Link>
                          ) : (
                            <span className="text-t3">Sem divergência</span>
                          )}
                          {r.placa && <span className="block text-[11px] text-t4">{formatarPlaca(r.placa)}{r.transportadora ? ` · ${r.transportadora}` : ""}</span>}
                        </td>
                        <td>{r.usuario.login}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Tabela>
            )}
          </Painel>
        </div>
      </div>
    </>
  );
}
