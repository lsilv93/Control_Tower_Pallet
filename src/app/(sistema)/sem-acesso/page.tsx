import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Painel } from "@/components/ui";

export const metadata = { title: "Sem acesso" };

export default function SemAcessoPage() {
  return (
    <Painel className="mx-auto mt-10 max-w-md text-center">
      <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-ouro" />
      <h1 className="mb-2 text-[18px] font-semibold text-t1">Sem permissão para esta tela</h1>
      <p className="mb-6 text-[12px] text-t3">
        Seu usuário não tem acesso a esta funcionalidade. Solicite a permissão a um administrador.
      </p>
      <Link href="/conta" className="btn-secondary">Minha conta</Link>
    </Painel>
  );
}
