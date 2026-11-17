export type Action = 'attack' | 'kick' | 'dodge' | 'block' | 'switch' | 'pause';

const KEYMAP: Record<string, Action> = {
  KeyJ: 'attack', KeyK: 'kick', KeyL: 'block', ShiftLeft: 'block', ShiftRight: 'block',
  Space: 'dodge', KeyQ: 'switch', Escape: 'pause', KeyP: 'pause', Enter: 'attack',
};

export class Input {
  private keys = new Set<string>();
  private mouse = new Set<number>();
  private touchActs = new Set<Action>();
  private down = new Set<Action>();
  private prev = new Set<Action>();
  moveX = 0;
  moveY = 0;
  private stick = { id: -1, x: 0, y: 0 };
  touchEnabled = false;

  constructor(canvas: HTMLCanvasElement) {
    addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.clear(); });
    canvas.addEventListener('mousedown', (e) => this.mouse.add(e.button));
    addEventListener('mouseup', (e) => this.mouse.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.setupTouch();
  }

  private setupTouch() {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return;
    this.touchEnabled = true;
    const stick = document.getElementById('stick')!;
    const knob = document.getElementById('knob')!;
    const update = (t: Touch) => {
      const r = stick.getBoundingClientRect();
      let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      this.stick.x = dx;
      this.stick.y = dy;
      knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };
    stick.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this.stick.id = t.identifier;
      update(t);
    }, { passive: false });
    stick.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) if (t.identifier === this.stick.id) update(t);
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === this.stick.id) {
          this.stick.id = -1; this.stick.x = this.stick.y = 0;
          knob.style.transform = '';
        }
      }
    };
    stick.addEventListener('touchend', end);
    stick.addEventListener('touchcancel', end);
    document.querySelectorAll<HTMLButtonElement>('#tbtns button').forEach((b) => {
      const a = b.dataset.a as Action;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchActs.add(a); }, { passive: false });
      b.addEventListener('touchend', (e) => { e.preventDefault(); this.touchActs.delete(a); }, { passive: false });
    });
  }

  update() {
    this.prev = new Set(this.down);
    this.down.clear();
    for (const k of this.keys) { const a = KEYMAP[k]; if (a) this.down.add(a); }
    if (this.mouse.has(0)) this.down.add('attack');
    if (this.mouse.has(2)) this.down.add('block');
    if (this.mouse.has(1)) this.down.add('kick');
    for (const a of this.touchActs) this.down.add(a);

    let x = 0, y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.stick.id >= 0) { x += this.stick.x; y -= this.stick.y; }

    // Mando
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > 0.2) { x += ax; y -= ay; }
      const b = (i: number) => gp.buttons[i]?.pressed;
      if (b(0) || b(7)) this.down.add('attack');
      if (b(2)) this.down.add('kick');
      if (b(1)) this.down.add('dodge');
      if (b(5) || b(4) || b(6)) this.down.add('block');
      if (b(3)) this.down.add('switch');
      if (b(9)) this.down.add('pause');
      if (b(14)) x -= 1; if (b(15)) x += 1; if (b(12)) y += 1; if (b(13)) y -= 1;
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.moveX = x;
    this.moveY = y;
  }

  held(a: Action) { return this.down.has(a); }
  pressed(a: Action) { return this.down.has(a) && !this.prev.has(a); }
}
