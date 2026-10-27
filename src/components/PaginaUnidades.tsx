import { configurarUnidade, salvarCD } from "@/actions/cadastros";
import { AcoesLinha, BannerOk, Campo, RodapeForm, Situacao } from "./Cadastro";
import { CamposPadrao } from "./CamposPadrao";
import { FormAcao } from "./FormAcao";
import { Painel, Tabela, Vazio } from "./ui";
import { requirePermissaoGlobal } from "@/lib/auth";
import { formatarCnpj } from "@/lib/formatos";
import { ehMaster } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";

const config = {
  CD: { singular: "CD", plural: "Centros de Distribuição", caminho: "/cadastros/cds", novo: "Novo CD" },
  CROSS: { singular: "Ponto de Cross", plural: "Pontos de Cross-Docking", caminho: "/cadastros/cross", novo: "Novo Ponto de Cross" },
} as const;

/**
 * Cadastro de unidades com os campos padronizados (nome, CNPJ, contato responsável,
 * telefone e e-mail) + sigla. Pontos de Cross pertencem a um CD regional. O Master
 * configura o CD Hub e libera o módulo Recebimento Pallet Fornecedor por CD.
 */
export async function PaginaUnidades({ tipo, editar, ok }: { tipo: "CD" | "CROSS"; editar?: string; ok?: string }) {
  const u = await requirePermissaoGlobal("cds");
  const master = ehMaster(u);
  const c = config[tipo];
  const [lista, editando, cds] = await Promise.all([
    prisma.centroDistribuicao.findMany({
      where: { tipo },
      include: { _count: { select: { usuarios: true, crosses: true } }, cdRegional: { select: { codigo: true } } },
      orderBy: [{ ativo: "desc" }, { hub: "desc" }, { codigo: "asc" }],
    }),
    editar ? prisma.centroDistribuicao.findFirst({ where: { id: editar, tipo } }) : null,
    tipo === "CROSS" ? prisma.centroDistribuicao.findMany({ where: { tipo: "CD", ativo: true }, select: { id: true, codigo: true, nome: true }, orderBy: { codigo: "asc" } }) : [],
  ]);

  return (
    <>
      <BannerOk mensagem={ok} />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Painel titulo={editando ? `Editar ${editando.codigo}` : c.novo}>
            <FormAcao key={editando?.id ?? "novo"} acao={salvarCD} botao={editando ? "Salvar alterações" : "Cadastrar"} limpar={false}>
              {editando && <input type="hidden" name="id" value={editando.id} />}
              <input type="hidden" name="tipo" value={tipo} />
              <Campo nome="codigo" rotulo="Sigla" valor={editando?.codigo} obrigatorio maxLength={20} className="uppercase" placeholder={tipo === "CD" ? "Ex.: CDFT" : "Ex.: XRJ01"} />
              <CamposPadrao valores={editando ?? undefined} rotuloNome={tipo === "CD" ? "Nome do CD" : "Nome do Ponto de Cross"} />
              {tipo === "CROSS" && (
                <div>
                  <label className="label" htmlFor="cdRegionalId">CD regional *</label>
                  <select id="cdRegionalId" name="cdRegionalId" className="input" required defaultValue={editando?.cdRegionalId ?? ""}>
                    <option value="" disabled>Selecione...</option>
                    {cds.map((cd) => <option key={cd.id} value={cd.id}>{cd.codigo} - {cd.nome}</option>)}
                  </select>
                </div>
              )}
              <p className="text-[11px] text-t4">
                {tipo === "CD"
                  ? "Cada CD tem estoque próprio de pallets bons e quebrados. Vincule os usuários em Usuários e Permissões."
                  : "O Ponto de Cross tem estoque próprio (bons e quebrados), recebe envios dos CDs e devolve pallets ao CD."}
              </p>
              <RodapeForm editando={!!editando} caminho={c.caminho} />
            </FormAcao>
          </Painel>
          {tipo === "CD" && master && editando && (
            <Painel titulo={`Configurações do Master · ${editando.codigo}`}>
              <FormAcao key={`cfg-${editando.id}`} acao={configurarUnidade} botao="Salvar configuração" limpar={false}>
                <input type="hidden" name="id" value={editando.id} />
                <label className="poco flex cursor-pointer items-start gap-3 px-4 py-3 text-[12px]">
                  <input type="checkbox" name="recebimentoFornecedor" defaultChecked={editando.recebimentoFornecedor} className="mt-0.5" data-testid="cfg-fornecedor" />
                  <span>
                    <span className="block font-semibold text-t1">Recebimento Pallet Fornecedor</span>
                    <span className="text-t3">Libera o módulo de fornecedores (entrada, vales, agendas) neste CD. Desligado por padrão.</span>
                  </span>
                </label>
                <label className="poco flex cursor-pointer items-start gap-3 px-4 py-3 text-[12px]">
                  <input type="checkbox" name="hub" defaultChecked={editando.hub} className="mt-0.5" />
                  <span>
                    <span className="block font-semibold text-t1">CD Hub (Nível Brasil)</span>
                    <span className="text-t3">Recebe os quebrados das filiais, faz o conserto e tem visão global. Só pode existir um.</span>
                  </span>
                </label>
              </FormAcao>
            </Painel>
          )}
        </div>
        <Painel titulo={`${c.plural} (${lista.length})`} className="xl:col-span-2">
          {lista.length === 0 ? (
            <Vazio>Nenhum {c.singular} cadastrado.</Vazio>
          ) : (
            <Tabela>
              <table className="tabela" data-testid="tabela-unidades">
                <thead>
                  <tr>
                    <th>Sigla</th><th>Nome / CNPJ</th><th>Contato responsável</th>
                    {tipo === "CROSS" ? <th>CD regional</th> : <th>Módulos</th>}
                    <th className="text-right">Usuários</th><th>Situação</th><th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((x) => (
                    <tr key={x.id} className={x.ativo ? undefined : "opacity-60"}>
                      <td className="num font-semibold text-t1">{x.codigo}</td>
                      <td>
                        <p className="text-t1">{x.nome}</p>
                        <p className="num text-[11px] text-t4">{x.cnpj ? formatarCnpj(x.cnpj) : "—"}</p>
                      </td>
                      <td>
                        <p>{x.contato ?? "—"}</p>
                        <p className="text-[11px] text-t4">{[x.telefone, x.email].filter(Boolean).join(" · ")}</p>
                      </td>
                      {tipo === "CROSS" ? (
                        <td className="num">{x.cdRegional?.codigo ?? "—"}</td>
                      ) : (
                        <td className="space-x-1 whitespace-nowrap">
                          {x.hub && <span className="pill text-lima bg-lima/10">Hub</span>}
                          {x.recebimentoFornecedor ? <span className="pill text-t2 bg-t2/10">Fornecedor</span> : !x.hub && <span className="text-t4">—</span>}
                          {x._count.crosses > 0 && <span className="text-[11px] text-t4">{x._count.crosses} Cross</span>}
                        </td>
                      )}
                      <td className="num text-right">{x._count.usuarios}</td>
                      <td><Situacao ativo={x.ativo} /></td>
                      <td><AcoesLinha tipo="cd" id={x.id} ativo={x.ativo} caminho={c.caminho} podeInativar={!x.hub} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tabela>
          )}
        </Painel>
      </div>
    </>
  );
}
