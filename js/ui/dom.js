// Utilidades de DOM para construir la interfaz sin framework.
// Todo el HTML se genera con estas funciones: createElement, html y on.

/**
 * Crea un elemento con atributos, estilos, hijos y escuchas.
 * @param {string} tag etiqueta, admite selectores simples ('div.clase#id')
 * @param {object|null} props atributos; `class`, `text`, `html`, `style` (objeto),
 *   `dataset` (objeto) y `on` (objeto de escuchas)
 * @param {Array|string|Node} [children]
 */
export function el(tag, props = null, children = null) {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const node = document.createElement(name || 'div');
  for (const token of rest) {
    if (token[0] === '.') node.classList.add(token.slice(1));
    else if (token[0] === '#') node.id = token.slice(1);
  }
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = `${node.className} ${value}`.trim();
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key === 'on') for (const [evt, fn] of Object.entries(value)) node.addEventListener(evt, fn);
      else if (key in node && key !== 'list' && typeof value !== 'object') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    }
  }
  append(node, children);
  return node;
}

export function append(parent, children) {
  if (children === null || children === undefined || children === false) return parent;
  if (Array.isArray(children)) {
    for (const child of children) append(parent, child);
    return parent;
  }
  parent.append(children instanceof Node ? children : document.createTextNode(String(children)));
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Botón con aspecto uniforme. */
export function button(label, opts = {}) {
  const { kind = '', onClick, disabled, title, small, large, pressed, icon } = opts;
  return el(`button.btn${kind ? `.btn-${kind}` : ''}`, {
    type: 'button',
    title: title || label,
    disabled: Boolean(disabled),
    'aria-pressed': pressed === undefined ? null : String(Boolean(pressed)),
    on: onClick ? { click: onClick } : null,
  }, [icon ? el('span', { text: icon }) : null, label]);
}

/** Fila `clave → valor` para fichas de datos. */
export function kv(pairs) {
  const list = el('dl.kv');
  for (const [key, value] of pairs) {
    if (value === undefined) continue;
    list.append(el('dt', { text: key }), el('dd', null, value));
  }
  return list;
}

/** Barra de progreso con etiqueta. */
export function bar(value, max = 100, kind = '') {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return el(`div.bar-track${kind ? `.${kind}` : ''}`, null, el('i', { style: { width: `${pct}%` } }));
}

/** Grupo de botones excluyentes. */
export function segmented(options, current, onPick) {
  const wrap = el('div.segmented');
  for (const opt of options) {
    const value = typeof opt === 'string' ? opt : opt.value;
    const label = typeof opt === 'string' ? opt : opt.label;
    wrap.append(el('button', {
      type: 'button',
      text: label,
      'aria-pressed': String(value === current),
      on: { click: () => onPick(value) },
    }));
  }
  return wrap;
}

/** Interruptor con descripción. */
export function toggle(label, desc, value, onChange) {
  const btn = el('button', {
    type: 'button',
    'aria-pressed': String(Boolean(value)),
    'aria-label': label,
    on: { click: () => onChange(btn.getAttribute('aria-pressed') !== 'true') },
  });
  const row = el('div.switch', null, [
    el('div', null, [el('div', { text: label }), desc ? el('div.desc', { text: desc }) : null]),
    btn,
  ]);
  row.sync = (next) => btn.setAttribute('aria-pressed', String(Boolean(next)));
  return row;
}

/** Formatea segundos como m:ss.mmm o s.mmm. */
export function formatTime(ms, { sign = false } = {}) {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return '—';
  const total = Math.abs(ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  const body = m > 0
    ? `${m}:${s.toFixed(3).padStart(6, '0')}`
    : s.toFixed(3);
  if (!sign) return body;
  return `${ms < 0 ? '-' : '+'}${body}`;
}

/** Diferencia con signo para tablas de clasificación. */
export function formatGap(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (Math.abs(ms) < 1) return '—';
  return formatTime(ms, { sign: true });
}

export function formatKmh(mps, units = 'metric') {
  if (!Number.isFinite(mps)) return '—';
  return units === 'imperial' ? `${Math.round(mps * 2.23694)} mph` : `${Math.round(mps * 3.6)} km/h`;
}

/** Fecha ISO a «sáb 6 mar». */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const days = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}
