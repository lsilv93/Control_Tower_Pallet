import "server-only";
import bwipjs from "bwip-js/node";

/** Código de barras Code 128 em SVG (renderizado no servidor, nítido na impressão). */
export function codigo128Svg(texto: string, opcoes: { altura?: number; escala?: number } = {}): string {
  return bwipjs.toSVG({
    bcid: "code128",
    text: texto,
    height: opcoes.altura ?? 12, // mm
    scale: opcoes.escala ?? 2,
    includetext: false,
    // zona de silêncio exigida pelo Code 128 (≥ 10 módulos de cada lado) — sem ela leitores falham
    paddingwidth: 12,
    paddingheight: 2,
    backgroundcolor: "FFFFFF",
  });
}
