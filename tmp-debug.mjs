import { buildTrack } from "./js/game/track.js";
import { createSession, updateSession } from "./js/game/race.js";
import { getCircuit } from "./js/data/circuits.js";
import { makeRng } from "./js/core/rng.js";
import { createCareer, currentRound } from "./js/game/career.js";
import { DEFAULT_SETTINGS } from "./js/core/storage.js";
const career = createCareer({name:"T",birthDate:"2004-05-14",country:"ESP",helmetPrimary:"#e10600",helmetSecondary:"#fff",helmetStyle:"x"},{series:"f1",seed:21});
const round = { ...currentRound(career), circuitId:"monaco", sessions:[{id:"q1",type:"quali",name:"Q1",segment:0},{id:"q2",type:"quali",name:"Q2",segment:1},{id:"q3",type:"quali",name:"Q3",segment:2}] };
const circuit = getCircuit("monaco");
const st = createSession({ circuit, entryList: career.entryList, kind:"quali", round, settings: DEFAULT_SETTINGS, seed:5 });
const input = {steer:0,throttle:1,brake:0,drsPressed:false,edges:{}};
const dt=1/30;
for (let t=0;t<70;t+=dt){
  updateSession(st,dt,input);
  if (Math.abs(t%10)<dt/2) {
    const lead = st.order[0];
    console.log(`t=${t.toFixed(1)} clock=${st.clock.toFixed(1)} lead=${lead.name} dist=${lead.dist.toFixed(0)} lap=${lead.lap} v=${lead.speed.toFixed(1)} best=${lead.bestLapMs}`);
  }
}
console.log('segments', st.segmentsDone.map(s=>s.rows.length));
