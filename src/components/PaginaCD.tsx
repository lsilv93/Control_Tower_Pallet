import Link from "next/link";
import { enviarParaCD, receberDoCD } from "@/actions/cd";
import { FormAcao } from "./FormAcao";
import { UltimasMovimentacoes } from "./UltimasMovimentacoes";
import { Abas, Cabecalho, Painel } from "./ui";
import { requirePermissao } from "@/lib/auth";
import { Fluxo, SaldosEstoques } from "./Contas";
import { prisma } from "@/lib/prisma";

export async function PaginaCD({ modo }: { modo: "envio" | "recebimento" }) {
  await requirePermissao("cd");
  const cds = await prisma.centroDistribuicao.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" } });
  const envio = modo === "envio";

  return (
    <>
      <Cabecalho
        titulo={envio ? "Transferência para o CD" : "Retorno do CD"}
        descricao={
          envio
            ? "Origem: Estoque de Vazios (subtrai) → Destino: Estoque do CD (soma)."
            : "Origem: Estoque do CD (subtrai) → Destino: Estoque de Vazios (soma)."
        }
      />
      <Abas
        ativo={envio ? "/cd/envio" : "/cd/recebimento"}
        itens={[
          { href: "/cd/envio", rotulo: "Transferência para o CD" },
          { href: "/cd/recebimento", rotulo: "Retorno do CD" },
        ]}
      />
      <SaldosEstoques destaque={["VAZIOS", "CD"]} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo={envio ? "Nova transferência" : "Novo retorno"}>
          <p className="mb-4 flex items-center gap-2 text-[12px] text-t3">
            {envio ? <Fluxo origem="VAZIOS" destino="CD" /> : <Fluxo origem="CD" destino="VAZIOS" />}
          </p>
          {cds.length === 0 ? (
            <p className="text-[12px] text-t2">
              Nenhum CD ativo cadastrado.{" "}
              <Link href="/cadastros/cds" className="font-semibold text-lima hover:underline">Cadastre um CD</Link>{" "}
              (perfil administrador).
            </p>
          ) : (
            <FormAcao
              acao={envio ? enviarParaCD : receberDoCD}
              botao={envio ? "Transferir para o CD" : "Registrar retorno"}
              classeBotao={envio ? "btn-primary w-full" : "btn-success w-full"}
            >
              <div>
                <label className="label" htmlFor="cdId">{envio ? "CD de destino *" : "CD de origem *"}</label>
                <select id="cdId" name="cdId" className="input" required defaultValue="">
                  <option value="" disabled>Selecione...</option>
                  {cds.map((cd) => (
                    <option key={cd.id} value={cd.id}>
                      {cd.codigo} - {cd.nome}{cd.cidade ? ` (${cd.cidade})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="quantidade">Quantidade de pallets *</label>
                <input id="quantidade" name="quantidade" type="number" min={1} step={1} className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="observacao">Observação</label>
                <textarea id="observacao" name="observacao" rows={2} className="input" maxLength={500} />
              </div>
            </FormAcao>
          )}
        </Painel>
        <div className="lg:col-span-2">
          <UltimasMovimentacoes
            tipos={[envio ? "ENVIO_CD" : "RECEBIMENTO_CD"]}
            titulo={envio ? "Últimas transferências para o CD" : "Últimos retornos do CD"}
          />
        </div>
      </div>
    </>
  );
}
