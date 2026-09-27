// DOM mínimo para probar la capa de interfaz en Node: implementa solo lo que
// usan `el()` y las pantallas (creación de nodos, selectores simples, estilos,
// atributos, escuchas y texto). No es un navegador, es un doble de prueba.

class Style {
  setProperty(name, value) { this[name] = value; }
  getPropertyValue(name) { return this[name] ?? ''; }
  removeProperty(name) { delete this[name]; }
}

class ClassList {
  constructor(node) { this.node = node; }
  get _set() { return new Set((this.node.className || '').split(/\s+/).filter(Boolean)); }
  add(...names) { const s = this._set; names.forEach((n) => s.add(n)); this.node.className = [...s].join(' '); }
  remove(...names) { const s = this._set; names.forEach((n) => s.delete(n)); this.node.className = [...s].join(' '); }
  contains(name) { return this._set.has(name); }
  toggle(name, force) {
    const has = this.contains(name);
    const next = force === undefined ? !has : Boolean(force);
    if (next) this.add(name); else this.remove(name);
    return next;
  }
}

class TextNode {
  constructor(text) { this.nodeType = 3; this.textContent = String(text); this.childNodes = []; }
  get firstChild() { return null; }
  removeChild() { return null; }
}

class Element {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.childNodes = [];
    this.parentNode = null;
    this.className = '';
    this.id = '';
    this.style = new Style();
    this.dataset = {};
    this.attrs = {};
    this.listeners = {};
    this._text = '';
    this.classList = new ClassList(this);
    this.value = '';
    this.disabled = false;
    this.checked = false;
  }

  get firstChild() { return this.childNodes[0] || null; }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get previousElementSibling() {
    if (!this.parentNode) return null;
    const sibs = this.parentNode.children;
    const i = sibs.indexOf(this);
    return i > 0 ? sibs[i - 1] : null;
  }
  get nextElementSibling() {
    if (!this.parentNode) return null;
    const sibs = this.parentNode.children;
    const i = sibs.indexOf(this);
    return i >= 0 && i < sibs.length - 1 ? sibs[i + 1] : null;
  }

  get textContent() {
    if (this.childNodes.length) return this.childNodes.map((n) => n.textContent).join('');
    return this._text;
  }

  set textContent(value) {
    this.childNodes = [];
    this._text = value === null || value === undefined ? '' : String(value);
  }

  set innerHTML(value) { this._text = String(value); }

  append(...nodes) {
    for (const node of nodes) {
      if (node === null || node === undefined || node === false) continue;
      const child = node instanceof Element || node instanceof TextNode ? node : new TextNode(node);
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }

  removeChild(child) {
    const i = this.childNodes.indexOf(child);
    if (i >= 0) this.childNodes.splice(i, 1);
    child.parentNode = null;
    return child;
  }

  remove() { if (this.parentNode) this.parentNode.removeChild(this); }

  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  removeAttribute(name) { delete this.attrs[name]; }
  hasAttribute(name) { return name in this.attrs; }

  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }

  dispatch(type, event = {}) {
    for (const fn of this.listeners[type] || []) fn({ type, target: this, preventDefault() {}, ...event });
  }

  /* Selectores: descendantencia de etiquetas, clases, id y atributos. */
  _matches(sel) {
    if (sel.startsWith('[')) {
      const m = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(sel);
      if (!m) return false;
      const attr = m[1];
      const raw = attr.startsWith('data-') ? attr.slice(5) : null;
      const candidates = raw === null ? [] : [raw, camel(raw)];
      const found = candidates.find((k) => k in this.dataset);
      const value = (found ? this.dataset[found] : null) ?? this.getAttribute(attr);
      return m[2] === undefined ? value !== null && value !== undefined : String(value) === m[2];
    }
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    const [tag, ...classes] = sel.split('.');
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    return classes.every((c) => this.classList.contains(c));
  }

  _walk(out) {
    for (const child of this.children) {
      out.push(child);
      child._walk(out);
    }
    return out;
  }

  querySelectorAll(sel) {
    const parts = sel.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    let pool = this._walk([]);
    for (let i = 0; i < parts.length - 1; i++) {
      pool = pool.filter((node) => {
        let p = node.parentNode;
        while (p) { if (p._matches && p._matches(parts[i])) return true; p = p.parentNode; }
        return false;
      });
    }
    return pool.filter((node) => node._matches(last));
  }

  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }

  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }; }

  /* Contexto de canvas tolerante: acepta cualquier método. */
  getContext() {
    if (!this._ctx) {
      const gradient = { addColorStop() {} };
      const base = {
        measureText: (t) => ({ width: String(t).length * 6 }),
        createLinearGradient: () => gradient,
        createRadialGradient: () => gradient,
        createPattern: () => null,
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
      };
      this._ctx = new Proxy(base, {
        get: (target, prop) => (prop in target ? target[prop] : () => undefined),
        set: (target, prop, value) => { target[prop] = value; return true; },
      });
    }
    return this._ctx;
  }
}

