// Approximate in-app previews of QMK lighting effects. These follow the math
// in QMK's rgb_matrix_animations so the keyboard view looks close to the real
// LEDs, but they aren't exact: firmware tweaks, custom effects and timing
// differences mean the physical board is still the source of truth.
import type {VIAKey} from '@the-via/reader';

// QMK's LED coordinate space: x 0..224, y 0..64, centered on (112, 32)
const LED_MAX_X = 224;
const LED_MAX_Y = 64;
const CENTER_X = LED_MAX_X / 2;
const CENTER_Y = LED_MAX_Y / 2;
// QMK's LED_HITS_TO_REMEMBER default, for the "multi" reactive effects
const HITS_TO_REMEMBER = 8;
// Simulated keypresses for reactive/splash/heatmap effects
const FAKE_PRESS_INTERVAL_MS = 1000;

export type HSV = {h: number; s: number; v: number};

export type PreviewSettings = {
  // All in QMK's 0..255 units
  hsv: HSV;
  speed: number;
};

export type PreviewLed = {
  x: number;
  y: number;
  // Rough stand-in for QMK's modifier LED flag (used by Alphas Mods)
  isMod: boolean;
};

type Hit = {led: number; time: number};

type Context = {
  leds: PreviewLed[];
  settings: PreviewSettings;
  timer: number;
  hits: Hit[];
  state: PreviewState;
};

type PixelEffect = (led: PreviewLed, i: number, ctx: Context) => HSV;
type FrameEffect = (ctx: Context) => HSV[];

type EffectDef =
  | {kind: 'pixel'; fn: PixelEffect; reactive?: boolean}
  | {kind: 'frame'; fn: FrameEffect; reactive?: boolean};

// ---- QMK lib8tion helpers (0..255 integer math, kept as floats) ----

const wrap8 = (n: number) => ((n % 256) + 256) % 256;
const clamp8 = (n: number) => Math.max(0, Math.min(255, n));
const scale8 = (i: number, scale: number) => (i * (scale + 1)) / 256;
const qadd8 = (a: number, b: number) => Math.min(255, a + b);
const qsub8 = (a: number, b: number) => Math.max(0, a - b);
const abs8 = (n: number) => Math.min(255, Math.abs(n));
// C's (int8_t) cast, which QMK's abs8() applies to its argument
const toInt8 = (n: number) => wrap8(n + 128) - 128;
const sin8 = (theta: number) =>
  128 + 127.5 * Math.sin((wrap8(theta) / 256) * 2 * Math.PI);
const cos8 = (theta: number) => sin8(theta + 64);
// Angle of (dy, dx) mapped onto 0..255
const atan2_8 = (dy: number, dx: number) =>
  wrap8((Math.atan2(dy, dx) / (2 * Math.PI)) * 256);
// QMK's scale16by8(g_rgb_timer, scale): a timer that wraps through 0..255
const scaledTime = (timer: number, scale: number) =>
  wrap8((timer * (1 + scale)) / 256);

const withH = (hsv: HSV, h: number): HSV => ({...hsv, h: wrap8(h)});
const withS = (hsv: HSV, s: number): HSV => ({...hsv, s: clamp8(s)});
const withV = (hsv: HSV, v: number): HSV => ({...hsv, v: clamp8(v)});

const offsets = (led: PreviewLed) => {
  const dx = led.x - CENTER_X;
  const dy = led.y - CENTER_Y;
  return {dx, dy, dist: Math.sqrt(dx * dx + dy * dy)};
};

// time used by most animations: scale16by8(g_rgb_timer, speed / 4)
const speedTime = (ctx: Context, divisor = 4) =>
  scaledTime(ctx.timer, ctx.settings.speed / divisor);

// ---- Random-state effects keep a little memory between frames ----

type PreviewState = {
  lastTick: number;
  colors: (HSV | undefined)[];
  heat: number[];
};

export const createPreviewState = (): PreviewState => ({
  lastTick: 0,
  colors: [],
  heat: [],
});

const randomByte = () => Math.floor(Math.random() * 256);

