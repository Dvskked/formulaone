// Sello de compilacion. build.mjs sustituye la marca por la fecha real al
// empaquetar; si se ejecutan los modulos sueltos sin compilar, se lee el que
// haya puesto el paquete anterior o se avisa de que no hay sello.
const MARCA = 'PENDIENTE_BUILD_MJS';

export const BUILD = MARCA === 'PENDIENTE_BUILD_MJS'
  ? (globalThis.__BUILD__ || 'modulos sueltos')
  : MARCA;
