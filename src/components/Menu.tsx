"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  ArrowUpFromLine,
  Boxes,
  Building2,
  ClipboardCheck,
  Lock,
  MonitorPlay,
  Network,
  Repeat,
  CalendarCheck,
  ClipboardList,
  Factory,
  FileSearch,
  FileX,
  FileSpreadsheet,
  Hammer,
  KeyRound,
  LayoutDashboard,
  Menu as MenuIcon,
  PackagePlus,
  Plus,
  Recycle,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Truck,
  Users,
  X,
} from "lucide-react";
import { ehAdmin, ehMaster, ehUsuarioCross, ROTULO_PERFIL, tem, type Perfil, type Permissao, type UnidadeAcesso } from "@/lib/permissoes";
import { BotaoSair } from "./BotaoSair";
import { BotaoTema, type Tema } from "./BotaoTema";

type Item = {
  href: string;
  rotulo: string;
  icone: typeof Boxes;
  permissao?: Permissao;
  somente?: "admin" | "master";
  /** hub: só no CD Hub; fornecedor: módulo liberado na unidade; brasil: TV Nível Brasil; naoCross: fora do escopo do usuário de Cross. */
  requer?: "hub" | "fornecedor" | "brasil" | "naoCross";
};

const grupos: { titulo: string; itens: Item[] }[] = [
  {
    titulo: "",
    itens: [
      { href: "/", rotulo: "Painel", icone: LayoutDashboard, permissao: "dashboard" },
      { href: "/tv", rotulo: "Torre de Controle (TV)", icone: MonitorPlay, permissao: "tv", requer: "brasil" },
    ],
  },
  {
    titulo: "Movimentação",
    itens: [
      { href: "/envio", rotulo: "Envio de Pallets", icone: ArrowUpFromLine, permissao: "envio" },
      { href: "/recebimento", rotulo: "Recebimento / Conferência", icone: ClipboardCheck, permissao: "recebimento" },
      { href: "/ocorrencias", rotulo: "Ocorrências", icone: TriangleAlert, requer: "naoCross" },
    ],
  },
  {
    titulo: "Avarias",
    itens: [
      { href: "/avarias/quebras", rotulo: "Lançar Quebrado", icone: Hammer, permissao: "quebras" },
      { href: "/avarias/recuperados", rotulo: "Conserto / Reparo", icone: Recycle, permissao: "reparo", requer: "hub" },
      { href: "/avarias/descarte", rotulo: "Descarte", icone: Trash2, requer: "naoCross" },
    ],
  },
  {
    titulo: "Fornecedor & Vales",
    itens: [
      { href: "/fornecedor/entrada", rotulo: "Recebimento Pallet Fornecedor", icone: PackagePlus, permissao: "fornecedor", requer: "fornecedor" },
      { href: "/vales/consulta", rotulo: "Consulta de Vales", icone: FileSearch, permissao: "vales" },
      { href: "/vales", rotulo: "Agendar Retirada", icone: ClipboardList, permissao: "fornecedor", requer: "fornecedor" },
      { href: "/agendas", rotulo: "Baixa de Pagamento", icone: CalendarCheck, permissao: "fornecedor", requer: "fornecedor" },
      { href: "/vales/excluir", rotulo: "Excluir Vale", icone: FileX, permissao: "excluir_vale" },
    ],
  },
  {
    titulo: "Cadastros",
    itens: [
      { href: "/cadastros/transportadoras", rotulo: "Transportadoras", icone: Truck, permissao: "cadastros" },
      { href: "/cadastros/fornecedores", rotulo: "Fornecedores", icone: Factory, permissao: "cadastros" },
      { href: "/cadastros/cds", rotulo: "Centros de Distribuição", icone: Building2, permissao: "cds" },
      { href: "/cadastros/cross", rotulo: "Pontos de Cross", icone: Network, permissao: "cds" },
      { href: "/cadastros/usuarios", rotulo: "Usuários e Permissões", icone: Users, somente: "admin" },
    ],
  },
  {
    titulo: "Gestão",
    itens: [
      { href: "/estoque/inclusao", rotulo: "Ajuste de Saldo (Admin)", icone: SlidersHorizontal, somente: "admin" },
      { href: "/auditoria", rotulo: "Auditoria", icone: ShieldCheck, permissao: "auditoria" },
      { href: "/relatorios", rotulo: "Relatórios", icone: FileSpreadsheet, permissao: "relatorios" },
      { href: "/conta", rotulo: "Minha Senha", icone: KeyRound },
    ],
  },
];

