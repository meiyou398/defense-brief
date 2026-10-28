import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { geoPath, geoGraticule10 } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { WIDTH, HEIGHT, makeProjection, markerPosition, groupMarkers } from '../lib/projection.mjs';

const args = process.argv.slice(2);
const arg = key => { const index = args.indexOf(key); return index < 0 ? null : args[index + 1]; };
if (arg('--issue')) {
  const issue = JSON.parse(await readFile(arg('--issue'), 'utf8'));
  const onMap = [];
  let us = 0, none = 0;
  for (const [index, item] of issue.sections.flatMap(s => s.items).entries()) {
    const n = String(index + 1).padStart(2, '0');
    const position = markerPosition(item.location);
    if (position) onMap.push({ n, ...position });
    else if (item.location?.offMap === 'us') us++;
    else none++;
    console.log(n, item.location?.name || '未定位', position || '（不在图上）');
  }
  const groups = groupMarkers(onMap);
  console.log(`有坐标 ${onMap.length} 条，合成后地图上 ${groups.length} 个标记；美国本土 ${us} 条，未定位 ${none} 条`);
  for (const group of groups.filter(group => group.length > 1)) console.log(`组标记：${group.map(marker => marker.n).join(' · ')}`);
} else {
  const resolution = arg('--res') || '110m';
  if (!['110m', '50m'].includes(resolution)) throw new Error('精度只能为 110m 或 50m');
  const require = createRequire(import.meta.url);
  const world = JSON.parse(await readFile(require.resolve(`world-atlas/countries-${resolution}.json`), 'utf8'));
  const path = geoPath(makeProjection()).digits(1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="900" height="640" fill="#ECECE8"/><path d="${path(geoGraticule10())}" fill="none" stroke="#E0E0DB" stroke-width=".6"/><path d="${path(feature(world, world.objects.land))}" fill="#FFFFFF" stroke="#B5B5AE" stroke-width=".6"/><path d="${path(mesh(world, world.objects.countries, (a, b) => a !== b))}" fill="none" stroke="#D6D6D0" stroke-width=".5"/></svg>`;
  if (Buffer.byteLength(svg) > 150_000) throw new Error('底图超过 150KB；上线请使用 --res 110m');
  await writeFile(new URL('../assets/map-h.svg', import.meta.url), svg);
  console.log(`map-h.svg ${Buffer.byteLength(svg)} bytes (${resolution})`);
}
