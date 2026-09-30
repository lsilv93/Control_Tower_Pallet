// Filtro de período do Dashboard: Dia, Semana do ano (ISO 8601), Mês, Intervalo e Geral.
// Módulo puro (sem dependências de servidor): usado no servidor e no filtro do navegador.
import { diaLocal, fimDoDia, inicioDoDia } from "./datas";

export type TipoPeriodo = "dia" | "semana" | "mes" | "intervalo" | "todos";

export type Periodo = {
  tipo: TipoPeriodo;
  /** Início (inclusivo) e fim (exclusivo); ausentes em "todos". */
  inicio?: Date;
  fim?: Date;
  rotulo: string;
  // valores para preencher o formulário
  dia: string;
  ano: number;
  semana: number;
  mes: number; // 1..12
  de: string;
  ate: string;
};

const DIA_MS = 86400000;
const reData = /^\d{4}-\d{2}-\d{2}$/;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const NOMES_MESES = MESES.map((m) => m[0].toUpperCase() + m.slice(1));

const utc = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const br = (dia: string, comAno = true) => {
  const [a, m, d] = dia.split("-");
  return comAno ? `${d}/${m}/${a}` : `${d}/${m}`;
};
const valida = (dia: string) => reData.test(dia) && iso(utc(dia)) === dia;

/** Semana ISO 8601 (semanas começam na segunda; a semana 1 contém 4 de janeiro). */
export function semanaIso(dia: string): { ano: number; semana: number } {
  const t = utc(dia);
  const diaSemana = (new Date(t).getUTCDay() + 6) % 7; // seg = 0
  const quinta = t + (3 - diaSemana) * DIA_MS;
  const ano = new Date(quinta).getUTCFullYear();
  return { ano, semana: 1 + Math.floor((quinta - Date.UTC(ano, 0, 1)) / (7 * DIA_MS)) };
}

/** Segunda e domingo ("YYYY-MM-DD") da semana ISO. */
export function diasDaSemana(ano: number, semana: number): { inicio: string; fim: string } {
  const jan4 = Date.UTC(ano, 0, 4);
  const segundaSemana1 = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * DIA_MS;
  const inicio = segundaSemana1 + (semana - 1) * 7 * DIA_MS;
  return { inicio: iso(inicio), fim: iso(inicio + 6 * DIA_MS) };
}

export const semanasNoAno = (ano: number) => semanaIso(`${ano}-12-28`).semana;

export function rotuloSemana(ano: number, semana: number) {
  const { inicio, fim } = diasDaSemana(ano, semana);
  return `Semana ${semana}/${ano} · ${br(inicio, false)} a ${br(fim, false)}`;
}

type Params = { periodo?: string; dia?: string; ano?: string; semana?: string; mes?: string; de?: string; ate?: string };

/** Interpreta os parâmetros da URL. Sem parâmetros: o dia de hoje (comportamento anterior). */
export function lerPeriodo(p: Params, hoje: string = diaLocal()): Periodo {
  const semanaHoje = semanaIso(hoje);
  const anoHoje = Number(hoje.slice(0, 4));
  const tipo: TipoPeriodo = (["dia", "semana", "mes", "intervalo", "todos"] as const).includes(p.periodo as TipoPeriodo)
    ? (p.periodo as TipoPeriodo)
    : "dia";

  const dia = p.dia && valida(p.dia) ? p.dia : hoje;
  const ano = Number(p.ano) >= 2000 && Number(p.ano) <= 2100 ? Number(p.ano) : tipo === "semana" ? semanaHoje.ano : anoHoje;
  const semana = Math.min(Math.max(Number(p.semana) || semanaHoje.semana, 1), semanasNoAno(ano));
  const mes = Number(p.mes) >= 1 && Number(p.mes) <= 12 ? Number(p.mes) : Number(hoje.slice(5, 7));
  let de = p.de && valida(p.de) ? p.de : iso(utc(hoje) - 6 * DIA_MS);
  let ate = p.ate && valida(p.ate) ? p.ate : hoje;
  if (de > ate) [de, ate] = [ate, de];

  const base = { tipo, dia, ano, semana, mes, de, ate };
  switch (tipo) {
    case "todos":
      return { ...base, rotulo: "Geral · todo o histórico" };
    case "semana": {
      const s = diasDaSemana(ano, semana);
      return { ...base, inicio: inicioDoDia(s.inicio), fim: fimDoDia(s.fim), rotulo: rotuloSemana(ano, semana) };
    }
    case "mes": {
      const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const proximo = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
      return { ...base, inicio: inicioDoDia(primeiro), fim: inicioDoDia(proximo), rotulo: `${NOMES_MESES[mes - 1]} de ${ano}` };
    }
    case "intervalo":
      return { ...base, inicio: inicioDoDia(de), fim: fimDoDia(ate), rotulo: `${br(de)} a ${br(ate)}` };
    default:
      return { ...base, inicio: inicioDoDia(dia), fim: fimDoDia(dia), rotulo: dia === hoje ? `Hoje · ${br(dia)}` : br(dia) };
  }
}

/** Filtro Prisma de data para o período (vazio em "todos"). */
export const filtroData = (p: Pick<Periodo, "inicio" | "fim">) =>
  p.inicio && p.fim ? { gte: p.inicio, lt: p.fim } : undefined;
