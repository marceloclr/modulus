// Coleta do vento por mês (rosa dos ventos) para a animação do gerador.
// Fonte: Open-Meteo Historical Weather API (reanálise ERA5, grade de 0,25°), dados horários a 10 m, 2015–2024,
// grátis para uso não comercial, licença CC BY 4.0. Conferência das médias com a NASA POWER (climatologia WS10M).
// Uso: node tools/coleta-vento.mjs   → grava dados/vento.json
import fs from 'node:fs';

const LOCAL = {nome:'Fortaleza', lat:-3.73, lon:-38.52};
const INICIO = '2015-01-01', FIM = '2024-12-31', SETORES = 16, CALMA = 0.5;
const API = `https://archive-api.open-meteo.com/v1/archive?latitude=${LOCAL.lat}&longitude=${LOCAL.lon}&start_date=${INICIO}&end_date=${FIM}` +
  `&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=America%2FFortaleza`;
const POWER = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=WS10M&community=RE&longitude=${LOCAL.lon}&latitude=${LOCAL.lat}&format=JSON`;
const r1 = n => Math.round(n * 10) / 10, r2 = n => Math.round(n * 100) / 100;
const MESES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const j = await (await fetch(API)).json();
if(!j.hourly) throw new Error('resposta inesperada do Open-Meteo: ' + JSON.stringify(j).slice(0, 200));
const {time, wind_speed_10m: vel, wind_direction_10m: dir} = j.hourly;
const meses = Array.from({length:12}, (_, i) => ({mes:i + 1, n:0, calmas:0, soma:0, u:0, v:0, rosa:Array.from({length:SETORES}, () => ({n:0, soma:0})), hora:Array.from({length:24}, () => ({n:0, soma:0}))}));
for(let i = 0; i < time.length; i++){
  const s = vel[i], d = dir[i]; if(s == null || d == null) continue;
  const m = meses[+time[i].slice(5, 7) - 1], h = +time[i].slice(11, 13);
  m.n++; m.soma += s; m.hora[h].n++; m.hora[h].soma += s;
  // vetor de onde o vento vem (direção meteorológica), para a direção média
  m.u += s * Math.sin(d * Math.PI / 180); m.v += s * Math.cos(d * Math.PI / 180);
  if(s < CALMA){ m.calmas++; continue; }
  const k = Math.round(d / (360 / SETORES)) % SETORES; m.rosa[k].n++; m.rosa[k].soma += s;
}
let power = null;
try{ const p = await (await fetch(POWER)).json(); const ws = p.properties.parameter.WS10M; power = MESES.map(k => r2(ws[k])); }catch(e){ console.warn('NASA POWER indisponível:', e.message); }

const saida = {
  versao:1,
  fonte:'Open-Meteo Historical Weather API (reanálise ERA5, ECMWF/Copernicus), dados horários a 10 m',
  url:'https://open-meteo.com/en/docs/historical-weather-api',
  licenca:'CC BY 4.0 · uso não comercial gratuito; atribuição: Weather data by Open-Meteo.com',
  nota:'Velocidades do ERA5 (grade de 0,25°) ficam cerca de 1,5 m/s abaixo da NASA POWER (MERRA-2); a sazonalidade coincide (máximo em setembro, mínimo em março/abril). Servem para o clima regional, não para o vento local entre edificações.',
  local:{nome:LOCAL.nome, lat:LOCAL.lat, lon:LOCAL.lon, gradeLat:r2(j.latitude), gradeLon:r2(j.longitude)},
  periodo:{inicio:INICIO, fim:FIM}, coletadoEm:new Date().toISOString().slice(0, 10),
  setores:SETORES, calmaLimite:CALMA,
  conferencia: power ? {fonte:'NASA POWER, climatologia WS10M (m/s)', ws10m:power} : null,
  meses: meses.map((m, i) => {
    const rosa = m.rosa.map((x, k) => ({dir:k * 360 / SETORES, freq:r1(100 * x.n / m.n), vel:x.n ? r1(x.soma / x.n) : 0}));
    const top = rosa.reduce((a, b) => b.freq > a.freq ? b : a);
    return {mes:i + 1, horas:m.n, velMedia:r2(m.soma / m.n), calmaria:r1(100 * m.calmas / m.n),
      dirMedia:Math.round((Math.atan2(m.u, m.v) * 180 / Math.PI + 360) % 360), dirPredominante:top.dir,
      rosa, velHora:m.hora.map(x => r2(x.soma / x.n))};
  }),
};
fs.writeFileSync(new URL('../dados/vento.json', import.meta.url), JSON.stringify(saida, null, 1) + '\n');
console.log('dados/vento.json:', saida.meses.map(m => `${m.mes}: ${m.velMedia} m/s de ${m.dirPredominante}°`).join(' · '));
if(power) console.log('NASA POWER WS10M:', power.join(' · '));
