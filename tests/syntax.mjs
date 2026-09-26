import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = await walk(join(root, 'js'));
let bad = 0;
for (const file of files) {
  try {
    await import(pathToFileURL(file).href);
    console.log(`OK   ${relative(root, file)}`);
  } catch (err) {
    bad++;
    console.log(`FAIL ${relative(root, file)}\n     ${err.message.split('\n')[0]}`);
  }
}
console.log(`\n${files.length - bad}/${files.length} módulos importan correctamente`);
process.exit(bad ? 1 : 0);