/** Analizador mínimo de HTML: construye el árbol con estos mismos nodos. */
export function parseHtml(html) {
  const VOID = new Set(['meta', 'link', 'br', 'hr', 'img', 'input', 'source', 'col', 'area', 'base', 'embed', 'param', 'track', 'wbr']);
  const root = new Element('#root');
  const stack = [root];
  const clean = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!doctype[^>]*>/gi, '');

  const push = (node) => {
    const parent = stack[stack.length - 1];
    if (node.nodeType === 1) parent.append(node);
    else if (String(node.textContent).trim()) parent.append(new TextNode(node.textContent.replace(/\s+/g, ' ')));
  };

  const tokenRe = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+)/g;
  let m;
  while ((m = tokenRe.exec(clean))) {
    const [raw, tag, rawAttrs, text] = m;
    if (text !== undefined) {
      push(new TextNode(text));
      continue;
    }
    if (raw.startsWith('</')) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; }
      }
      continue;
    }
    const node = new Element(tag);
    const attrRe = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = attrRe.exec(rawAttrs || ''))) {
      const name = a[1].toLowerCase();
      const value = a[2] ?? a[3] ?? a[4] ?? '';
      if (name === 'class') node.className = value;
      else if (name === 'id') node.id = value;
      else if (name === 'style') {
        for (const decl of value.split(';')) {
          const [prop, val] = decl.split(':');
          if (prop && val) node.style[prop.trim()] = val.trim();
        }
      } else if (name.startsWith('data-')) {
        node.dataset[camel(name.slice(5))] = value;
        node.setAttribute(name, value);
      } else {
        node.setAttribute(name, value);
        if (name === 'hidden') node.hidden = true;
        else if (name in node) node[name] = value;
      }
    }
    push(node);
    const lower = tag.toLowerCase();
    if (!VOID.has(lower) && !raw.endsWith('/>') && lower !== 'script' && lower !== 'style') stack.push(node);
  }
  return root;
}

/** Instala `document`, `Node` y `window` mínimos en el entorno global. */
export function installDom(html = null) {
  const built = html ? parseHtml(html) : null;
  const body = built ? (built.querySelector('body') || new Element('body')) : new Element('body');
  const document = {
    body,
    documentElement: built ? (built.querySelector('html') || new Element('html')) : new Element('html'),
    readyState: 'complete',
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => new TextNode(text),
    getElementById: (id) => body.querySelector(`#${id}`),
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    addEventListener(type, fn) { (this.listeners ||= {})[type] = fn; },
    removeEventListener() {},
    listeners: {},
    hidden: false,
    visibilityState: 'visible',
  };
  globalThis.document = document;
  globalThis.Node = Element;
  globalThis.Text = TextNode;
  globalThis.window = globalThis.window || {};
  globalThis.window.document = document;
  globalThis.window.innerWidth = globalThis.window.innerWidth || 1400;
  globalThis.window.innerHeight = globalThis.window.innerHeight || 800;
  globalThis.window.devicePixelRatio = globalThis.window.devicePixelRatio || 1;
  globalThis.window.listeners = {};
  globalThis.window.addEventListener = function add(type, fn) { (this.listeners[type] ||= []).push(fn); };
  globalThis.window.removeEventListener = function remove(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  };
  globalThis.window.dispatch = (type, event = {}) => {
    for (const fn of globalThis.window.listeners[type] || []) fn({ type, ...event });
  };
  globalThis.window.dispatchEvent = (event) => {
    const type = typeof event === 'string' ? event : event.type;
    for (const fn of globalThis.window.listeners[type] || []) fn(event);
    return true;
  };
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; Object.assign(this, init); }
  };
  globalThis.Event = globalThis.CustomEvent;
  globalThis.window.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
  globalThis.window.cancelAnimationFrame = (id) => clearTimeout(id);
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
  globalThis.cancelAnimationFrame = globalThis.window.cancelAnimationFrame;
  return { document, body, root: built, Element };
}

export { Element, TextNode };

function camel(name) {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
