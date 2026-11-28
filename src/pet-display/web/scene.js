// Crop the transparent padding so each treat can sit at the same ground anchor.
export const treats = [
  { name: 'Ramen', file: 'ramen.png', bounds: [276, 371, 671, 600] },
  { name: 'Strawberry cheesecake', file: 'cheesecake.png', bounds: [322, 326, 608, 599] },
  { name: 'Chocolate mousse', file: 'chocolate-mousse.png', bounds: [331, 314, 587, 645] },
  { name: 'Pumpkin soup', file: 'pumpkin-soup.png', bounds: [294, 244, 652, 742] },
  { name: 'Soft tofu stew', file: 'soft-tofu-stew.png', bounds: [276, 396, 694, 558] },
  { name: 'Shortbread cookie', file: 'shortbread-cookie.png', bounds: [265, 326, 700, 628] },
  { name: 'Ice cream', file: 'icecream.png', bounds: [378, 246, 483, 786] },
  { name: 'Meat skewers', file: 'meat-skewers.png', bounds: [263, 294, 754, 678] },
  { name: 'Chocolate truffles', file: 'chocolate-truffles.png', bounds: [306, 377, 647, 574] },
  { name: 'Braised short rib', file: 'shortrib.png', bounds: [280, 376, 677, 527] },
];
export const weatherNames = ['Thunderstorm', 'Heavy rain', 'Light rain', 'Overcast', 'Clearing skies', 'Sunny', 'Radiant skies'];
const skies = ['#414966', '#626d86', '#8194a7', '#b5c9d1', '#aad9ec', '#91d8ec', '#8ddfee'];
const roofs = ['#63534d', '#79594e', '#96654f', '#ac7153', '#ba7855', '#c77759', '#c45d53', '#b84b54'];
const walls = ['#82705c', '#9a7a60', '#ac8869', '#be9371', '#cea17a', '#deb487', '#e9c498', '#f3d1a1'];
const animal = { x: 407, y: 366, food: [79, 1], scale: 0.36 };
// Source rectangles exclude the pose labels. The last value anchors the body horizontally.
const pigFrames = {
  idle: [63, 78, 387, 289, 193],
  blink: [484, 78, 381, 288, 190],
  yawn: [898, 75, 391, 292, 189],
  chew: [1319, 83, 408, 285, 196],
  happy: [71, 478, 397, 291, 188],
  sleep: [485, 513, 366, 259, 183],
  excited: [900, 461, 403, 308, 193],
  tired: [1320, 546, 412, 223, 187],
};
const walkFrameStarts = [37, 399, 748, 1100, 1456, 1812];
const walkFrameMs = 125;
const walkDuration = walkFrameStarts.length * walkFrameMs * 5;
const restDuration = 1800;
const walkDistance = 100;

function walkPose(time) {
  const legDuration = restDuration + walkDuration;
  const returning = Math.floor(time / legDuration) % 2 === 1;
  const elapsed = time % legDuration - restDuration;
  const progress = Math.max(0, elapsed / walkDuration);
  return {
    x: animal.x + walkDistance * (returning ? 1 - progress : progress),
    facing: returning ? -1 : 1,
    frame: elapsed < 0 ? undefined : Math.floor(elapsed / walkFrameMs) % walkFrameStarts.length,
  };
}

function pigPose({ mood, weather, night }, time, rewardAge) {
  if (rewardAge !== undefined) {
    if (!time) return 'chew';
    if (rewardAge < 400) return 'excited';
    return Math.floor(rewardAge / 180) % 2 ? 'chew' : 'happy';
  }
  if (night && mood <= 2) return 'sleep';
  if (mood < 4 && time % 6900 > 5720) return 'yawn';
  if (mood < 4 || weather < 3) return 'tired';
  if (time % 4300 > 4135) return 'blink';
  if (mood >= 7) return 'excited';
  return mood >= 6 ? 'happy' : 'idle';
}

