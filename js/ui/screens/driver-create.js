// Creación del piloto: perfil, casco, escudería y asiento en la parrilla de F2.

import { el, button, segmented } from '../dom.js';
import { COUNTRIES, HELMET_COLORS, HELMET_SKINS, validateBirth, MIN_AGE, MAX_AGE } from '../../data/countries.js';
import { teamsFor } from '../../data/teams.js';
import { driversFor } from '../../data/drivers.js';
import { createCareer } from '../../game/career.js';
import { averageRating } from '../../data/drivers.js';
import { ctx } from '../context.js';

const NAME_RE = /^[\p{L}][\p{L}' -]{2,28}$/u;

export const driverCreateScreen = {
  id: 'driver-create',
  title: 'Nuevo piloto',
  subtitle: 'Tu carrera empieza en Fórmula 2',

  render(shell) {
    const form = {
      name: '',
      birthDate: '2004-03-14',
      country: 'ESP',
      helmetPrimary: '#e8112d',
      helmetSecondary: '#ffffff',
      helmetStyle: 'rayas',
      teamId: null,
      replaceDriverId: undefined,
    };

    const preview = el('div.card.accent');
    const errorBox = el('div.banner.danger', { text: '', style: { display: 'none' } });
    const nameErr = el('div.err');
    const birthErr = el('div.err');

    const nameInput = el('input', { type: 'text', maxLength: 29, placeholder: 'Nombre y apellidos', autocomplete: 'off' });
    const birthInput = el('input', {
      type: 'date',
      value: form.birthDate,
      min: `${2026 - MAX_AGE}-01-01`,
      max: `${2026 - MIN_AGE}-12-31`,
    });
    const countrySelect = el('select', null, COUNTRIES.map((c) => el('option', { value: c.code, text: `${c.flag} ${c.name}` })));
    countrySelect.value = form.country;

    const teamList = el('div.pick-list');
    const seatBox = el('div');
    const helmetPreview = el('div.helmet', { 'aria-hidden': 'true' });
    const styleBox = el('div.field');

    const showError = (text) => {
      errorBox.textContent = text;
      errorBox.style.display = '';
    };

    const renderPreview = () => {
      const name = form.name.trim() || 'Tu nombre';
      const birth = validateBirth(form.birthDate);
      const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
      helmetPreview.style.setProperty('--helmet-a', form.helmetPrimary);
      helmetPreview.style.setProperty('--helmet-b', form.helmetSecondary);
      helmetPreview.dataset.style = form.helmetStyle;
      preview.textContent = '';
      preview.append(
        el('div.row', { style: { alignItems: 'flex-start' } }, [
          helmetPreview,
          el('div.grow', null, [
            el('div', { style: { fontSize: '19px', fontWeight: '800' }, text: name }),
            el('div.dim', { style: { fontSize: '12px' }, text: `${initials} · ${form.country} · ${birth.ok ? `${birth.age} años` : 'fecha por confirmar'}` }),
            el('div.row.row-tight', { style: { marginTop: '6px' } }, [
              el('span.chip.chip-red', { text: 'F2 2026' }),
              el('span.chip', { text: form.helmetStyle }),
            ]),
          ]),
        ]),
      );
    };

    const renderSeats = () => {
      seatBox.textContent = '';
      if (!form.teamId) {
        seatBox.append(el('div.hint', { text: 'Elige una escudería para ver sus pilotos titulares.' }));
        return;
      }
      const roster = driversFor('f2').filter((d) => d.teamId === form.teamId);
      seatBox.append(
        el('div.hint', { text: 'Copiar el asiento de un titular te da su media de atributos, pero ese piloto sale de la lista.' }),
        el('div.pick-list', { style: { marginTop: '8px' } }, [
          seatOption(null, 'Asiento libre', 'Recurso joven sin referencia · base 72'),
          ...roster.map((d) => seatOption(d.id, `Sustituye a ${d.name}`, `Base ${Math.round(averageRating(d.ratings))} · ${d.traits?.[0] || 'piloto titular'}`)),
        ]),
      );
    };

    const seatOption = (id, title, desc) => el('button.pick', {
      type: 'button',
      'aria-pressed': String((form.replaceDriverId ?? null) === (id ?? null)),
      on: { click: () => { form.replaceDriverId = id ?? null; renderSeats(); } },
    }, [
      el('span.swatch-team', { style: { background: id ? '#2f3648' : 'var(--green)' } }),
      el('span.grow', null, [el('span.t', { text: title }), el('span.d', { text: desc })]),
    ]);

    const renderTeams = () => {
      const teams = teamsFor('f2').slice().sort((a, b) => (a.tier || 0) - (b.tier || 0));
      if (form.teamId && !teams.some((t) => t.id === form.teamId)) {
        form.teamId = null;
        form.replaceDriverId = undefined;
      }
      teamList.textContent = '';
      for (const team of teams) {
        teamList.append(el('button.pick', {
          type: 'button',
          'aria-pressed': String(form.teamId === team.id),
          on: {
            click: () => {
              form.teamId = team.id;
              form.replaceDriverId = undefined;
              renderTeams();
              renderSeats();
            },
          },
        }, [
          el('span.swatch-team', { style: { background: team.livery.primary } }),
          el('span.grow', null, [
            el('span.t', { text: team.name }),
            el('span.d', { text: `Potencia ${team.car.power} · Aerodinámica ${team.car.aero} · Fiabilidad ${team.car.reliability} · Presupuesto ${team.car.budget}` }),
          ]),
          el('span.chip', { text: team.tier === 1 ? 'Aspirante' : team.tier === 2 ? 'Media' : 'Modesta' }),
        ]));
      }
    };

    const swatchRow = (values, onPick) => {
      const row = el('div.swatches');
      for (const item of values) {
        row.append(el('button.swatch', {
          type: 'button',
          title: item.name,
          'aria-label': item.name,
          style: { background: `linear-gradient(140deg, ${item.primary} 0 55%, ${item.secondary} 55% 100%)` },
          on: { click: () => onPick(item) },
        }));
      }
      return row;
    };

    const renderStyles = () => {
      styleBox.textContent = '';
      styleBox.append(
        el('label', { text: 'Diseño' }),
        segmented(HELMET_SKINS.map((s) => ({ value: s.id, label: s.name })), form.helmetStyle, (value) => {
          form.helmetStyle = value;
          renderPreview();
        }),
      );
    };

    const start = async () => {
      const name = form.name.trim();
      if (!NAME_RE.test(name)) {
        nameErr.textContent = 'Entre 3 y 29 letras, sin números.';
        nameInput.classList.add('invalid');
        nameInput.focus();
        return;
      }
      nameErr.textContent = '';
      nameInput.classList.remove('invalid');
      const birth = validateBirth(form.birthDate);
      if (!birth.ok) {
        birthErr.textContent = birth.error;
        return;
      }
      birthErr.textContent = '';
      try {
        ctx.career = createCareer(form, {
          seed: `${name}|${form.birthDate}|${form.country}|${Date.now()}`,
          teamId: form.teamId || undefined,
          replaceDriverId: form.replaceDriverId,
        });
      } catch (err) {
        showError(err.message);
        return;
      }
      const { showPaddock } = await import('./paddock.js');
      shell.stack.length = 0;
      await showPaddock(shell, { fresh: true });
    };

    nameInput.addEventListener('input', () => { form.name = nameInput.value; renderPreview(); });
    birthInput.addEventListener('input', () => { form.birthDate = birthInput.value; renderPreview(); });
    countrySelect.addEventListener('change', () => { form.country = countrySelect.value; renderPreview(); });

    renderTeams();
    renderSeats();
    renderStyles();
    renderPreview();

    shell.mount(el('div.screen', null, [
      el('div.screen-head', null, [
        el('div', null, [
          el('h2', { text: 'Crea tu piloto' }),
          el('div.sub', { text: `Fórmula 2 2026. Debut en el Albert Park. Para correr en 2026 necesitas entre ${MIN_AGE} y ${MAX_AGE} años.` }),
        ]),
        button('Comenzar carrera', { kind: 'primary', large: true, onClick: start }),
      ]),
      errorBox,
      el('div.grid.grid-side', null, [
        el('div.stack', null, [
          el('div.card', null, [
            el('h3', { text: 'Perfil' }),
            el('div.grid.grid-2', null, [
              el('div.field', null, [el('label', { text: 'Nombre' }), nameInput, nameErr]),
              el('div.field', null, [el('label', { text: 'Fecha de nacimiento' }), birthInput, birthErr]),
            ]),
            el('div.field', { style: { marginTop: '10px' } }, [el('label', { text: 'Nacionalidad' }), countrySelect]),
          ]),
          el('div.card', null, [
            el('h3', { text: 'Casco' }),
            el('div.row', { style: { alignItems: 'flex-start' } }, [
              helmetPreview,
              el('div.grow.stack', null, [
                el('div.field', null, [
                  el('label', { text: 'Colores' }),
                  swatchRow(HELMET_COLORS, (item) => {
                    form.helmetPrimary = item.primary;
                    form.helmetSecondary = item.secondary;
                    renderPreview();
                  }),
                ]),
                styleBox,
              ]),
            ]),
          ]),
          el('div.card', null, [
            el('div.row.between', null, [
              el('h3', { text: 'Escudería' }),
              button('Al azar', { kind: 'ghost', small: true, title: 'Elegir equipo al azar', onClick: () => { form.teamId = null; form.replaceDriverId = undefined; renderTeams(); renderSeats(); } }),
            ]),
            teamList,
          ]),
          el('div.card', null, [el('h3', { text: 'Asiento en la parrilla' }), seatBox]),
        ]),
        el('div.stack', null, [
          preview,
          el('div.info-card', null, [
            el('h3', { text: 'Tu camino' }),
            el('ul', null, [
              el('li', { text: 'Temporada de debut en F2 con 14 citas.' }),
              el('li', { text: 'Termina entre los tres primeros para subir a F1.' }),
              el('li', { text: 'Repite la temporada si no alcanzas el objetivo.' }),
              el('li', { text: 'Objetivos del jefe, buzón y garage entre semana.' }),
            ]),
          ]),
        ]),
      ]),
    ]));
  },
};
