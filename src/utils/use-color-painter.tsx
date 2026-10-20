import {ThreeEvent} from '@react-three/fiber';
import {VIAKey} from '@the-via/reader';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  getSelectedConnectedDevice,
  getSelectedKeyboardAPI,
} from 'src/store/devicesSlice';
import {useAppSelector} from 'src/store/hooks';
import {getSelectedCustomMenuData} from 'src/store/menusSlice';
import {getHSVFrom256} from './color-math';

// Keys that fall through to a lower lighting layer are drawn dimmed
const TRANSPARENT_DIM = 0.3;

export const useColorPainter = (
  keys: VIAKey[],
  selectedPaletteColor: [number, number],
  selectedPaletteBrightness: number,
  selectedPaletteTransparent = false,
  selectedPaintLayer = 0,
) => {
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const api = useAppSelector(getSelectedKeyboardAPI);
  const customMenuData = useAppSelector(getSelectedCustomMenuData) || {
    __perKeyRGB: [],
    __perKeyVal: [],
  };
  const [keyColors, setKeyColors] = useState<number[][]>([]);
  // [hue, sat, val, transparent] per LED per layer, on firmware with lighting layers
  const deviceLayers: number[][][] | undefined = (customMenuData as any)
    .__perKeyLayers;
  const [layers, setLayers] = useState<number[][][] | undefined>();
  useEffect(() => {
    setLayers(deviceLayers?.map((layer) => layer.map((led) => [...led])));
  }, [deviceLayers]);
  const paintLayer = layers
    ? Math.min(selectedPaintLayer, layers.length - 1)
    : 0;

  useEffect(() => {
    const perKeyRGB = (customMenuData as any).__perKeyRGB ?? [];
    const perKeyVal: number[] = (customMenuData as any).__perKeyVal ?? [];
    const ledIndices = keys.find((k) => 'li' in k)
      ? keys.map((k) => k.li ?? -1)
      : [];
    const storeKeyColors = ledIndices.map((i: number) => {
      const color = perKeyRGB[i ?? -1];
      if (color) {
        const [hue, sat] = getHSVFrom256(color);
        return [hue, sat, (perKeyVal[i] ?? 255) / 255];
      }
      return undefined;
    });
    setKeyColors(storeKeyColors as any);
  }, [
    customMenuData.__perKeyRGB && customMenuData.__perKeyRGB.length,
    (customMenuData as any).__perKeyVal,
    keys,
  ]);

  // The selected layer as it looks with every layer below it active
  const layerKeyColors = useMemo(
    () =>
      layers &&
      keys.map((key) => {
        if (key.li === undefined) {
          return undefined;
        }
        let layer = paintLayer;
        while (layer > 0 && layers[layer][key.li]?.[3]) {
          layer--;
        }
        const led = layers[layer][key.li];
        if (!led) {
          return undefined;
        }
        const [hue, sat] = getHSVFrom256(led);
        const val = led[2] / 255;
        // 4th element flags the key as transparent on this layer
        return layer === paintLayer
          ? [hue, sat, val, 0]
          : [hue, sat, val * TRANSPARENT_DIM, 1];
      }),
    [layers, paintLayer, keys],
  );

  const onKeycapPointerHandler = useCallback(
    (evt: ThreeEvent<MouseEvent> | React.MouseEvent, idx: number) => {
      if (evt.buttons === 1 && api) {
        const hue = Math.round((selectedPaletteColor[0] * 255) / 360);
        const sat = Math.round(selectedPaletteColor[1] * 255);
        const ledIndex = keys[idx].li;
        if (ledIndex === undefined) {
          return;
        }
        if (layers) {
          if (selectedPaletteTransparent && paintLayer === 0) {
            return; // the base layer can't be transparent
          }
          const [h, s, v] = layers[paintLayer][ledIndex] ?? [hue, sat, 255];
          // Off and transparent keep the LED's color so it can be restored
          const led = selectedPaletteTransparent
            ? [h, s, v, 1]
            : selectedPaletteBrightness === 0
              ? [h, s, 0, 0]
              : [hue, sat, selectedPaletteBrightness, 0];
          api.setPerKeyLayerLED(paintLayer, ledIndex, led);
          api.commitCustomMenu(0);
          setLayers((current) =>
            current?.map((layer, i) =>
              i === paintLayer
                ? layer.map((entry, j) => (j === ledIndex ? led : entry))
                : layer,
            ),
          );
          return;
        }
        if (selectedPaletteBrightness === 0) {
          // Off keeps the LED's hue/sat so turning it back on restores it
          api.setPerKeyRGBValue(ledIndex, 0);
        } else {
          // Firmware resets brightness to full when hue/sat is set
          api.setPerKeyRGBMatrix(ledIndex, hue, sat);
          if (selectedPaletteBrightness !== 255) {
            api.setPerKeyRGBValue(ledIndex, selectedPaletteBrightness);
          }
        }
        api.commitCustomMenu(0);
        setKeyColors((colors) => {
          const val = selectedPaletteBrightness / 255;
          colors[idx] =
            selectedPaletteBrightness === 0 && colors[idx]
              ? [colors[idx][0], colors[idx][1], val]
              : [...selectedPaletteColor, val];
          return [...colors];
        });
      }
    },
    [
      setKeyColors,
      selectedPaletteColor,
      selectedPaletteBrightness,
      selectedPaletteTransparent,
      paintLayer,
      layers,
      keys,
      selectedDevice,
    ],
  );

  return {
    keyColors: (layerKeyColors ?? keyColors) as number[][],
    onKeycapPointerDown: onKeycapPointerHandler,
    onKeycapPointerOver: onKeycapPointerHandler,
  };
};
