import type {VIAKey} from '@the-via/reader';
import {useEffect, useMemo, useRef, useState} from 'react';
import {useAppSelector} from 'src/store/hooks';
import {
  getLightingPreview,
  getSelectedCustomMenuData,
} from 'src/store/menusSlice';
import {
  createPreviewer,
  getPreviewLeds,
  type PreviewSettings,
} from './lighting-preview';

// Re-rendering every keycap is the expensive part, so cap the frame rate
const FRAME_MS = 1000 / 30;

const firstByte = (value: unknown, fallback: number) =>
  Array.isArray(value) && typeof value[0] === 'number' ? value[0] : fallback;

// Animated key colors ([hue 0..360, sat 0..1, val 0..1]) for the lighting
// effect being previewed, or null when there's nothing to preview
export const useLightingPreview = (keys: VIAKey[]): number[][] | null => {
  const preview = useAppSelector(getLightingPreview);
  const menuData = useAppSelector(getSelectedCustomMenuData) || {};
  const [colors, setColors] = useState<number[][] | null>(null);

  // Brightness, speed and color live next to the effect command, e.g.
  // id_qmk_rgb_matrix_effect -> id_qmk_rgb_matrix_brightness
  const prefix = preview?.effectId.replace(/_effect$/, '');
  const color = prefix && (menuData as any)[`${prefix}_color`];
  const settings: PreviewSettings = {
    hsv: {
      h: firstByte(color, 0),
      s: Array.isArray(color) && typeof color[1] === 'number' ? color[1] : 255,
      v: firstByte(prefix && (menuData as any)[`${prefix}_brightness`], 255),
    },
    speed: firstByte(
      prefix && (menuData as any)[`${prefix}_effect_speed`],
      128,
    ),
  };
  // Read through a ref so slider changes don't restart the animation
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Only keys with LEDs light up; keys without one are drawn dark
  const ledKeys = useMemo(() => {
    const hasLedIndices = keys.some((k) => 'li' in k);
    return keys.map((k) => !hasLedIndices || k.li !== undefined);
  }, [keys]);
  const leds = useMemo(
    () => getPreviewLeds(keys.filter((_, i) => ledKeys[i])),
    [keys, ledKeys],
  );

  useEffect(() => {
    const previewer =
      preview &&
      createPreviewer(preview.label, leds, () => settingsRef.current);
    if (!previewer) {
      setColors(null);
      return;
    }
    let frame = 0;
    let lastFrame = -Infinity;
    const start = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (now - lastFrame < FRAME_MS) {
        return;
      }
      lastFrame = now;
      const hsvs = previewer(now - start);
      let led = 0;
      setColors(
        ledKeys.map((hasLed) => {
          if (!hasLed) {
            return [0, 0, 0];
          }
          const {h, s, v} = hsvs[led++] ?? {h: 0, s: 0, v: 0};
          return [(h * 360) / 256, s / 255, v / 255];
        }),
      );
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [preview?.label, leds, ledKeys]);

  return colors;
};
