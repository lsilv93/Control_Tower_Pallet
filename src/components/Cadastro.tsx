import Link from "next/link";
import { Pencil } from "lucide-react";
import { alternarAtivo } from "@/actions/cadastros";
import { FormAcao } from "./FormAcao";
import { StatusBadge } from "./ui";

export function Campo({
  nome,
  rotulo,
  valor,
  obrigatorio,
  className,
  ...resto
}: {
  nome: string;
  rotulo: string;
  valor?: string | null;
  obrigatorio?: boolean;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className="label" htmlFor={`campo-${nome}`}>
        {rotulo}
        {obrigatorio && " *"}
      </label>
      <input id={`campo-${nome}`} name={nome} defaultValue={valor ?? ""} required={obrigatorio} className="input" {...resto} />
    </div>
  );
}

export function BannerOk({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <div role="status" className="poco mb-5 flex items-center gap-2.5 px-5 py-4 text-[12px] font-medium text-lima">
      <span className="ponto" /> {mensagem}
    </div>
  );
}

export function Situacao({ ativo }: { ativo: boolean }) {
  return <StatusBadge status={ativo ? "FINALIZADO" : "CANCELADA"} rotulo={ativo ? "Ativo" : "Inativo"} />;
}

/** Ações da linha: editar (via ?editar=id) e ativar/inativar. */
export function AcoesLinha({
  tipo,
  id,
  ativo,
  caminho,
  podeInativar = true,
}: {
  tipo: "transportadora" | "fornecedor" | "cd" | "usuario";
  id: string;
  ativo: boolean;
  caminho: string;
  podeInativar?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link href={`${caminho}?editar=${id}`} className="btn-secondary btn-sm" scroll>
        <Pencil className="h-3.5 w-3.5" /> Editar
      </Link>
      {podeInativar && (
        <FormAcao acao={alternarAtivo} className="inline" botao={ativo ? "Inativar" : "Ativar"} classeBotao={ativo ? "btn-danger btn-sm" : "btn-secondary btn-sm"}>
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="id" value={id} />
        </FormAcao>
      )}
    </div>
  );
}

export function RodapeForm({ editando, caminho }: { editando: boolean; caminho: string }) {
  if (!editando) return null;
  return (
    <Link href={caminho} className="btn-secondary">
      Cancelar edição
    </Link>
  );
}
