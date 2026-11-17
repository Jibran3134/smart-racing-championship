import { projectCar } from '../map/map-model';
import type { RaceViewState } from '../../adapters/race-view';

export interface RaceCamera { mode: 'follow' | 'overview'; carId: number; zoom: number; labels: boolean; reducedMotion: boolean }
export interface SceneCache { angles: Map<number, number>; time: number }

function line(ctx: CanvasRenderingContext2D, x: number, y: number, endX: number, endY: number, width: number, color: string) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(endX, endY); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = color; ctx.fill();
}

/** Detailed code-native racing car, nose points right. No bitmap assets needed. */
export function drawRacingCar(ctx: CanvasRenderingContext2D, color: string, braking: boolean, boosting: boolean, clock: number, id: number) {
  ctx.save();
  ctx.shadowColor = '#000a'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3;
  rounded(ctx, -18, -7, 37, 14, 6, '#070c10');
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (boosting) {
    const plume = 14 + Math.sin(clock * 43 + id) * 5;
    ctx.beginPath(); ctx.moveTo(-17, -4); ctx.lineTo(-23 - plume, 0); ctx.lineTo(-17, 4); ctx.fillStyle = '#37baff99'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-17, -2); ctx.lineTo(-21 - plume * 0.7, 0); ctx.lineTo(-17, 2); ctx.fillStyle = '#d4fbff'; ctx.fill();
  }
  for (const x of [-12, 10]) for (const y of [-12, 7]) {
    rounded(ctx, x - 4, y, 9, 5, 1.5, '#090b0d');
    line(ctx, x - 2, y + 1, x + 3, y + 1, 0.7, '#5f6265');
  }
  // Suspension, rear wing, tapered monocoque and front wing.
  line(ctx, -10, -9, 12, 9, 1, '#788180'); line(ctx, -10, 9, 12, -9, 1, '#788180');
  rounded(ctx, -20, -11, 5, 22, 1, '#111820');
  rounded(ctx, -19, -11, 2, 22, 0.5, color);
  ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(1, -7); ctx.lineTo(17, -3); ctx.lineTo(19, 0); ctx.lineTo(17, 3); ctx.lineTo(1, 7); ctx.lineTo(-15, 7); ctx.closePath();
  const paint = ctx.createLinearGradient(0, -8, 0, 8); paint.addColorStop(0, '#f3ffff'); paint.addColorStop(0.16, color); paint.addColorStop(0.8, color); paint.addColorStop(1, '#182924'); ctx.fillStyle = paint; ctx.fill();
  rounded(ctx, 15, -10, 4, 20, 1, '#121b21');
  rounded(ctx, 16, -10, 2, 20, 0.5, color);
  rounded(ctx, -4, -4, 9, 8, 3, '#101a23');
  ctx.strokeStyle = '#b5c8cd'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 4, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.fillStyle = '#f4e8c1'; ctx.beginPath(); ctx.arc(-1, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  line(ctx, 6, 0, 15, 0, 1.5, '#f8ffffaa');
  line(ctx, -13, -4.5, -6, -4.5, 1, '#faffff88');
  if (braking) { ctx.shadowColor = '#ff263a'; ctx.shadowBlur = 5; rounded(ctx, -20.5, -2, 2, 4, 0.5, '#ff334b'); }
  ctx.restore();
}

