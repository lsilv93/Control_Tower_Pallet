"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  Hammer,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  PackagePlus,
  Recycle,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { sair } from "@/actions/auth";

const grupos = [
  { titulo: "", itens: [{ href: "/", rotulo: "Dashboard", icone: LayoutDashboard }] },
  {
    titulo: "Centro de Distribuição",
    itens: [
      { href: "/cd/envio", rotulo: "Envio para o CD", icone: ArrowUpFromLine },
      { href: "/cd/recebimento", rotulo: "Recebimento do CD", icone: ArrowDownToLine },
    ],
  },
  {
    titulo: "Fornecedor & Vales",
    itens: [
      { href: "/fornecedor/entrada", rotulo: "Entrada de Fornecedor", icone: PackagePlus },
      { href: "/vales", rotulo: "Vales Pendentes", icone: ClipboardList },
      { href: "/agendas", rotulo: "Baixa de Pagamento", icone: CalendarCheck },
    ],
  },
  {
    titulo: "Avarias",
    itens: [
      { href: "/avarias/quebras", rotulo: "Quebras", icone: Hammer },
      { href: "/avarias/recuperados", rotulo: "Recuperados", icone: Recycle },
      { href: "/avarias/descarte", rotulo: "Descarte", icone: Trash2 },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/relatorios", rotulo: "Relatórios", icone: FileSpreadsheet },
      { href: "/cadastros", rotulo: "Cadastros", icone: Settings, admin: true },
      { href: "/conta", rotulo: "Minha Senha", icone: KeyRound },
    ],
  },
];

export function Menu({ usuario }: { usuario: { nome: string; login: string; perfil: string } }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const ativo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-fundo/95 px-[14px] py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-t1">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-lima text-tinta shadow-[5px_5px_11px_rgba(0,4,8,.62),-4px_-4px_10px_rgba(52,90,120,.26)]">
            <Boxes className="h-4 w-4" />
          </span>
          Control Tower Pallet
        </div>
        <button className="btn-icone" onClick={() => setAberto(!aberto)} aria-label={aberto ? "Fechar menu" : "Abrir menu"}>
          {aberto ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </header>

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-[268px] p-3 transition-transform duration-[250ms] lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="card flex h-full flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-5 pb-4 pt-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lima text-tinta shadow-[5px_5px_11px_rgba(0,4,8,.62),-4px_-4px_10px_rgba(52,90,120,.26)]">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold leading-tight text-t1">Control Tower</p>
              <p className="text-[11px] text-t3">Gestão de Pallets PBR</p>
            </div>
          </div>

          <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
            {grupos.map((g) => {
              const itens = g.itens.filter((i) => !("admin" in i && i.admin) || usuario.perfil === "ADMIN");
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
                          ativo(i.href)
                            ? "bg-gradient-to-br from-[#D0FF45] to-[#A9E113] font-semibold text-tinta shadow-[4px_4px_9px_rgba(0,4,8,.55),-3px_-3px_8px_rgba(52,90,120,.18)]"
                            : "text-t2 hover:bg-lima/[.09] hover:text-lima",
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
                {usuario.login} · {usuario.perfil === "ADMIN" ? "Administrador" : "Operador"}
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

      {aberto && <div className="fixed inset-0 z-30 bg-[#000814]/70 lg:hidden" onClick={() => setAberto(false)} />}
    </>
  );
}
