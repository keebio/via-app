import {ThreeEvent} from '@react-three/fiber';
import {VIAKey} from '@the-via/reader';
import {useCallback, useEffect, useState} from 'react';
import {
  getSelectedConnectedDevice,
  getSelectedKeyboardAPI,
} from 'src/store/devicesSlice';
import {useAppSelector} from 'src/store/hooks';
import {getSelectedCustomMenuData} from 'src/store/menusSlice';
import {getHSVFrom256} from './color-math';

export const useColorPainter = (
  keys: VIAKey[],
  selectedPaletteColor: [number, number],
  selectedPaletteBrightness: number,
) => {
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const api = useAppSelector(getSelectedKeyboardAPI);
  const customMenuData = useAppSelector(getSelectedCustomMenuData) || {
    __perKeyRGB: [],
    __perKeyVal: [],
  };
  const [keyColors, setKeyColors] = useState<number[][]>([]);

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

  const onKeycapPointerHandler = useCallback(
    (evt: ThreeEvent<MouseEvent> | React.MouseEvent, idx: number) => {
      if (evt.buttons === 1 && api) {
        const hue = Math.round((selectedPaletteColor[0] * 255) / 360);
        const sat = Math.round(selectedPaletteColor[1] * 255);
        const ledIndex = keys[idx].li;
        if (ledIndex !== undefined) {
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
      }
    },
    [
      setKeyColors,
      selectedPaletteColor,
      selectedPaletteBrightness,
      keys,
      selectedDevice,
    ],
  );

  return {
    keyColors,
    onKeycapPointerDown: onKeycapPointerHandler,
    onKeycapPointerOver: onKeycapPointerHandler,
  };
};
