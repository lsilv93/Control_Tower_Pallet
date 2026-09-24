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
      <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-900 px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2 font-bold">
          <Boxes className="h-5 w-5" /> Control Tower Pallet
        </div>
        <button onClick={() => setAberto(!aberto)} aria-label="Abrir menu">
          {aberto ? <X /> : <MenuIcon />}
        </button>
      </header>

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-900 text-slate-200 transition-transform lg:translate-x-0",
          aberto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5 text-white">
          <div className="rounded-lg bg-brand-600 p-2">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold leading-tight">Control Tower</p>
            <p className="text-xs text-blue-200">Gestão de Pallets PBR</p>
          </div>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
          {grupos.map((g) => {
            const itens = g.itens.filter((i) => !("admin" in i && i.admin) || usuario.perfil === "ADMIN");
            if (!itens.length) return null;
            return (
              <div key={g.titulo}>
                {g.titulo && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300/70">{g.titulo}</p>
                )}
                {itens.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setAberto(false)}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                      ativo(i.href) ? "bg-brand-600 font-semibold text-white" : "hover:bg-white/10",
                    )}
                  >
                    <i.icone className="h-4 w-4" />
                    {i.rotulo}
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-semibold text-white">{usuario.nome}</p>
          <p className="text-xs text-blue-200">
            {usuario.login} · {usuario.perfil === "ADMIN" ? "Administrador" : "Operador"}
          </p>
          <form action={sair} className="mt-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </form>
        </div>
      </aside>

      {aberto && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setAberto(false)} />}
    </>
  );
}
