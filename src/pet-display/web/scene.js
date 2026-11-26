export const treats = ['Ramen', 'Strawberry cheesecake', 'Chocolate mousse', 'Butternut squash soup', 'Soft tofu soup', 'Shortbread cookie', 'Ice cream', 'Meat skewers', 'Chocolate truffles', 'Braised short rib'];
export const weatherNames = ['Thunderstorm', 'Heavy rain', 'Light rain', 'Overcast', 'Clearing skies', 'Sunny', 'Radiant skies'];
const skies = ['#414966', '#626d86', '#8194a7', '#b5c9d1', '#aad9ec', '#91d8ec', '#8ddfee'];
const roofs = ['#63534d', '#79594e', '#96654f', '#ac7153', '#ba7855', '#c77759', '#c45d53', '#b84b54'];
const walls = ['#82705c', '#9a7a60', '#ac8869', '#be9371', '#cea17a', '#deb487', '#e9c498', '#f3d1a1'];
const animal = { x: 407, y: 335, food: [65, -11], moodLevels: 8 };

export function mountScene(canvas, readState, onFinish) {
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let reward;
  let start;
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
    oval(233, 333, 108, 18, '#655c4450');
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
  }

  function pig(state, t, eating) {
    const sleepy = state.mood < 4;
    const sad = state.weather < 3;
    const phase = t / (sleepy ? 560 : 380);
    const drift = Math.sin(t / 3600) * 12;
    const x = animal.x + drift;
    const y = animal.y;
    oval(x + 11, y + 5, 61, 13, '#62503b48');
    ctx.save();
    ctx.translate(x, y);
    line([[-48, -29], [-65, -35], [-66, -43], [-59, -46], [-55, -40]], '#bc7279', 4);
    for (const foot of [-29, -4, 20, 39]) oval(foot, -5, 9, 12, '#bd747a');
    ctx.scale(1, 1 + Math.sin(phase) * 0.022);
    oval(-10, -36, 51, 35, '#df9094');
    oval(-15, -43, 45, 29, '#efaaac');
    line([[15, -63], [5, -93], [37, -77]], '#d67f88', 0, true);
    oval(31, -52, 37, 34, '#f3b0b3');
    line([[38, -74], [62, -92], [66, -62]], '#e99da4', 0, true);
    line([[48, -73], [60, -84], [60, -68]], '#c77985', 0, true);
    const blink = t > 0 && t % 4300 > 4135;
    if (blink || sleepy) {
      line([[29, -56], [34, -54], [39, -57]], '#4d3440', 2.5);
      line([[52, -57], [56, -56], [60, -59]], '#4d3440', 2.5);
    } else {
      oval(34, -57, 3, 4, '#4d3440');
      oval(57, -58, 2.5, 3.5, '#4d3440');
    }
    oval(22, -44, 8, 4, '#e79098');
    oval(52, -43, 20, 13, '#e38d99');
    oval(46, -44, 2.3, 3.3, '#925866');
    oval(58, -44, 2.3, 3.3, '#925866');
    if (eating || (sleepy && t % 6900 > 5720)) {
      oval(48, -24, 5, eating ? 2 + (1 + Math.sin(t / 72)) * 3 : 6, '#7a4954');
    } else {
      line([[41, -25], [47, sad ? -28 : -22], [53, -26]], '#9b5966', 2);
    }
    if (eating) food(...animal.food, eating.index);
    ctx.restore();
  }
  function food(x, y, index) {
    const colors = ['#f3c273', '#f2a6ac', '#815a4a', '#eea85f', '#f4d9a2', '#dfaf75', '#f6d3c6', '#a15f43', '#694a44', '#835142'];
    oval(x, y + 8, 22, 9, '#456d69');
    oval(x, y, 24, 8, '#fff0d4');
    oval(x, y, 20, 6, colors[index]);
    if (index === 0) {
      line([[x - 8, y + 1], [x - 3, y - 4], [x + 2, y + 2], [x + 7, y - 3]], '#a87548', 2);
      oval(x + 11, y - 2, 4, 3, '#fff8db');
    }
  }
  function draw(time) {
    if (!canvas.isConnected) return;
    const t = reduced.matches ? 0 : time;
    const state = readState();
    if (reward && time - start > 3200) {
      reward = undefined;
      onFinish();
    }
    landscape(state, t);
    hut(state.hut);
    pig(state, t, reward);
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
    reward = { index };
    start = performance.now();
  };
}
