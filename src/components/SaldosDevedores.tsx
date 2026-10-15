import Link from "next/link";
import { devedoresPorUnidade } from "@/lib/consultas";
import { formatarData } from "@/lib/datas";
import { formatarNumero as n, rotuloTipoUnidade } from "@/lib/formatos";
import { Painel, Tabela, Vazio } from "./ui";

/** Saldos devedores (custódia) por CD destino e Ponto de Cross, no CD de operação. */
export async function SaldosDevedores({
  cdId,
  tipo,
  titulo = "Saldos devedores por CD destino e Ponto de Cross",
}: {
  cdId: string;
  tipo?: "CD" | "CROSS";
  titulo?: string;
}) {
  const linhas = (await devedoresPorUnidade(cdId)).filter((l) => !tipo || l.unidade.tipo === tipo);
  const total = linhas.reduce((s, l) => s + l.saldo, 0);
  return (
    <Painel titulo={titulo} acoes={<span className="num text-[12px] font-semibold text-t1">Total {n(total)}</span>}>
      {linhas.length === 0 ? (
        <Vazio>Nenhum saldo devedor em aberto.</Vazio>
      ) : (
        <Tabela>
          <table className="tabela" data-testid="tabela-devedores">
            <thead>
              <tr><th>Unidade</th><th className="text-right">Saldo devedor</th><th className="text-right">Vales</th><th>Mais antigo</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.unidade.id}>
                  <td className="font-medium text-t1">
                    <span className="num font-semibold">{l.unidade.codigo}</span> · {l.unidade.nome}
                    <span className="block text-[11px] font-normal text-t4">{rotuloTipoUnidade[l.unidade.tipo]}</span>
                  </td>
                  <td className="num text-right text-[15px] font-semibold text-t1">
                    <Link prefetch={false} href={`/retorno?unidade=${l.unidade.id}`} className="hover:text-lima hover:underline">{n(l.saldo)}</Link>
                  </td>
                  <td className="num text-right">{l.vales}</td>
                  <td className="tabular-nums">{l.maisAntigo ? <>{formatarData(l.maisAntigo)} <span className="text-[11px] text-t4">({l.idade}d)</span></> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tabela>
      )}
    </Painel>
  );
}
