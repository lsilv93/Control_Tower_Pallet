import Link from "next/link";
import type { Prisma, StatusVale } from "@prisma/client";
import { Search } from "lucide-react";
import { BotoesVale } from "@/components/BotoesVale";
import { Cabecalho, Painel, StatusBadge, Tabela, Vazio } from "@/components/ui";
import { requirePermissao } from "@/lib/auth";
import { fimDoDia, formatarDataHora, inicioDoDia } from "@/lib/datas";
import { formatarCnpj, formatarNumero, lerCodigoVale, numeroVale, rotuloStatusVale } from "@/lib/formatos";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Consulta de Vales" };

const LIMITE = 200;
const reData = /^\d{4}-\d{2}-\d{2}$/;
const STATUS: StatusVale[] = ["PENDENTE", "AGENDADO", "FINALIZADO", "CANCELADO"];

type Busca = { numero?: string; fornecedor?: string; status?: string; de?: string; ate?: string };

export default async function ConsultaValesPage({ searchParams }: { searchParams: Promise<Busca> }) {
  await requirePermissao("vales");
  const f = await searchParams;
  const numero = f.numero ? lerCodigoVale(f.numero) : null;
  const status = STATUS.includes(f.status as StatusVale) ? (f.status as StatusVale) : undefined;
  const de = f.de && reData.test(f.de) ? f.de : undefined;
  const ate = f.ate && reData.test(f.ate) ? f.ate : undefined;

  const where: Prisma.ValePalletWhereInput = {
    ...(numero !== null ? { numero } : {}),
    ...(f.fornecedor ? { fornecedorId: f.fornecedor } : {}),
    ...(status ? { status } : {}),
    ...(de || ate ? { criadoEm: { ...(de ? { gte: inicioDoDia(de) } : {}), ...(ate ? { lt: fimDoDia(ate) } : {}) } } : {}),
  };
  const [fornecedores, vales, total, soma] = await Promise.all([
    prisma.fornecedor.findMany({ select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.valePallet.findMany({ where, include: { fornecedor: true }, orderBy: { numero: "desc" }, take: LIMITE }),
    prisma.valePallet.count({ where }),
    prisma.valePallet.aggregate({ where, _sum: { quantidade: true } }),
  ]);
  const numeroInvalido = !!f.numero && numero === null;

  return (
    <>
      <Cabecalho titulo="Consulta de Vales-Pallet" descricao="Busque por número, fornecedor, status ou período de emissão. Cada vale pode ser baixado em PDF ou impresso." />

      <Painel className="mb-6">
        <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1.4fr_1fr_1fr_1fr_auto] xl:items-end" action="/vales/consulta">
          <div>
            <label className="label" htmlFor="numero">Número do vale</label>
            <input id="numero" name="numero" defaultValue={f.numero ?? ""} className="input num uppercase placeholder:normal-case" placeholder="VP-000123" autoComplete="off" />
          </div>
          <div>
            <label className="label" htmlFor="fornecedor">Fornecedor</label>
            <select id="fornecedor" name="fornecedor" defaultValue={f.fornecedor ?? ""} className="input">
              <option value="">Todos</option>
              {fornecedores.map((x) => (
                <option key={x.id} value={x.id}>{x.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status ?? ""} className="input">
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>{rotuloStatusVale[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="de">Emitido de</label>
            <input id="de" name="de" type="date" defaultValue={de ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ate">até</label>
            <input id="ate" name="ate" type="date" defaultValue={ate ?? ""} className="input" />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary"><Search className="h-4 w-4" /> Buscar</button>
            <Link href="/vales/consulta" className="btn-secondary">Limpar</Link>
          </div>
        </form>
        {numeroInvalido && <p className="mt-3 text-[12px] text-erro">&quot;{f.numero}&quot; não é um número de vale válido.</p>}
      </Painel>

      <Painel
        titulo={`Resultado: ${total} vale(s) · ${formatarNumero(soma._sum.quantidade ?? 0)} pallet(s)`}
        acoes={total > LIMITE ? <span className="text-[11px] text-t3">Exibindo os {LIMITE} mais recentes.</span> : null}
      >
        {vales.length === 0 ? (
          <Vazio>Nenhum vale encontrado para os filtros.</Vazio>
        ) : (
          <Tabela>
            <table className="tabela">
              <thead>
                <tr><th>Vale</th><th>Emissão</th><th>Fornecedor</th><th>Transportadora</th><th className="text-right">Qtd.</th><th>Status</th><th className="text-right">Documento</th></tr>
              </thead>
              <tbody>
                {vales.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/vales/${v.id}`} className="num font-semibold text-lima hover:underline">{numeroVale(v.numero)}</Link>
                      <p className="text-[11px] text-t4">NF {v.notaFiscal}</p>
                    </td>
                    <td className="num">{formatarDataHora(v.criadoEm)}</td>
                    <td>
                      <p className="max-w-[14rem] truncate font-medium text-t1" title={v.fornecedor.nome}>{v.fornecedor.nome}</p>
                      <p className="num text-[11px] text-t4">{formatarCnpj(v.fornecedor.cnpj)}</p>
                    </td>
                    <td className="max-w-[10rem] truncate">{v.transportadora}</td>
                    <td className="num text-right font-semibold text-t1">{v.quantidade}</td>
                    <td><StatusBadge status={v.status} rotulo={rotuloStatusVale[v.status]} /></td>
                    <td className="text-right"><BotoesVale id={v.id} compacto /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tabela>
        )}
      </Painel>
    </>
  );
}
