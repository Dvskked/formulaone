import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
/* Cada entrada es [fichero, ...argumentos]. */
const suites = [
  ['syntax.mjs'],
  ['circuits.check.mjs'],
  ['track-queries.mjs'],
  ['data.check.mjs'],
  ['physics.check.mjs'],
  ['career.check.mjs'],
  ['race-engine.check.mjs'],
  ['render.check.mjs'],
  ['audio.check.mjs'],
  ['audio-fallo.check.mjs'],
  ['screens.check.mjs'],
  ['boot.check.mjs'],
  ['boot.check.mjs', '--bundle'],
  ['ui.check.mjs'],
  ['text.mjs'],
];

const run = (file, args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, file), ...args], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });

let failed = 0;
for (const [file, ...args] of suites) {
  const name = args.length ? `${file} ${args.join(' ')}` : file;
  console.log(`\n=== ${name} ===`);
  const code = await run(file, args);
  if (code !== 0) {
    failed++;
    console.log(`--- ${name} falló (código ${code})`);
  }
}
console.log(failed ? `\n${failed} suite(s) fallida(s)` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