type UsuarioMenu = { nome: string; login: string; perfil: Perfil; permissoes: string[]; unidade: UnidadeAcesso; global: boolean; visaoBrasil: boolean };
type CDMenu = { codigo: string; nome: string; tipo: "CD" | "CROSS"; hub: boolean; recebimentoFornecedor: boolean };

function visivel(i: Item, u: UsuarioMenu, cd: CDMenu | null) {
  if (i.somente === "master" && !ehMaster(u)) return false;
  if (i.somente === "admin" && !ehAdmin(u)) return false;
  if (i.permissao && !tem(u, i.permissao)) return false;
  if (i.requer === "hub" && !cd?.hub) return false;
  if (i.requer === "fornecedor" && !cd?.recebimentoFornecedor) return false;
  if (i.requer === "brasil" && !u.visaoBrasil) return false;
  if (i.requer === "naoCross" && ehUsuarioCross(u)) return false;
  return true;
}

export function Menu({
  usuario,
  cd,
  podeTrocarCD,
  tema,
}: {
  usuario: UsuarioMenu;
  cd: CDMenu | null;
  podeTrocarCD: boolean;
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
          <span className="flex flex-col leading-tight">
            Control Tower Pallet
            {cd && <span className="num text-[10px] font-medium text-lima">{cd.tipo === "CROSS" ? "Cross" : "CD"} {cd.codigo}</span>}
          </span>
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
        <div className="card flex h-full flex-col overflow-y-auto lg:overflow-hidden">
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

          <div className="px-3 pb-3">
            <CDAtivo cd={cd} podeTrocar={podeTrocarCD} global={usuario.global} onNavegar={() => setAberto(false)} />
          </div>

          {tem(usuario, "compras") && usuario.global && (
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

          <nav className="flex-1 space-y-4 px-3 pb-4 lg:overflow-y-auto">
            {grupos.map((g) => {
              const itens = g.itens.filter((i) => visivel(i, usuario, cd));
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
              <p className="mt-0.5 text-[10px] text-t4" data-testid="escopo-usuario">
                {usuario.global ? "Acesso a todas as unidades" : usuario.unidade.tipo === "CROSS" ? "Ponto de Cross" : "Visão da unidade"}
              </p>
            </div>
            <div className="mt-3">
              <BotaoSair variante="botao" />
            </div>
          </div>
        </div>
      </aside>

      {aberto && <div className="fixed inset-0 z-30 bg-[#000814]/60 lg:hidden" onClick={() => setAberto(false)} />}
    </>
  );
}

/** Unidade de operação: fixa (cadeado) para usuários regionais; visão global pode trocar. */
function CDAtivo({ cd, podeTrocar, global, onNavegar }: { cd: CDMenu | null; podeTrocar: boolean; global: boolean; onNavegar: () => void }) {
  if (!cd) {
    return (
      <Link href="/selecionar-cd" onClick={onNavegar} className="poco-erro flex items-center gap-2 px-4 py-3 text-[11px] font-semibold text-erro-claro">
        <Building2 className="h-4 w-4" /> Nenhuma unidade de operação
      </Link>
    );
  }
  return (
    <div className="poco flex items-center gap-3 px-4 py-3" data-testid="cd-ativo">
      {cd.tipo === "CROSS" ? <Network className="h-4 w-4 flex-none text-lima" /> : <Building2 className="h-4 w-4 flex-none text-lima" />}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.12em] text-t4">{cd.tipo === "CROSS" ? "Ponto de Cross" : cd.hub ? "CD Hub" : "CD"} de operação</p>
        <p className="truncate text-[12px] font-semibold text-t1" title={cd.nome}>
          <span className="num">{cd.codigo}</span> · {cd.nome}
        </p>
      </div>
      {podeTrocar ? (
        <Link href="/selecionar-cd?trocar=1" onClick={onNavegar} className="btn-icone !h-8 !w-8" title="Trocar unidade" aria-label="Trocar unidade">
          <Repeat className="h-4 w-4" />
        </Link>
      ) : (
        <span title={global ? "Única unidade ativa" : "Seu usuário opera somente nesta unidade"} aria-label="Unidade fixa"><Lock className="h-3.5 w-3.5 text-t4" /></span>
      )}
    </div>
  );
}
