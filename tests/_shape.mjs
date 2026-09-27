import { CIRCUITS } from '../js/data/circuits.js';

for (const c of CIRCUITS) {
  const first = c.seg[0];
  const last = c.seg[c.seg.length - 1];
  let pos = 0;
  let neg = 0;
  for (const s of c.seg) {
    if (s[0] === 'c') (s[2] > 0 ? (pos += s[2]) : (neg -= s[2]));
    else if (s[0] === 'e') {
      const n = Math.max(2, s[3]);
      const a = (360 / (n + (n % 2 === 0 ? 1 : 0))) * 0.6;
      for (let i = 0; i < n; i++) (i % 2 === 0 ? (pos += a) : (neg += a));
    }
  }
  const bad = [];
  if (first[0] !== 's') bad.push('empieza en curva');
  if (last[0] !== 's') bad.push('acaba en curva');
  if (Math.abs(first[1] - last[1]) > 260) bad.push(`rectas extremas ${first[1]}/${last[1]}`);
  if (neg > pos * 0.3) bad.push(`giros contrarios ${Math.round(neg)}/${Math.round(pos)}`);
  console.log(`${c.id.padEnd(13)} ${String(first[0]).padEnd(2)}${String(first[1] ?? '').padEnd(5)} ... ${String(last[0]).padEnd(2)}${String(last[1] ?? '').padEnd(5)} suma ${Math.round(pos - neg)}  ${bad.join(' | ')}`);
}