// Runs `step` at a speed-dependent rate, like QMK's wait timers
const stepEvery = (ctx: Context, baseMs: number, step: () => void) => {
  const interval = baseMs * (1 - ctx.settings.speed / 320);
  if (ctx.timer - ctx.state.lastTick >= interval) {
    ctx.state.lastTick = ctx.timer;
    step();
  }
};

const randomFill = (
  ctx: Context,
  baseMs: number,
  pick: (led: number) => HSV,
): HSV[] => {
  const {leds, state} = ctx;
  if (state.colors.length !== leds.length) {
    state.colors = leds.map((_, i) => pick(i));
  }
  stepEvery(ctx, baseMs, () => {
    const led = Math.floor(Math.random() * leds.length);
    state.colors[led] = pick(led);
  });
  return state.colors as HSV[];
};

// ---- Reactive helpers: simulated keypresses ----

const hitTick = (ctx: Context, hit: Hit) =>
  // QMK: scale16by8(tick, qadd8(speed, 1))
  ((ctx.timer - hit.time) * (1 + qadd8(ctx.settings.speed, 1))) / 256;

const latestHits = (ctx: Context, multi: boolean) =>
  multi ? ctx.hits : ctx.hits.slice(-1);

const reactiveSpread =
  (
    multi: boolean,
    math: (hsv: HSV, dx: number, dy: number, dist: number, tick: number) => HSV,
  ): PixelEffect =>
  (led, _i, ctx) => {
    let hsv: HSV = {...ctx.settings.hsv, v: 0};
    for (const hit of latestHits(ctx, multi)) {
      const origin = ctx.leds[hit.led];
      if (!origin) continue;
      const dx = led.x - origin.x;
      const dy = led.y - origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      hsv = math(hsv, dx, dy, dist, hitTick(ctx, hit));
    }
    return withV(hsv, scale8(hsv.v, ctx.settings.hsv.v));
  };

const wideMath = (
  hsv: HSV,
  _dx: number,
  _dy: number,
  dist: number,
  tick: number,
) => {
  const effect = Math.min(255, tick + dist * 5);
  return withV(hsv, qadd8(hsv.v, 255 - effect));
};

const crossMath = (
  hsv: HSV,
  dx: number,
  dy: number,
  dist: number,
  tick: number,
) => {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  let effect = tick + dist;
  effect += Math.min(adx, 16) * Math.min(ady, 16) * 0.5;
  effect = Math.min(255, effect);
  return withV(hsv, qadd8(hsv.v, 255 - effect));
};

const nexusMath = (
  hsv: HSV,
  dx: number,
  dy: number,
  dist: number,
  tick: number,
) => {
  let effect = Math.min(255, Math.abs(tick - dist));
  if (dist > 72) effect = 255;
  if (Math.abs(dx) > 8 && Math.abs(dy) > 8) effect = 255;
  return {
    ...hsv,
    v: qadd8(hsv.v, 255 - effect),
    h: wrap8(hsv.h + dy / 4),
  };
};

const splashMath =
  (shiftHue: boolean) =>
  (hsv: HSV, _dx: number, _dy: number, dist: number, tick: number) => {
    const effect = Math.min(255, Math.abs(tick - dist));
    return {
      ...hsv,
      h: shiftHue ? wrap8(hsv.h + effect) : hsv.h,
      v: qadd8(hsv.v, 255 - effect),
    };
  };

const reactiveSingle =
  (simple: boolean): PixelEffect =>
  (_led, i, ctx) => {
    const hit = [...ctx.hits].reverse().find((h) => h.led === i);
    const offset = hit ? Math.min(255, hitTick(ctx, hit)) : 255;
    const {hsv} = ctx.settings;
    return simple
      ? withV(hsv, scale8(255 - offset, hsv.v))
      : withH(hsv, hsv.h + qsub8(130, offset));
  };

// ---- Effects, keyed by normalized label ----

