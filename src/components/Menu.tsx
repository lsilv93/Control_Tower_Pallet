"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Building2,
  CalendarCheck,
  ClipboardList,
  Factory,
  FileSearch,
  FileX,
  FileSpreadsheet,
  Hammer,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PackagePlus,
  Plus,
  Recycle,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { sair } from "@/actions/auth";
import { ehAdmin, ehMaster, ROTULO_PERFIL, tem, type Perfil, type Permissao } from "@/lib/permissoes";
import { BotaoTema, type Tema } from "./BotaoTema";

type Item = { href: string; rotulo: string; icone: typeof Boxes; permissao?: Permissao; somente?: "admin" | "master" };

const grupos: { titulo: string; itens: Item[] }[] = [
  { titulo: "", itens: [{ href: "/", rotulo: "Dashboard", icone: LayoutDashboard, permissao: "dashboard" }] },
  {
    titulo: "Centro de Distribuição",
    itens: [
      { href: "/cd/envio", rotulo: "Transferência para o CD", icone: ArrowUpFromLine, permissao: "cd" },
      { href: "/cd/recebimento", rotulo: "Retorno do CD", icone: ArrowDownToLine, permissao: "cd" },
    ],
  },
  {
    titulo: "Fornecedor & Vales",
    itens: [
      { href: "/fornecedor/entrada", rotulo: "Recebimento de Pallets", icone: PackagePlus, permissao: "entrada" },
      { href: "/vales/consulta", rotulo: "Consulta de Vales", icone: FileSearch, permissao: "vales" },
      { href: "/vales", rotulo: "Agendar Retirada", icone: ClipboardList, permissao: "agendas" },
      { href: "/agendas", rotulo: "Baixa de Pagamento", icone: CalendarCheck, permissao: "agendas" },
      { href: "/vales/excluir", rotulo: "Excluir Vale", icone: FileX, permissao: "excluir_vale" },
    ],
  },
  {
    titulo: "Avarias",
    itens: [
      { href: "/avarias/quebras", rotulo: "Quebras", icone: Hammer, permissao: "avarias" },
      { href: "/avarias/recuperados", rotulo: "Conserto / Reparo", icone: Recycle, permissao: "avarias" },
      { href: "/avarias/descarte", rotulo: "Descarte", icone: Trash2, permissao: "avarias" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/cadastros/transportadoras", rotulo: "Transportadoras", icone: Truck, permissao: "cadastros" },
      { href: "/cadastros/fornecedores", rotulo: "Fornecedores", icone: Factory, permissao: "cadastros" },
      { href: "/cadastros/cds", rotulo: "Centros de Distribuição", icone: Building2, permissao: "cds" },
      { href: "/cadastros/usuarios", rotulo: "Usuários e Permissões", icone: Users, somente: "admin" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/estoque/ajuste", rotulo: "Ajuste Manual (Master)", icone: SlidersHorizontal, somente: "master" },
      { href: "/auditoria", rotulo: "Auditoria", icone: ShieldCheck, permissao: "auditoria" },
      { href: "/relatorios", rotulo: "Relatórios", icone: FileSpreadsheet, permissao: "relatorios" },
      { href: "/conta", rotulo: "Minha Senha", icone: KeyRound },
    ],
  },
];

function visivel(i: Item, u: { perfil: Perfil; permissoes: string[] }) {
  if (i.somente === "master") return ehMaster(u);
  if (i.somente === "admin") return ehAdmin(u);
  return !i.permissao || tem(u, i.permissao);
}

export function Menu({
  usuario,
  tema,
}: {
  usuario: { nome: string; login: string; perfil: Perfil; permissoes: string[] };
  tema: Tema;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) =>
    href === "/" ? pathname === "/" : href === "/vales" ? pathname === "/vales" : pathname.startsWith(href);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-fundo/95 px-[14px] py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-t1">
          <span className="fill-lima flex h-9 w-9 items-center justify-center rounded-2xl">
            <Boxes className="h-4 w-4" />
          </span>
          Control Tower Pallet
        </div>
        <div className="flex items-center gap-2">
          <BotaoTema inicial={tema} />
          <BotaoSair />
          <button className="btn-icone" onClick={() => setAberto(!aberto)} aria-label={aberto ? "Fechar menu" : "Abrir menu"}>
            {aberto ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-[268px] p-3 transition-transform duration-[250ms] lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="card flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <span className="fill-lima flex h-10 w-10 items-center justify-center rounded-2xl">
                <Boxes className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[13px] font-semibold leading-tight text-t1">Control Tower</p>
                <p className="text-[11px] text-t3">Gestão de Pallets PBR</p>
              </div>
            </div>
            <div className="hidden flex-col gap-2 lg:flex">
              <BotaoTema inicial={tema} />
              <BotaoSair />
            </div>
          </div>

          {tem(usuario, "compras") && (
            <div className="px-3 pb-3">
              <Link
                href="/pallets/adicionar"
                onClick={() => setAberto(false)}
                className={clsx("w-full", ativo("/pallets") ? "btn-secondary !text-lima" : "btn-primary")}
              >
                <Plus className="h-4 w-4" /> Compra de Pallets
              </Link>
            </div>
          )}

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
            {grupos.map((g) => {
              const itens = g.itens.filter((i) => visivel(i, usuario));
              if (!itens.length) return null;
              return (
                <div key={g.titulo}>
                  {g.titulo && <p className="secao px-3 pb-1.5">{g.titulo}</p>}
                  <div className="space-y-1">
                    {itens.map((i) => (
                      <Link
                        key={i.href}
                        href={i.href}
                        onClick={() => setAberto(false)}
                        aria-current={ativo(i.href) ? "page" : undefined}
                        className={clsx(
                          "flex min-h-[44px] items-center gap-3 rounded-full px-4 text-[12px] font-medium transition-[background,color,box-shadow] duration-200",
                          ativo(i.href) ? "fill-lima font-semibold" : "text-t2 hover:bg-lima/[.09] hover:text-lima",
                        )}
                      >
                        <i.icone className="h-4 w-4 flex-none" />
                        {i.rotulo}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="p-3">
            <div className="poco p-4">
              <p className="truncate text-[12px] font-semibold text-t1">{usuario.nome}</p>
              <p className="text-[11px] text-t3">
                {usuario.login} · {ROTULO_PERFIL[usuario.perfil]}
              </p>
            </div>
            <form action={sair} className="mt-3">
              <button className="btn-secondary w-full">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      {aberto && <div className="fixed inset-0 z-30 bg-[#000814]/60 lg:hidden" onClick={() => setAberto(false)} />}
    </>
  );
}

/** Botão Sair (ícone), sempre visível no topo do menu e no cabeçalho do celular. */
function BotaoSair() {
  return (
    <form action={sair}>
      <button type="submit" className="btn-icone hover:!text-erro" aria-label="Sair do sistema" title="Sair do sistema">
        <LogOut className="h-5 w-5" />
      </button>
    </form>
  );
}
