import { mountScene, treats, weatherNames } from './scene.js';

function moodText(scene) {
  if (scene.mood < 4) return 'Sleepy piglet';
  if (scene.weather < 3) return 'Waiting for clearer skies';
  return 'Exploring the grove';
}

export function createPetPanel(main, readScene) {
  let rewardName;
  let rewardAnimation;

  function render(previousCanvas) {
    const scene = readScene();
    main.querySelector('#weather').textContent = (scene.night ? '☾ ' : '☀ ') + weatherNames[scene.weather];
    main.querySelector('#pet-state').textContent = rewardName || moodText(scene);
    if (previousCanvas) main.querySelector('canvas').replaceWith(previousCanvas);
    else rewardAnimation = mountScene(main.querySelector('canvas'), readScene, () => {
      rewardName = '';
      const status = main.querySelector('#pet-state');
      if (status) status.textContent = moodText(readScene());
    });
  }

  function play(index) {
    const status = main.querySelector('#pet-state');
    if (!status) return;
    rewardName = 'Enjoying ' + treats[index].name.toLowerCase();
    status.textContent = rewardName;
    rewardAnimation(index);
  }

  function playReward() {
    play(crypto.getRandomValues(new Uint32Array(1))[0] % treats.length);
  }

  return { render, play, playReward, reset() { rewardName = ''; } };
}