const pixel = (fn: PixelEffect, reactive = false): EffectDef => ({
  kind: 'pixel',
  fn,
  reactive,
});
const frame = (fn: FrameEffect, reactive = false): EffectDef => ({
  kind: 'frame',
  fn,
  reactive,
});

const solid = pixel((_l, _i, {settings}) => settings.hsv);

const breathing = pixel((_l, _i, ctx) => {
  const time = speedTime(ctx, 8);
  const {hsv} = ctx.settings;
  return withV(hsv, scale8(abs8(sin8(time) - 128) * 2, hsv.v));
});

const cycleAll = pixel((_l, _i, ctx) =>
  withH(ctx.settings.hsv, speedTime(ctx)),
);

const cycleLeftRight = pixel((led, _i, ctx) =>
  withH(ctx.settings.hsv, led.x - speedTime(ctx)),
);

const gradientLeftRight = pixel((led, _i, {settings}) => {
  const scale = scale8(64, settings.speed);
  return withH(settings.hsv, settings.hsv.h + (scale * led.x) / 32);
});

const EFFECTS: Record<string, EffectDef> = {
  alloff: pixel((_l, _i, {settings}) => ({...settings.hsv, v: 0})),
  solidcolor: solid,
  solid: solid,
  alphasmods: pixel((led, _i, {settings}) =>
    led.isMod
      ? withH(settings.hsv, settings.hsv.h + settings.speed)
      : settings.hsv,
  ),
  gradientupdown: pixel((led, _i, {settings}) => {
    const scale = scale8(64, settings.speed);
    return withH(
      settings.hsv,
      settings.hsv.h + Math.floor(scale) * (Math.round(led.y) >> 4),
    );
  }),
  gradientleftright: gradientLeftRight,
  breathing: breathing,
  bandsat: pixel((led, _i, ctx) => {
    const {hsv} = ctx.settings;
    const s = hsv.s - Math.abs(scale8(led.x, 228) + 28 - speedTime(ctx)) * 8;
    return withS(hsv, scale8(Math.max(0, s), hsv.s));
  }),
  bandval: pixel((led, _i, ctx) => {
    const {hsv} = ctx.settings;
    const v = hsv.v - Math.abs(scale8(led.x, 228) + 28 - speedTime(ctx)) * 8;
    return withV(hsv, scale8(Math.max(0, v), hsv.v));
  }),
  pinwheelsat: pixel((led, _i, ctx) => {
    const {dx, dy} = offsets(led);
    const {hsv} = ctx.settings;
    const s = wrap8(hsv.s - speedTime(ctx, 2) - atan2_8(dy, dx) * 3);
    return withS(hsv, scale8(s, hsv.s));
  }),
  pinwheelval: pixel((led, _i, ctx) => {
    const {dx, dy} = offsets(led);
    const {hsv} = ctx.settings;
    const v = wrap8(hsv.v - speedTime(ctx, 2) - atan2_8(dy, dx) * 3);
    return withV(hsv, scale8(v, hsv.v));
  }),
  spiralsat: pixel((led, _i, ctx) => {
    const {dx, dy, dist} = offsets(led);
    const {hsv} = ctx.settings;
    const s = wrap8(hsv.s + dist - speedTime(ctx, 2) - atan2_8(dy, dx));
    return withS(hsv, scale8(s, hsv.s));
  }),
  spiralval: pixel((led, _i, ctx) => {
    const {dx, dy, dist} = offsets(led);
    const {hsv} = ctx.settings;
    const v = wrap8(hsv.v + dist - speedTime(ctx, 2) - atan2_8(dy, dx));
    return withV(hsv, scale8(v, hsv.v));
  }),
  cycleall: cycleAll,
  cycleleftright: cycleLeftRight,
  cycleupdown: pixel((led, _i, ctx) =>
    withH(ctx.settings.hsv, led.y - speedTime(ctx)),
  ),
  rainbowmovingchevron: pixel((led, _i, ctx) =>
    withH(
      ctx.settings.hsv,
      ctx.settings.hsv.h + abs8(led.y - CENTER_Y) + (led.x - speedTime(ctx)),
    ),
  ),
  cycleoutin: pixel((led, _i, ctx) => {
    const {dist} = offsets(led);
    return withH(ctx.settings.hsv, (3 * dist) / 2 + speedTime(ctx, 2));
  }),
  cycleoutindual: pixel((led, _i, ctx) => {
    const dx = CENTER_X / 2 - Math.abs(led.x - CENTER_X);
    const dy = led.y - CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return withH(ctx.settings.hsv, 3 * dist + speedTime(ctx, 2));
  }),
  cyclepinwheel: pixel((led, _i, ctx) => {
    const {dx, dy} = offsets(led);
    return withH(ctx.settings.hsv, atan2_8(dy, dx) + speedTime(ctx, 2));
  }),
  cyclespiral: pixel((led, _i, ctx) => {
    const {dx, dy, dist} = offsets(led);
    return withH(ctx.settings.hsv, dist - speedTime(ctx, 2) - atan2_8(dy, dx));
  }),
  dualbeacon: pixel((led, _i, ctx) => {
    const time = speedTime(ctx);
    // QMK's sin_cos_i runner passes (cos, sin) into math functions declared
    // (sin, cos), so the names are swapped in firmware
    const sin = cos8(time) - 128;
    const cos = sin8(time) - 128;
    const {dx, dy} = offsets(led);
    return withH(
      ctx.settings.hsv,
      ctx.settings.hsv.h + (dy * cos + dx * sin) / 128,
    );
  }),
  rainbowbeacon: pixel((led, _i, ctx) => {
    const time = speedTime(ctx);
    // QMK's sin_cos_i runner passes (cos, sin) into math functions declared
    // (sin, cos), so the names are swapped in firmware
    const sin = cos8(time) - 128;
    const cos = sin8(time) - 128;
    const {dx, dy} = offsets(led);
    return withH(
      ctx.settings.hsv,
      ctx.settings.hsv.h + (dy * 2 * cos + dx * 2 * sin) / 128,
    );
  }),
  rainbowpinwheels: pixel((led, _i, ctx) => {
    const time = speedTime(ctx);
    // QMK's sin_cos_i runner passes (cos, sin) into math functions declared
    // (sin, cos), so the names are swapped in firmware
    const sin = cos8(time) - 128;
    const cos = sin8(time) - 128;
    const dy = led.y - CENTER_Y;
    const dx = 56 - Math.abs(led.x - CENTER_X);
    return withH(
      ctx.settings.hsv,
      ctx.settings.hsv.h + (dy * 3 * cos + dx * 3 * sin) / 128,
    );
  }),
  raindrops: frame((ctx) => {
    const {hsv} = ctx.settings;
    // QMK picks hues within a quarter turn of the base color
    const spread = wrap8(hsv.h + 128) - hsv.h;
    return randomFill(ctx, 150, () =>
      withH(hsv, hsv.h + ((randomByte() % 4) * spread) / 4),
    );
  }),
  jellybeanraindrops: frame((ctx) =>
    randomFill(ctx, 150, () => ({
      h: randomByte(),
      s: 127 + (randomByte() >> 1),
      v: ctx.settings.hsv.v,
    })),
  ),
  huebreathing: pixel((_l, _i, ctx) => {
    const time = speedTime(ctx, 8);
    const {hsv} = ctx.settings;
    return withH(hsv, hsv.h + scale8(abs8(sin8(time) - 128) * 2, 12));
  }),
  huependulum: pixel((led, _i, ctx) => {
    const time = speedTime(ctx);
    const {hsv} = ctx.settings;
    return withH(
      hsv,
      hsv.h + scale8(abs8(wrap8(sin8(time) + led.x) - 128) * 2, 12),
    );
  }),
  huewave: pixel((led, _i, ctx) => {
    const {hsv} = ctx.settings;
    return withH(hsv, hsv.h + scale8(abs8(toInt8(led.x - speedTime(ctx))), 24));
  }),
  pixelrain: frame((ctx) =>
    randomFill(ctx, 120, () =>
      Math.random() < 0.15
        ? {...ctx.settings.hsv, v: 0}
        : {h: randomByte(), s: 255, v: ctx.settings.hsv.v},
    ),
  ),
  pixelflow: frame((ctx) => {
    const {leds, state} = ctx;
    if (state.colors.length !== leds.length) {
      state.colors = leds.map(() => ({...ctx.settings.hsv, v: 0}));
    }
    stepEvery(ctx, 120, () => {
      state.colors.pop();
      state.colors.unshift(
        Math.random() < 0.5
          ? {h: randomByte(), s: 255, v: ctx.settings.hsv.v}
          : {...ctx.settings.hsv, v: 0},
      );
    });
    // Flow left to right across the board
    const order = leds
      .map((led, i) => ({i, x: led.x, y: led.y}))
      .sort((a, b) => a.x - b.x || a.y - b.y);
    const out: HSV[] = [];
    order.forEach(({i}, rank) => {
      out[i] = state.colors[rank] as HSV;
    });
    return out;
  }),
  pixelfractal: frame((ctx) => {
    const {leds, settings} = ctx;
    const state = ctx.state;
    // Mirrored random columns spreading out from the center
    if (state.heat.length === 0) {
      state.heat = Array(16).fill(0);
    }
    stepEvery(ctx, 140, () => {
      state.heat.pop();
      state.heat.unshift(Math.random() < 0.5 ? 1 : 0);
    });
    return leds.map((led) => {
      const col = Math.floor(Math.abs(led.x - CENTER_X) / 14);
      const row = Math.floor(led.y / 16);
      const lit = state.heat[(col + row * 3) % state.heat.length];
      return lit ? settings.hsv : {...settings.hsv, v: 0};
    });
  }),
  typingheatmap: frame((ctx) => {
    const {leds, state, settings} = ctx;
    if (state.heat.length !== leds.length) {
      state.heat = leds.map(() => 0);
    }
    // Add heat around new presses
    for (const hit of ctx.hits) {
      if (hit.time > state.lastTick) {
        const origin = leds[hit.led];
        leds.forEach((led, i) => {
          const dist = Math.hypot(led.x - origin.x, led.y - origin.y);
          if (dist <= 40) {
            state.heat[i] = Math.min(255, state.heat[i] + (dist ? 8 : 32));
          }
        });
      }
    }
    // Cool down over time
    const elapsed = ctx.timer - state.lastTick;
    state.lastTick = ctx.timer;
    state.heat = state.heat.map((h) => Math.max(0, h - elapsed / 25));
    return state.heat.map((heat) => ({
      h: wrap8(170 - qsub8(heat, 85)),
      s: 255,
      v: scale8(qadd8(170, heat), settings.hsv.v),
    }));
  }, true),
  digitalrain: frame((ctx) => {
    const {leds, state} = ctx;
    if (state.heat.length !== leds.length) {
      state.heat = leds.map(() => 0);
    }
    const columns = new Map<number, number[]>();
    leds.forEach((led, i) => {
      const col = Math.round(led.x / 14);
      columns.set(col, [...(columns.get(col) ?? []), i]);
    });
    stepEvery(ctx, 90, () => {
      // Fade everything, drop heads one row, spawn new drops
      state.heat = state.heat.map((h) => Math.max(0, h - 40));
      columns.forEach((ids) => {
        const sorted = [...ids].sort((a, b) => leds[a].y - leds[b].y);
        for (let r = sorted.length - 1; r > 0; r--) {
          if (state.heat[sorted[r - 1]] >= 215) {
            state.heat[sorted[r]] = 255;
          }
        }
        if (Math.random() < 0.06) {
          state.heat[sorted[0]] = 255;
        }
      });
    });
    return state.heat.map((heat) => ({
      h: 85,
      s: heat >= 215 ? 100 : 255,
      v: scale8(heat, ctx.settings.hsv.v),
    }));
  }),
  solidreactivesimple: pixel(reactiveSingle(true), true),
  solidreactive: pixel(reactiveSingle(false), true),
  solidreactivewide: pixel(reactiveSpread(false, wideMath), true),
  solidreactivemultiwide: pixel(reactiveSpread(true, wideMath), true),
  solidreactivecross: pixel(reactiveSpread(false, crossMath), true),
  solidreactivemulticross: pixel(reactiveSpread(true, crossMath), true),
  solidreactivenexus: pixel(reactiveSpread(false, nexusMath), true),
  solidreactivemultinexus: pixel(reactiveSpread(true, nexusMath), true),
  splash: pixel(reactiveSpread(false, splashMath(true)), true),
  multisplash: pixel(reactiveSpread(true, splashMath(true)), true),
  solidsplash: pixel(reactiveSpread(false, splashMath(false)), true),
  solidmultisplash: pixel(reactiveSpread(true, splashMath(false)), true),
};

