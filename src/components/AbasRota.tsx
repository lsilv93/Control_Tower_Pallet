"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/** Abas ligadas à rota atual (trilha afundada com pílulas). */
export function AbasRota({ itens }: { itens: { href: string; rotulo: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="abas mb-6">
      {itens.map((i) => {
        const ativa = pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={clsx("aba", ativa && "aba-ativa")} aria-current={ativa ? "page" : undefined}>
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
