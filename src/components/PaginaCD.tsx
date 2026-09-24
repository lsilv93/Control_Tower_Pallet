import Link from "next/link";
import { enviarParaCD, receberDoCD } from "@/actions/cd";
import { FormAcao } from "./FormAcao";
import { UltimasMovimentacoes } from "./UltimasMovimentacoes";
import { Abas, Cabecalho, Painel } from "./ui";
import { obterSaldos } from "@/lib/conta";
import { prisma } from "@/lib/prisma";
import { formatarNumero } from "@/lib/formatos";

export async function PaginaCD({ modo }: { modo: "envio" | "recebimento" }) {
  const [cds, saldos] = await Promise.all([
    prisma.centroDistribuicao.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" } }),
    obterSaldos(),
  ]);
  const envio = modo === "envio";

  return (
    <>
      <Cabecalho
        titulo={envio ? "Envio para o CD" : "Recebimento do CD"}
        descricao={
          envio
            ? "Registra a saída imediata de pallets do pulmão para um Centro de Distribuição."
            : "Registra a entrada no pulmão de pallets vindos de um Centro de Distribuição."
        }
      />
      <Abas
        ativo={envio ? "/cd/envio" : "/cd/recebimento"}
        itens={[
          { href: "/cd/envio", rotulo: "Envio para o CD" },
          { href: "/cd/recebimento", rotulo: "Recebimento do CD" },
        ]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Painel titulo={envio ? "Nova saída" : "Nova entrada"}>
          <p className="mb-4 poco px-4 py-3 text-[12px]">
            <span className="label !mb-1">Saldo atual no pulmão</span>
            <strong className="num text-[22px] font-semibold text-t1">{formatarNumero(saldos.pulmao)}</strong>
          </p>
          {cds.length === 0 ? (
            <p className="text-[12px] text-t2">
              Nenhum CD ativo cadastrado.{" "}
              <Link href="/cadastros" className="font-semibold text-lima hover:underline">Cadastre um CD</Link>{" "}
              (perfil administrador).
            </p>
          ) : (
            <FormAcao
              acao={envio ? enviarParaCD : receberDoCD}
              botao={envio ? "Registrar envio" : "Registrar recebimento"}
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
            titulo={envio ? "Últimos envios para CD" : "Últimos recebimentos de CD"}
          />
        </div>
      </div>
    </>
  );
}
