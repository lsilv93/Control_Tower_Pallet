"use client";

import { useState } from "react";
import clsx from "clsx";
import { PERMISSOES, type Perfil } from "@/lib/permissoes";

/**
 * Perfil + permissões granulares. MASTER e ADMIN têm acesso total (as caixas
 * ficam travadas); para OPERADOR o administrador marca tela a tela.
 */
export function CamposPermissao({
  perfilInicial,
  permissoesIniciais,
  podeMaster,
}: {
  perfilInicial: Perfil;
  permissoesIniciais: string[];
  podeMaster: boolean;
}) {
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(permissoesIniciais));
  const total = perfil !== "OPERADOR";

  const alternar = (chave: string) =>
    setMarcadas((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else n.add(chave);
      return n;
    });

  return (
    <>
      <div>
        <label className="label" htmlFor="perfil">Perfil de acesso *</label>
        <select id="perfil" name="perfil" className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
          <option value="OPERADOR">Operador (permissões por tela)</option>
          <option value="ADMIN">Administrador (todas as telas, sem ajuste manual)</option>
          {(podeMaster || perfilInicial === "MASTER") && <option value="MASTER">Master (tudo + ajuste manual de saldos)</option>}
        </select>
      </div>
      <fieldset className="poco p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <legend className="label !mb-0">Permissões por tela / funcionalidade</legend>
          {!total && (
            <span className="flex gap-2">
              <button type="button" className="text-[11px] font-semibold text-lima hover:underline" onClick={() => setMarcadas(new Set(PERMISSOES.map((p) => p.chave)))}>
                Marcar todas
              </button>
              <button type="button" className="text-[11px] font-semibold text-t3 hover:underline" onClick={() => setMarcadas(new Set())}>
                Limpar
              </button>
            </span>
          )}
        </div>
        {total && (
          <p className="mb-3 text-[11px] text-t3">
            {perfil === "MASTER" ? "Master" : "Administrador"} tem acesso a todas as telas
            {perfil === "MASTER" ? ", inclusive o ajuste manual de saldos." : ". Ajuste manual de saldos é exclusivo do Master."}
          </p>
        )}
        <div className="grid gap-2">
          {PERMISSOES.map((p) => (
            <label key={p.chave} className={clsx("flex items-center gap-3 text-[12px]", total ? "text-t4" : "cursor-pointer text-t2")}>
              <input
                type="checkbox"
                name="permissoes"
                value={p.chave}
                checked={total || marcadas.has(p.chave)}
                disabled={total}
                onChange={() => alternar(p.chave)}
              />
              {p.rotulo}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
