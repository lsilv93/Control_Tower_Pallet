import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Painel } from "@/components/ui";

export const metadata = { title: "Sem acesso" };

const MOTIVOS: Record<string, { titulo: string; texto: string }> = {
  fornecedor: {
    titulo: "Módulo não liberado nesta unidade",
    texto: "O Recebimento Pallet Fornecedor está desligado para esta unidade. Somente o usuário Master pode liberá-lo em Cadastros → Centros de Distribuição.",
  },
  reparo: { titulo: "Conserto exclusivo do CD Hub", texto: "O conserto/reparo de pallets quebrados é feito somente no CD Hub (CDJC). Envie os quebrados ao CDJC pela tela de Envio." },
  tv: { titulo: "Torre de Controle restrita", texto: "A TV Nível Brasil é exclusiva de Master, Administrador e usuários do CD Hub (CDJC)." },
  cross: {
    titulo: "Fora do escopo do Ponto de Cross",
    texto: "Usuários de Ponto de Cross acessam somente o painel do próprio Cross, o recebimento/conferência, o envio de retorno ao CD e o lançamento de quebrados.",
  },
};

export default async function SemAcessoPage({ searchParams }: { searchParams: Promise<{ modulo?: string }> }) {
  const { modulo } = await searchParams;
  const m = (modulo && MOTIVOS[modulo]) || { titulo: "Sem permissão para esta tela", texto: "Seu usuário não tem acesso a esta funcionalidade. Solicite a permissão a um administrador." };
  return (
    <Painel className="mx-auto mt-10 max-w-md text-center">
      <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-ouro" />
      <h1 className="mb-2 text-[18px] font-semibold text-t1" data-testid="sem-acesso">{m.titulo}</h1>
      <p className="mb-6 text-[12px] text-t3">{m.texto}</p>
      <Link href="/" className="btn-secondary">Voltar ao início</Link>
    </Painel>
  );
}
