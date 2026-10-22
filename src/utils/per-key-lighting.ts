// keebio/via_per_key_rgb lighting state, kept in the custom menu data:
//   __perKeyLayers: [hue, sat, val, transparent] per LED for each lighting
//     layer, then each indicator overlay
//   __perKeyIndicatorCount: [number of indicator overlays]
//   __perKeyUnderglow: indices of the underglow LEDs

// Firmware indicator overlay order
export const INDICATOR_NAMES = [
  'Caps Lock',
  'Num Lock',
  'Scroll Lock',
  'Caps Word',
];

export type PerKeyBrush = {
  hue: number;
  sat: number;
  brightness: number; // 0 paints the LED off
  transparent: boolean;
};

export const getPerKeyLighting = (menuData: any) => {
  const layers: number[][][] | undefined = menuData?.__perKeyLayers;
  const indicatorCount: number = menuData?.__perKeyIndicatorCount?.[0] ?? 0;
  return {
    layers,
    indicatorCount,
    layerCount: layers ? layers.length - indicatorCount : 0,
    underglow: (menuData?.__perKeyUnderglow ?? []) as number[],
  };
};

// The overlay the painter edits: the selected indicator, else the lighting
// layer matching the selected keymap layer
export const resolvePaintOverlay = (
  layerCount: number,
  indicatorCount: number,
  selectedLayer: number,
  selectedIndicator: number | null,
  indicatorsOnly: boolean,
) => {
  const keymapLayer = Math.max(0, Math.min(selectedLayer, layerCount - 1));
  const requested = selectedIndicator ?? (indicatorsOnly ? 0 : null);
  const indicator =
    requested !== null && requested < indicatorCount ? requested : null;
  const overlay = indicator !== null ? layerCount + indicator : keymapLayer;
  return {keymapLayer, indicator, overlay};
};

// Off and transparent keep the LED's color so it can be restored. The base
// layer can't be transparent, so there the brush paints its color.
export const applyBrush = (
  led: number[] | undefined,
  brush: PerKeyBrush,
  overlay: number,
) => {
  const [hue, sat, val] = led ?? [brush.hue, brush.sat, 255];
  if (brush.transparent && overlay > 0) {
    return [hue, sat, val, 1];
  }
  if (brush.brightness === 0) {
    return [hue, sat, 0, 0];
  }
  return [brush.hue, brush.sat, brush.brightness, 0];
};
