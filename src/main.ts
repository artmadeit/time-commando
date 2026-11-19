import { Game } from './game';
import { LEVELS } from './levels';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const loading = document.getElementById('loading')!;

// dejamos que el texto de carga se pinte antes de generar texturas
requestAnimationFrame(() => setTimeout(boot, 30));

function boot() {
  let game: Game;
  try {
    game = new Game(canvas);
  } catch (err) {
    loading.textContent = 'Tu navegador no soporta WebGL2 :(';
    console.error(err);
    return;
  }
  loading.remove();
  (window as unknown as { game: Game }).game = game;

  const menu = document.getElementById('menu')!;
  const over = document.getElementById('over')!;
  document.getElementById('play')!.addEventListener('click', () => {
    menu.classList.add('hidden');
    game.start();
  });
  // selector de nivel
  const box = document.getElementById('levels')!;
  let era = '';
  LEVELS.forEach((l, i) => {
    if (l.era !== era) {
      era = l.era;
      const h = document.createElement('div');
      h.className = 'lv-era';
      h.textContent = l.era;
      box.appendChild(h);
    }
    const b = document.createElement('button');
    b.className = 'lv';
    b.id = `lv-${i}`;
    b.innerHTML = `<span>${l.num}</span>${l.name}`;
    b.addEventListener('click', () => {
      menu.classList.add('hidden');
      game.score = 0;
      if (game.levelIdx !== i) game.loadLevel(i);
      game.start();
    });
    box.appendChild(b);
  });
  document.getElementById('retry')!.addEventListener('click', () => {
    over.classList.add('hidden');
    game.continueAfterEnd();
  });
  document.getElementById('resume')!.addEventListener('click', () => game.setPause(false));
  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && game.state === 'menu') document.getElementById('play')!.click();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.setPause(true); });

  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    game.update(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
