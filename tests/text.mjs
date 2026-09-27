// Detector de texto corrupto: busca caracteres fuera del rango latino habitual
// que se colaron al generar los textos en español.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const target = process.argv[2] ? join(root, process.argv[2]) : join(root, 'js');

/** Rango válido: latín básico, suplemento, IPA, usuarios, banderas y símbolos de caja. */
function isOk(ch) {
  const c = ch.codePointAt(0);
  if (c === 0xfeff) return true; // BOM UTF-8
  if (c === 0x0d || c === 0x09) return true; // CR y tabulador
  if (c >= 0x20 && c <= 0x7e) return true;
  if (c >= 0xa0 && c <= 0x24f) return true; // latín-1 + punished
  if (c >= 0x370 && c <= 0x3ff) return true; // griego
  if (c >= 0x2000 && c <= 0x206f) return true; // puntuación general
  if (c >= 0x20a0 && c <= 0x20bf) return true; // símbolos de moneda
  if (c >= 0x2190 && c <= 0x21ff) return true; // flechas
  if (c >= 0x2500 && c <= 0x257f) return true; // líneas de caja
  if (c >= 0x25a0 && c <= 0x25ff) return true; // formas geométricas
  if (c >= 0x2600 && c <= 0x26ff) return true; // símbolos varios
  if (c >= 0x2700 && c <= 0x27bf) return true; // dingbats
  if (c >= 0x1f1e6 && c <= 0x1f1ff) return true; // banderas
  if (c >= 0x1f300 && c <= 0x1f9ff) return true; // emoji
  if (c === 0xfe0f || c === 0x200d) return true; // selectores de emoji
  if (c >= 0x0300 && c <= 0x036f) return true; // diacríticos combinantes
  return false;
}

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const info = await stat(target);
const files = info.isDirectory() ? await walk(target) : [target];
let bad = 0;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    const hits = [...line].filter((ch) => !isOk(ch));
    if (hits.length) {
      bad++;
      console.log(`${relative(root, file)}:${i + 1}  ${[...new Set(hits)].map((h) => `${h} U+${h.codePointAt(0).toString(16)}`).join(' ')}`);
      console.log(`   ${line.trim().slice(0, 120)}`);
    }
  });
}
console.log(bad ? `\n${bad} línea(s) con caracteres sospechosos` : '\nTodo el texto es limpio');
process.exit(bad ? 1 : 0);