const normalizeLabel = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]/g, '');

// RGB Light labels ("Breathing 2", "Rainbow Swirl 4", ...) mapped onto the
// closest matrix effect
const RGBLIGHT_ALIASES: [RegExp, string][] = [
  [/^breathing\d*$/, 'breathing'],
  [/^rainbowmood\d*$/, 'cycleall'],
  [/^rainbowswirl\d*$/, 'cycleleftright'],
  [/^gradient\d*$/, 'gradientleftright'],
  [/^twinkle\d*$/, 'jellybeanraindrops'],
];

const getEffect = (label: string): EffectDef | undefined => {
  const key = normalizeLabel(label);
  if (EFFECTS[key]) {
    return EFFECTS[key];
  }
  const alias = RGBLIGHT_ALIASES.find(([re]) => re.test(key));
  return alias && EFFECTS[alias[1]];
};

export const isPreviewableEffect = (label: string) => !!getEffect(label);

// Key centers mapped into QMK's LED space, the same way QMK's info.json
// layout conversion fills 0..224 by 0..64
export const getPreviewLeds = (keys: VIAKey[]): PreviewLed[] => {
  const centers = keys.map((k) => {
    let x = k.x + k.w / 2;
    let y = k.y + k.h / 2;
    if (k.r) {
      const rad = (k.r * Math.PI) / 180;
      const ox = x - (k.rx ?? 0);
      const oy = y - (k.ry ?? 0);
      x = (k.rx ?? 0) + ox * Math.cos(rad) - oy * Math.sin(rad);
      y = (k.ry ?? 0) + ox * Math.sin(rad) + oy * Math.cos(rad);
    }
    return {x, y};
  });
  const xs = centers.map((c) => c.x);
  const ys = centers.map((c) => c.y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  return centers.map((c, i) => ({
    x: maxX > minX ? ((c.x - minX) / (maxX - minX)) * LED_MAX_X : CENTER_X,
    y: maxY > minY ? ((c.y - minY) / (maxY - minY)) * LED_MAX_Y : CENTER_Y,
    isMod: keys[i].w > 1.25 || keys[i].h > 1,
  }));
};

export type Previewer = (timer: number) => HSV[];

// Returns a function that renders the effect at a given time (ms), or
// undefined when there's no simulation for this effect
export const createPreviewer = (
  label: string,
  leds: PreviewLed[],
  getSettings: () => PreviewSettings,
): Previewer | undefined => {
  const effect = getEffect(label);
  if (!effect || leds.length === 0) {
    return undefined;
  }
  const state = createPreviewState();
  const hits: Hit[] = [];
  let lastPress = -Infinity;
  return (timer) => {
    if (effect.reactive && timer - lastPress >= FAKE_PRESS_INTERVAL_MS) {
      lastPress = timer;
      hits.push({led: Math.floor(Math.random() * leds.length), time: timer});
      if (hits.length > HITS_TO_REMEMBER) {
        hits.shift();
      }
    }
    const ctx: Context = {leds, settings: getSettings(), timer, hits, state};
    return effect.kind === 'pixel'
      ? leds.map((led, i) => effect.fn(led, i, ctx))
      : effect.fn(ctx);
  };
};
