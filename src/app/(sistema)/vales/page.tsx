import { requirePermissao } from "@/lib/auth";
import Link from "next/link";
import { PackagePlus } from "lucide-react";
import { SelecaoVales, type LinhaVale } from "@/components/SelecaoVales";
import { Cabecalho } from "@/components/ui";
import { valesEmAberto } from "@/lib/consultas";
import { diaLocal, formatarData } from "@/lib/datas";
import { rotuloNf } from "@/lib/formatos";
import { formatarCnpj, formatarPlaca, normalizarCnpj, numeroAgenda, numeroVale, rotuloStatusVale } from "@/lib/formatos";

export const metadata = { title: "Vales Pendentes" };

export default async function ValesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const u = await requirePermissao("agendas");
  const { q = "", status = "" } = await searchParams;
  const vales = await valesEmAberto(u.cd.id, {
    ...(status === "PENDENTE" || status === "AGENDADO" ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fornecedor: { nome: { contains: q, mode: "insensitive" } } },
            { fornecedor: { cnpj: { contains: normalizarCnpj(q) || q } } },
            { notaFiscal: { contains: q, mode: "insensitive" } },
            ...(/^\d+$/.test(q.replace(/^V[PEOA]-?/i, "")) ? [{ numero: Number(q.replace(/^V[PEOA]-?/i, "")) }] : []),
          ],
        }
      : {}),
  });

  const linhas: LinhaVale[] = vales.map((v) => ({
    id: v.id,
    num: v.numero,
    numero: numeroVale(v.numero, v.tipo),
    fornecedor: v.fornecedor?.nome ?? "—",
    cnpj: v.fornecedor ? formatarCnpj(v.fornecedor.cnpj) : "",
    notaFiscal: rotuloNf(v),
    transportadora: v.transportadora ?? "—",
    placa: v.placa ? formatarPlaca(v.placa) : "—",
    emissao: formatarData(v.criadoEm),
    usuario: v.criadoPor.login,
    quantidade: v.quantidade,
    idade: v.idade,
    farol: v.farol,
    status: v.status as LinhaVale["status"],
    statusRotulo: rotuloStatusVale[v.status],
    agenda: v.agenda ? numeroAgenda(v.agenda.numero) : null,
  }));

  return (
    <>
      <Cabecalho
        titulo="Agendar Retirada"
        descricao={`Vales-pallet de fornecedor em aberto em ${u.cd.codigo}. Selecione vales pendentes para gerar a agenda de devolução (uma agenda por fornecedor).`}
      >
        <Link href="/fornecedor/entrada" className="btn-secondary">
          <PackagePlus className="h-4 w-4" /> Nova entrada
        </Link>
      </Cabecalho>

      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[16rem] flex-1">
          <label className="label" htmlFor="q">Buscar</label>
          <input id="q" name="q" defaultValue={q} className="input" placeholder="Fornecedor, CNPJ, NF ou nº do vale" />
        </div>
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={status} className="input">
            <option value="">Pendentes e agendados</option>
            <option value="PENDENTE">Pendente</option>
            <option value="AGENDADO">Agendado</option>
          </select>
        </div>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <SelecaoVales vales={linhas} hoje={diaLocal()} />
    </>
  );
}
