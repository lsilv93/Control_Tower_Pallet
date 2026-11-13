// Ferramenta de desenvolvimento (executada uma vez): extrai do pacote lucide os ícones usados
// pelo sistema e grava php/app/Lib/icones_dados.php (SVG puro, sem dependência em produção).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const dir = "node_modules/lucide-react/dist/esm/icons";
const fontes = [];
const andar = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) andar(p); else if (/\.(tsx?|php|js)$/.test(f.name)) fontes.push(readFileSync(p, "utf8")); } };
andar("src"); try { andar("php/app"); andar("php/public/assets"); } catch {}
const texto = fontes.join("\n");
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/([A-Z])([A-Z][a-z])/g, "$1-$2").toLowerCase();
const usados = new Set([...texto.matchAll(/\b([A-Z][A-Za-z0-9]*)\b/g)].map((m) => m[1]));
for (const m of texto.matchAll(/icone\(\s*['"]([a-z0-9-]+)['"]/g)) usados.add(m[1]);
// Mapa alias → arquivo (lucide renomeia ícones; ex.: Building2 → building-complex).
const indice = readFileSync("node_modules/lucide-react/dist/esm/lucide-react.mjs", "utf8");
const alias = new Map();
for (const m of indice.matchAll(/export \{([^}]+)\} from '\.\/icons\/([a-z0-9-]+)\.mjs'/g)) {
  for (const n of m[1].matchAll(/default as (\w+)/g)) alias.set(n[1], m[2]);
}
const saida = {};
for (const nome of usados) {
  const arquivo = alias.get(nome) ?? (alias.has(nome.split("-").map((p) => p[0]?.toUpperCase() + p.slice(1)).join("")) ? alias.get(nome.split("-").map((p) => p[0].toUpperCase() + p.slice(1)).join("")) : null);
  if (!arquivo) continue;
  const { __iconData } = await import(pathToFileURL(`${dir}/${arquivo}.mjs`).href);
  if (!__iconData) continue;
  const chave = /^[A-Z]/.test(nome) ? kebab(nome).replace(/([a-z])(\d)/g, "$1-$2") : nome;
  saida[chave] = __iconData.node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
}
const php = "<?php\n// Gerado por php/scripts/gerar-icones.mjs a partir do pacote lucide (licença ISC).\nreturn " +
  "[\n" + Object.entries(saida).sort().map(([k, v]) => `    '${k}' => '${v.replace(/'/g, "\\'")}',`).join("\n") + "\n];\n";
writeFileSync("php/app/Lib/icones_dados.php", php);
console.log(Object.keys(saida).length, "ícones");
