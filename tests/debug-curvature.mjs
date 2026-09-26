import { CIRCUITS } from "../js/data/circuits-data.js";
import { Track } from "../js/game/track.js";

console.log("circuit       minR   maxK  tightest corners (radius m)      narrowest");
for (const def of CIRCUITS) {
  const t = new Track(def);
  const radii = t.corners.map(c => 1 / Math.abs(t.rlKappa[c.index]));
  radii.sort((a, b) => a - b);
  const minHalf = Math.min(...t.halfWidth);
  // A corner is geometrically impossible if the inside radius is smaller than
  // the track half-width (the car would have nowhere to go).
  const impossible = t.corners.filter(c => {
    const r = 1 / Math.abs(t.rlKappa[c.index]);
    return r < t.halfWidth[c.index] * 1.15;
  });
  console.log(`${def.short.padEnd(13)} ${(1/Math.max(...Array.from(t.rlKappa).map(Math.abs))).toFixed(0).padStart(4)}m ` +
    `${Math.max(...Array.from(t.rlKappa).map(Math.abs)).toFixed(4)}  ` +
    radii.slice(0, 4).map(r => r.toFixed(0).padStart(5)).join(" ") +
    `   ${(minHalf*2).toFixed(0)}m` +
    (impossible.length ? `  !! ${impossible.length} impossible corner(s): T${impossible.map(c=>c.number).join(",T")}` : ""));
}
