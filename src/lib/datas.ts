// Datas no fuso de operação (America/Sao_Paulo, UTC-3 sem horário de verão).
export const TZ = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** "YYYY-MM-DD" da data informada no fuso de São Paulo. */
export function diaLocal(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Início (00:00 local) do dia "YYYY-MM-DD". */
export function inicioDoDia(dia: string = diaLocal()): Date {
  return new Date(`${dia}T00:00:00${OFFSET}`);
}

/** Início do dia seguinte a "YYYY-MM-DD" (limite exclusivo). */
export function fimDoDia(dia: string = diaLocal()): Date {
  return new Date(inicioDoDia(dia).getTime() + 24 * 60 * 60 * 1000);
}

export function inicioDoMes(d: Date = new Date()): Date {
  return inicioDoDia(`${diaLocal(d).slice(0, 7)}-01`);
}

/** Dias corridos desde a data (considerando o calendário local). */
export function idadeEmDias(desde: Date, agora: Date = new Date()): number {
  const ms = inicioDoDia(diaLocal(agora)).getTime() - inicioDoDia(diaLocal(desde)).getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function formatarDataHora(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "medium",
  }).format(d);
}

export function formatarData(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short" }).format(d);
}
