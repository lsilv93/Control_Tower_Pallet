import Link from "next/link";
import { enviarParaUnidade } from "@/actions/unidades";
import { FormAcao } from "./FormAcao";
import { InputPlaca } from "./InputPlaca";
import { SaldosDevedores } from "./SaldosDevedores";
import { UltimasMovimentacoes } from "./UltimasMovimentacoes";
import { Abas, Cabecalho, Painel } from "./ui";
import { requirePermissao } from "@/lib/auth";
import { SaldosEstoques } from "./Contas";
import { prisma } from "@/lib/prisma";

const config = {
  CD: { titulo: "Envio para CD", rotulo: "CD destino", rota: "/cd/envio", cadastro: "/cadastros/cds" },
  CROSS: { titulo: "Envio para Ponto de Cross", rotulo: "Ponto de Cross", rota: "/cross/envio", cadastro: "/cadastros/cross" },
} as const;

/**
 * Envio para CD / Ponto de Cross: gera o Vale-Pallet de Envio. Não subtrai do Estoque
 * de Vazios — só aumenta o saldo devedor e os vales pendentes do destino.
 */
export async function PaginaEnvio({ tipo }: { tipo: "CD" | "CROSS" }) {
  const u = await requirePermissao("cd");
  const c = config[tipo];
  const [destinos, transportadoras] = await Promise.all([
    prisma.centroDistribuicao.findMany({ where: { ativo: true, tipo, id: { not: u.cd.id } }, orderBy: { codigo: "asc" } }),
    prisma.transportadora.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <>
      <Cabecalho
        titulo={c.titulo}
        descricao={`Gera o Vale-Pallet de Envio a partir do CD ${u.cd.codigo}. O Estoque de Vazios NÃO é alterado no envio: a quantidade soma no saldo devedor do destino e volta aos Vazios na conferência de retorno.`}
      />
      <Abas
        ativo={c.rota}
        itens={[
          { href: "/cd/envio", rotulo: "Envio para CD" },
          { href: "/cross/envio", rotulo: "Envio para Ponto de Cross" },
          { href: "/retorno", rotulo: "Retorno / Conferência" },
        ]}
      />
      <SaldosEstoques cdId={u.cd.id} destaque={["CUSTODIA"]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo="Novo envio">
          {destinos.length === 0 ? (
            <p className="text-[12px] text-t2">
              Nenhum {tipo === "CD" ? "outro CD" : "Ponto de Cross"} ativo cadastrado.{" "}
              <Link href={c.cadastro} className="font-semibold text-lima hover:underline">Cadastrar</Link>
            </p>
          ) : (
            <FormAcao acao={enviarParaUnidade} botao={transportadoras.length ? "Gerar Vale de Envio" : undefined} classeBotao="btn-primary w-full" limpar={false}>
              <input type="hidden" name="tipoDestino" value={tipo} />
              <div>
                <label className="label" htmlFor="unidadeId">{c.rotulo} *</label>
                <select id="unidadeId" name="unidadeId" className="input" required defaultValue="">
                  <option value="" disabled>Selecione...</option>
                  {destinos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo} - {d.nome}{d.cidade ? ` (${d.cidade})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
                <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="transportadoraId">Transportador *</label>
                {transportadoras.length === 0 ? (
                  <p className="poco-erro px-4 py-3 text-[12px] text-erro-claro">
                    Nenhuma transportadora cadastrada.{" "}
                    <Link href="/cadastros/transportadoras" className="font-semibold underline">Cadastrar transportadora</Link>
                  </p>
                ) : (
                  <select id="transportadoraId" name="transportadoraId" className="input" required defaultValue="">
                    <option value="" disabled>Selecione...</option>
                    {transportadoras.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                )}
              </div>
              {tipo === "CROSS" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="rota">Rota</label>
                      <input id="rota" name="rota" className="input" maxLength={60} placeholder="Ex.: R-01/SP, ROTA_102#" autoComplete="off" />
                    </div>
                    <div>
                      <label className="label" htmlFor="dataFaturamento">Data de faturamento</label>
                      <input id="dataFaturamento" name="dataFaturamento" type="date" className="input" />
                    </div>
                  </div>
                  <InputPlaca rotulo="Placa do veículo" />
                </>
              )}
              <div>
                <label className="label" htmlFor="observacao">Observação</label>
                <textarea id="observacao" name="observacao" rows={3} className="input" maxLength={500} />
              </div>
            </FormAcao>
          )}
        </Painel>
        <div className="space-y-6 lg:col-span-2">
          <SaldosDevedores cdId={u.cd.id} tipo={tipo} titulo={`Saldos devedores · ${tipo === "CD" ? "CDs destino" : "Pontos de Cross"}`} />
          <UltimasMovimentacoes cdId={u.cd.id} tipos={["ENVIO_UNIDADE"]} titulo="Últimos envios" />
        </div>
      </div>
    </>
  );
}
