import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const suites = ['syntax.mjs', 'circuits.check.mjs', 'track-queries.mjs', 'data.check.mjs', 'physics.check.mjs'];

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(here, file)], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code ?? 1));
  });

let failed = 0;
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const code = await run(suite);
  if (code !== 0) {
    failed++;
    console.log(`--- ${suite} falló (código ${code})`);
  }
}
console.log(failed ? `\n${failed} suite(s) fallida(s)` : '\nTodo correcto');
process.exit(failed ? 1 : 0);
