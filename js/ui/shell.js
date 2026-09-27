// Shell de la aplicación: barra superior con navegación por pestañas,
// pila de pantallas, avisos emergentes y modales.

import { el, clear, button } from './dom.js';

export class Shell {
  /**
   * @param {{appbar: HTMLElement, body: HTMLElement, toasts: HTMLElement, modalRoot: HTMLElement}} nodes
   */
  constructor(nodes) {
    this.appbar = nodes.appbar;
    this.body = nodes.body;
    this.toasts = nodes.toasts;
    this.modalRoot = nodes.modalRoot;
    this.stack = [];
    this.current = null;
    this.activeId = null;
    this.modalStack = [];
    this.navItems = [];
    this.onNavigate = null;
  }

  /** Define las pestañas de la barra superior. */
  setNav(items) {
    this.navItems = items;
    this.renderNav();
  }

  /** Marca la pestaña activa. */
  setActive(id) {
    this.activeId = id;
    this.renderNav();
  }

  renderNav() {
    if (!this.navHost) return;
    this.navHost.textContent = '';
    for (const item of this.navItems) {
      this.navHost.append(button(item.label, {
        kind: 'ghost',
        small: true,
        pressed: this.activeId === item.id,
        title: item.title || item.label,
        onClick: () => this.onNavigate?.(item.id),
      }));
    }
  }

  setChrome({ title, subtitle, chips = [] }) {
    clear(this.appbar);
    const back = this.stack.length > 1
      ? button('‹', { kind: 'ghost', title: 'Volver', onClick: () => this.back() })
      : null;
    const nav = el('div.chips');
    this.navHost = nav;
    this.renderNav();
    this.appbar.append(
      back,
      el('div.title', null, [el('b', { text: title }), el('span', { text: subtitle })]),
      el('div.spacer'),
      ...chips.map((chip) => (typeof chip === 'string'
        ? el('span.chip', { text: chip })
        : el('span.chip', { class: chip.kind || '' }, chip.label))),
      nav,
    );
  }

  /** Muestra una pantalla. Cada pantalla recibe (shell, params). */
  async show(screen, params = {}) {
    const previous = this.current;
    if (screen.keepAlive !== false && previous) this.stack.push(previous);
    this.current = screen;
    await screen.render?.(this, params);
    if (screen.title !== undefined) {
      this.setChrome({
        title: typeof screen.title === 'function' ? screen.title(params) : screen.title,
        subtitle: screen.subtitle ? (typeof screen.subtitle === 'function' ? screen.subtitle(params) : screen.subtitle) : '',
        chips: screen.chips ? (typeof screen.chips === 'function' ? screen.chips(params) : screen.chips) : [],
      });
    }
  }

  /** Reemplaza la pantalla actual sin apilar. */
  async replace(screen, params = {}) {
    this.current = screen;
    await screen.render?.(this, params);
  }

  back() {
    const prev = this.stack.pop();
    if (!prev) return false;
    this.current = prev;
    prev.render?.(this, {});
    if (prev.title !== undefined) {
      this.setChrome({
        title: typeof prev.title === 'function' ? prev.title({}) : prev.title,
        subtitle: prev.subtitle ? (typeof prev.subtitle === 'function' ? prev.subtitle({}) : prev.subtitle) : '',
        chips: prev.chips ? (typeof prev.chips === 'function' ? prev.chips({}) : prev.chips) : [],
      });
    }
    return true;
  }

  get host() {
    return this.body;
  }

  /** Limpia el cuerpo antes de montar una pantalla. */
  mount(...children) {
    clear(this.body);
    this.body.append(...children);
  }

  toast(text, kind = '') {
    const node = el(`div.toast${kind ? `.${kind}` : ''}`, { text });
    this.toasts.append(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 260);
    }, kind === 'bad' ? 4200 : 3000);
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove();
  }

  /** Abre un modal. Devuelve una promesa con el valor de `close`. */
  modal({ title, body, actions = [], dismissable = true, onClose }) {
    return new Promise((resolve) => {
      const close = (value) => {
        this.modalStack = this.modalStack.filter((m) => m !== entry);
        if (!this.modalStack.length) {
          clear(this.modalRoot);
          this.modalRoot.hidden = true;
        }
        onClose?.(value);
        resolve(value);
      };
      const entry = { close };
      this.modalStack.push(entry);
      const panel = el('div.modal', { role: 'dialog', 'aria-modal': 'true' }, [
        title ? el('h3', { text: title }) : null,
        body ? el('div.modal-body', null, body) : null,
        actions.length
          ? el('div.actions', null, actions.map((a) => button(a.label, {
            kind: a.kind || 'ghost',
            onClick: () => close(a.value ?? a.label),
          })))
          : null,
      ]);
      clear(this.modalRoot);
      this.modalRoot.append(panel);
      this.modalRoot.hidden = false;
      this.modalRoot.onclick = (e) => { if (dismissable && e.target === this.modalRoot) close(null); };
      const first = panel.querySelector('button');
      first?.focus();
    });
  }

  closeAllModals() {
    for (const entry of [...this.modalStack]) entry.close(null);
  }
}