let pigSprites;
let walkSprites;
const treatSprites = new Map();

function loadSprite(file) {
  const sprite = new Image();
  sprite.src = new URL('./assets/' + file, import.meta.url).href;
  return sprite;
}

function treatSprite(index) {
  if (!treatSprites.has(index)) treatSprites.set(index, loadSprite(treats[index].file));
  return treatSprites.get(index);
}

export function mountScene(canvas, readState, onFinish) {
  const ctx = canvas.getContext('2d');
  pigSprites ??= loadSprite('pig-sprites.png');
  walkSprites ??= loadSprite('pig-walk.png');
  treatSprite(0);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let reward;
  let walkTime = 0;
  let previousFrame;
  const oval = (x, y, rx, ry, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  function line(points, color, width = 2, fill = false) {
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (fill) {
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }
  function arc(x, y, radius, begin, end, color, width) {
    ctx.beginPath();
    ctx.arc(x, y, radius, begin, end);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function landscape({ weather, night }, t) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 440);
    gradient.addColorStop(0, night ? '#24324f' : skies[weather]);
    gradient.addColorStop(1, night ? '#728091' : '#f8e4b9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 720, 440);
    if (night || weather >= 4) {
      oval(588, 85, 38, 38, night ? '#e5e2c3' : '#fff1ba');
      if (night) {
        for (let i = 0; i < 36; i++) oval((i * 131 + 27) % 720, 18 + (i * 59) % 172, 1.4, 1.4, '#e5e2c3');
        if (weather === 6) {
          const x = 125 + t * 0.2 % 390;
          line([[x, 90], [x + 28, 70]], '#fff2cb', 3);
        }
      } else if (weather === 6) {
        ['#e9948a', '#f3d48a', '#a6ce9c', '#a7c6de'].forEach((color, i) => arc(591, 234, 128 - i * 8, Math.PI, 2 * Math.PI, color, 8));
      }
    }
    const clouds = weather < 4 ? 5 : 2;
    for (let i = 0; i < clouds; i++) {
      const x = (i * 151 + 37 + t * 0.008) % 800 - 40;
      const y = 53 + i % 3 * 39;
      const color = night ? '#626f86' : weather < 2 ? '#81899b' : '#f3f2df';
      oval(x, y + 12, 63, 15, color);
      oval(x - 8, y, 31, 23, color);
      oval(x + 26, y + 6, 26, 17, color);
    }
    oval(120, 284, 330, 101, night ? '#526666' : '#819d86');
    oval(616, 280, 370, 111, night ? '#4a6561' : '#a2b695');
    oval(432, 312, 460, 93, night ? '#536957' : '#bac893');
    ctx.fillStyle = night ? '#435746' : '#a6ba7c';
    ctx.fillRect(0, 333, 720, 107);
    oval(337, 368, 185, 37, night ? '#7c7a68' : '#d8c593');
    for (let i = 0; i < 51; i++) {
      const x = (i * 157 + 21) % 720;
      const y = 290 + i * 29 % 145;
      if (x > 157 && x < 520 && y < 396) continue;
      line([[x - 5, y - 6], [x, y], [x + 4, y - 8]], night ? '#778968' : '#7d9b65', 2);
      if (i % 4 === 0) oval(x + 4, y - 10, 3, 3, i % 3 ? '#f9ebbc' : '#edaf99');
    }
  }

  function hut(level) {
    ctx.save();
    ctx.translate(0, 32);
    line([[141, 322], [239, 330], [330, 319], [345, 325], [248, 340], [137, 329]], '#62503b52', 0, true);
    line([[143, 237], [239, 237], [239, 331], [143, 323]], walls[Math.max(0, level - 2)], 0, true);
    line([[239, 223], [329, 240], [329, 320], [239, 331]], walls[level], 0, true);
    line([[120, 242], [173, 166], [263, 178], [239, 243]], roofs[level], 0, true);
    line([[173, 166], [263, 178], [345, 247], [239, 237]], roofs[Math.max(0, level - 1)], 0, true);
    for (let y = 263; y <= 310; y += 15) line([[149, y], [235, y + 4], [325, y - 3]], '#714e3c50');
    ctx.fillStyle = '#6b4c40';
    ctx.beginPath();
    ctx.roundRect(256, 268, 37, 60, [14, 14, 0, 0]);
    ctx.fill();
    oval(283, 300, 2.6, 2.6, '#e9c48a');
    ctx.fillStyle = level > 2 ? '#f7d88e' : '#817d76';
    ctx.fillRect(171, 264, 35, 33);
    ctx.strokeStyle = '#684f44';
    ctx.lineWidth = 4;
    ctx.strokeRect(171, 264, 35, 33);
    line([[188, 266], [188, 295]], '#684f44');
    line([[173, 280], [203, 280]], '#684f44');
    if (level < 3) line([[159, 314], [205, 300]], '#6e5b4d', 7);
    if (level >= 4) line([[160, 301], [214, 302]], '#916448', 7);
    if (level >= 5) for (let i = 0; i < level; i++) oval(164 + i * 7, 298 - i % 2 * 5, 4, 4, '#e99592');
    if (level === 7) line([[259, 181], [259, 152], [287, 158], [259, 165]], '#f3d48f', 0, true);
    ctx.restore();
  }

  function pig(state, time, eating, rewardAge, canWalk) {
    if (!pigSprites.naturalWidth) return;
    const { x, facing, frame } = walkPose(walkTime);
    const { y, scale } = animal;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    if (canWalk && frame !== undefined) {
      // The supplied walk frames include their own contact shadows.
      const walkScale = 0.40;
      ctx.drawImage(walkSprites, walkFrameStarts[frame], 211, 348, 280,
        -174 * walkScale, -280 * walkScale, 348 * walkScale, 280 * walkScale);
      ctx.restore();
      return;
    }
    const phase = time / (state.mood < 4 ? 560 : 380);
    const [sx, sy, width, height, anchor] = pigFrames[pigPose(state, time, rewardAge)];
    const heightOnCanvas = height * scale * (1 + Math.sin(phase) * 0.01);
    oval(0, -2, 47, 6, '#62503b52');
    ctx.drawImage(pigSprites, sx, sy, width, height,
      -anchor * scale, -heightOnCanvas, width * scale, heightOnCanvas);
    if (eating) food(...animal.food, eating);
    ctx.restore();
  }
  function food(x, y, { index, sprite }) {
    if (!sprite.naturalWidth) return;
    const [sx, sy, width, height] = treats[index].bounds;
    const scale = Math.min(56 / width, 55 / height);
    ctx.drawImage(sprite, sx, sy, width, height, x - width * scale / 2, y - height * scale,
      width * scale, height * scale);
  }
  function draw(time) {
    if (!canvas.isConnected) return;
    const t = reduced.matches ? 0 : time;
    const state = readState();
    if (reward?.sprite.complete) reward.start ??= time;
    if (reward?.start !== undefined && time - reward.start > 3200) {
      reward = undefined;
      onFinish();
    }
    const eating = reward?.start !== undefined ? reward : undefined;
    const canWalk = !reduced.matches && !eating && state.mood >= 4 && state.weather >= 3 && walkSprites.naturalWidth > 0;
    if (canWalk && previousFrame !== undefined) walkTime += Math.min(time - previousFrame, 50);
    previousFrame = time;
    landscape(state, t);
    hut(state.hut);
    pig(state, t, eating, eating ? time - eating.start : undefined, canWalk);
    if (state.weather < 3) {
      for (let i = 0; i < (3 - state.weather) * 26; i++) {
        const x = (i * 137 + t * 0.16) % 740;
        const y = (i * 43 + t * 0.28) % 440;
        line([[x, y], [x - 5, y + 14]], '#d9ebf292', 1.4);
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  return index => {
    reward = { index, sprite: treatSprite(index) };
  };
}