export function drawRaceScene(ctx: CanvasRenderingContext2D, width: number, height: number, state: RaceViewState, camera: RaceCamera, cache: SceneCache) {
  const vertices = new Map(state.track.vertices.map((vertex) => [vertex.id, vertex]));
  const target = state.cars.find((car) => car.id === camera.carId) ?? state.cars[0];
  const point = target ? projectCar(state.track, { ...target, laneOffset: 0 }) : null;
  const follow = camera.mode === 'follow' && point;
  const scale = (follow ? Math.min(width / 510, height / 390) : Math.min(width / 990, height / 610)) * camera.zoom;
  const cx = follow ? point.x : 460;
  const cy = follow ? point.y : 270;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#253a30'; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate(width / 2, height / 2); ctx.scale(scale, scale); ctx.translate(-cx, -cy);
  ctx.fillStyle = '#284333'; ctx.fillRect(-3000, -3000, 6000, 6000);
  // Deterministic grass bands and grounds: decorative only.
  for (let y = -600; y < 1100; y += 36) { ctx.fillStyle = y % 72 === 0 ? '#2b4735' : '#294231'; ctx.fillRect(-1000, y, 3000, 36); }
  const buildings = [[275, 170, 105, 46], [360, 335, 80, 48], [570, 170, 80, 46], [665, 305, 53, 67], [225, 330, 65, 39]];
  for (const [x, y, w, h] of buildings) {
    rounded(ctx, x + 4, y + 6, w, h, 3, '#101c2099'); rounded(ctx, x, y, w, h, 3, '#526066'); rounded(ctx, x + 3, y + 3, w - 6, h - 6, 2, '#737d7c');
    for (let column = x + 10; column < x + w - 8; column += 14) rounded(ctx, column, y + 10, 7, 8, 1, '#465454');
  }
  // Trees remain stationary across frames and replays.
  for (let index = 0; index < 48; index++) {
    const angle = index * 2.39996;
    const x = 460 + Math.cos(angle) * (390 + index % 5 * 22);
    const y = 270 + Math.sin(angle) * (255 + index % 3 * 19);
    ctx.fillStyle = '#101f2244'; ctx.beginPath(); ctx.arc(x + 4, y + 5, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ['#1d392b', '#365d39', '#284b30'][index % 3]; ctx.beginPath(); ctx.arc(x, y, 8 + index % 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const roads = state.track.roads.flatMap((road) => {
    const a = vertices.get(road.from); const b = vertices.get(road.to);
    return a && b ? [{ ...road, a, b, roadWidth: road.shortcut ? 29 : 42 }] : [];
  });
  // Layer all kerbs before all asphalt, so junctions form one continuous road.
  for (const road of roads) {
    const { a, b, roadWidth } = road;
    line(ctx, a.x + 3, a.y + 4, b.x + 3, b.y + 4, roadWidth + 14, '#14232388');
    line(ctx, a.x, a.y, b.x, b.y, roadWidth + 10, '#dadacb');
    ctx.lineCap = 'butt'; ctx.setLineDash([9, 9]);
    line(ctx, a.x, a.y, b.x, b.y, roadWidth + 10, '#b94748');
    ctx.setLineDash([]); ctx.lineCap = 'round';
  }
  for (const { a, b, roadWidth } of roads) line(ctx, a.x, a.y, b.x, b.y, roadWidth + 2, '#596260');
  for (const { a, b, roadWidth } of roads) line(ctx, a.x, a.y, b.x, b.y, roadWidth, '#343d40');
  for (const road of roads) {
    const { a, b, roadWidth } = road;
    ctx.lineCap = 'butt'; ctx.setLineDash([6, 12]); line(ctx, a.x, a.y, b.x, b.y, 0.8, '#bdc0af77'); ctx.setLineDash([]); ctx.lineCap = 'round';
    if (road.status !== 'open') {
      const x = (a.x + b.x) / 2; const y = (a.y + b.y) / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
      if (road.status === 'blocked') {
        rounded(ctx, -4, -roadWidth / 2, 8, roadWidth, 2, '#eaa66a');
        for (let stripe = -roadWidth / 2 + 2; stripe < roadWidth / 2; stripe += 8) rounded(ctx, -4, stripe, 8, 4, 0, '#283237');
      } else { rounded(ctx, -8, -8, 16, 16, 2, '#dfa85a'); ctx.fillStyle = '#302316'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.fillText('SLOW', 0, 2); }
      ctx.restore();
    }
  }
  // Start gantry, chequered line and pit-styled grandstand.
  const start = state.track.vertices.find((vertex) => vertex.kind === 'start');
  if (start) {
    ctx.save(); ctx.translate(start.x, start.y); ctx.rotate(Math.atan2(-140, -50));
    for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) { ctx.fillStyle = (row + col) % 2 ? '#111b20' : '#f0edd7'; ctx.fillRect(row * 4 - 4, col * 4 - 20, 4, 4); }
    ctx.restore();
    rounded(ctx, 65, 420, 90, 28, 3, '#5b6970');
    for (let row = 0; row < 4; row++) line(ctx, 69, 424 + row * 6, 150, 424 + row * 6, 2, row % 2 ? '#8d9d92' : '#c2c6ab');
  }
  if (camera.labels) for (const vertex of state.track.vertices) {
    if (vertex.kind === 'checkpoint') {
      ctx.save(); ctx.translate(vertex.x, vertex.y); ctx.fillStyle = '#d6edb4'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(vertex.checkpointOrder).padStart(2, '0'), 0, -31); ctx.restore();
    } else if (vertex.kind === 'fuel' || vertex.kind === 'nitro') {
      rounded(ctx, vertex.x - 9, vertex.y - 9, 18, 18, 4, vertex.active === false ? '#53635c' : '#d5ee8d');
      ctx.fillStyle = '#24312b'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(vertex.kind === 'fuel' ? 'F' : 'N', vertex.x, vertex.y + 3);
    }
  }
  const dt = state.clock - cache.time;
  for (const car of state.cars) {
    const pose = projectCar(state.track, { ...car, laneOffset: 0 }); if (!pose) continue;
    const previous = cache.angles.get(car.id) ?? pose.angle;
    const delta = ((pose.angle - previous + 540) % 360) - 180;
    const angle = camera.reducedMotion || dt <= 0 || dt > 0.3 ? pose.angle : previous + delta * Math.min(1, dt * 18);
    cache.angles.set(car.id, angle);
    const radians = angle * Math.PI / 180;
    pose.x -= Math.sin(radians) * (car.laneOffset ?? 0); pose.y += Math.cos(radians) * (car.laneOffset ?? 0);
    ctx.save(); ctx.translate(pose.x, pose.y); ctx.rotate(angle * Math.PI / 180);
    ctx.scale(0.78, 0.78);
    drawRacingCar(ctx, car.color, Boolean(car.braking), Boolean(car.boosting), camera.reducedMotion ? 0 : state.clock, car.id); ctx.restore();
    if (camera.labels) {
      ctx.font = 'bold 8px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = '#182822'; ctx.strokeText(car.label, pose.x, pose.y - 22); ctx.fillStyle = '#f4f8de'; ctx.fillText(car.label, pose.x, pose.y - 22);
    }
  }
  cache.time = state.clock;
  ctx.restore();
  // Low-cost minimap, fixed to the viewport, independent of the follow camera.
  const miniWidth = Math.min(170, width * 0.28); const miniHeight = miniWidth * 0.59;
  const miniX = width - miniWidth - 17; const miniY = height - miniHeight - 17;
  rounded(ctx, miniX, miniY, miniWidth, miniHeight, 8, '#0d191de8');
  ctx.save(); ctx.translate(miniX + 5, miniY + 3); ctx.scale((miniWidth - 10) / 920, (miniHeight - 6) / 540); ctx.lineCap = 'round';
  for (const road of state.track.roads) {
    const a = vertices.get(road.from); const b = vertices.get(road.to); if (a && b) line(ctx, a.x, a.y, b.x, b.y, 8, road.status === 'blocked' ? '#d57b62' : '#60776a');
  }
  for (const car of state.cars) { const position = projectCar(state.track, car); if (position) { ctx.fillStyle = car.color; ctx.beginPath(); ctx.arc(position.x, position.y, car.id === camera.carId ? 13 : 9, 0, Math.PI * 2); ctx.fill(); } }
  ctx.restore();
}
