/**
 * Trava matemática do reparo de quebrados: recuperados + utilizados (desmontados para
 * o reparo) não pode ultrapassar o saldo de quebrados do CD. Módulo puro: usado no
 * servidor (validação definitiva, com o saldo travado) e na tela (aviso imediato).
 */
export function travaReparo(saldo: number, recuperados: number, utilizados: number): string | null {
  if (recuperados > saldo) {
    return `Erro: os recuperados (${recuperados}) ultrapassam o saldo de quebrados (${saldo}).`;
  }
  if (recuperados + utilizados > saldo) {
    const restam = saldo - recuperados;
    return `Erro: A soma dos recuperados (${recuperados}) e utilizados (${utilizados}) ultrapassa o saldo de quebrados (${saldo}). Restam no máximo ${restam} pallet(s) para utilização.`;
  }
  return null;
}
