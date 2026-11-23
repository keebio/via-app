import {VIAKey} from '@the-via/reader';
import {useMemo} from 'react';
import {
  getSelectedDefinition,
  getSelectedKeyDefinitions,
} from 'src/store/definitionsSlice';
import {useAppSelector} from 'src/store/hooks';
import {
  getSelectedKeymap,
  getSelectedLayerIndex,
  getSelectedPaletteBrightness,
  getSelectedPaletteColor,
  getPaintIndicatorsOnly,
  getSelectedPaintIndicator,
  getSelectedPaletteTransparent,
} from 'src/store/keymapSlice';
import {getLightingPreview, getShowKeyPainter} from 'src/store/menusSlice';
import {DisplayMode, NDimension} from 'src/types/keyboard-rendering';
import {useColorPainter} from 'src/utils/use-color-painter';
import {useLightingPreview} from 'src/utils/use-lighting-preview';
import {KeyboardCanvas as FiberKeyboardCanvas} from '../../three-fiber/keyboard-canvas';
import {KeyboardCanvas as StringKeyboardCanvas} from '../../two-string/keyboard-canvas';

export const getKeyboardCanvas = (dimension: '2D' | '3D') =>
  dimension === '2D' ? StringKeyboardCanvas : FiberKeyboardCanvas;

const EMPTY_KEYMAP: number[] = [];

export const ConfigureKeyboard = (props: {
  selectable?: boolean;
  dimensions?: DOMRect;
  nDimension: NDimension;
}) => {
  const {selectable, dimensions} = props;
  const matrixKeycodes = useAppSelector(
    (state) => getSelectedKeymap(state) || EMPTY_KEYMAP,
  );
  const keys: (VIAKey & {ei?: number})[] = useAppSelector(
    getSelectedKeyDefinitions,
  );
  const definition = useAppSelector(getSelectedDefinition);
  const showKeyPainter = useAppSelector(getShowKeyPainter);
  const selectedPaletteColor = useAppSelector(getSelectedPaletteColor);
  const selectedPaletteBrightness = useAppSelector(
    getSelectedPaletteBrightness,
  );
  const selectedPaletteTransparent = useAppSelector(
    getSelectedPaletteTransparent,
  );
  // The key painter edits the lighting layer matching the selected keymap layer
  const selectedPaintLayer = useAppSelector(getSelectedLayerIndex);
  const selectedPaintIndicator = useAppSelector(getSelectedPaintIndicator);
  const paintIndicatorsOnly = useAppSelector(getPaintIndicatorsOnly);
  const {keyColors, onKeycapPointerDown, onKeycapPointerOver} = useColorPainter(
    keys,
    selectedPaletteColor,
    selectedPaletteBrightness,
    selectedPaletteTransparent,
    selectedPaintLayer,
    selectedPaintIndicator,
    paintIndicatorsOnly,
  );
  const previewColors = useLightingPreview(keys);
  const lightingPreview = useAppSelector(getLightingPreview);
  // Hovering another effect in the open dropdown shows it full-board, over any
  // key painter. Otherwise a painter wins, except the indicator painter, which
  // paints over the running effect.
  const showPreview =
    !!previewColors && (!showKeyPainter || !!lightingPreview?.hovering);
  const blendPreview =
    !!previewColors && !showPreview && showKeyPainter && paintIndicatorsOnly;
  const painterColors = useMemo(
    () =>
      blendPreview && keyColors
        ? keyColors.map((color, i) =>
            // Keys transparent in the indicator overlay show the effect
            color && color[3] ? previewColors![i] : color,
          )
        : keyColors,
    [blendPreview, keyColors, previewColors],
  );
  const [normalizedKeys, normalizedColors] = useMemo(() => {
    // skip keys without colors on it
    return painterColors && keys
      ? [
          keys.filter((_, i) => painterColors[i] && painterColors[i].length),
          painterColors.filter((i) => i && i.length),
        ]
      : [null, null];
  }, [keys, painterColors]);

  if (!definition || !dimensions) {
    return null;
  }

  const showKeyboardCanvas = normalizedKeys?.length && normalizedColors?.length;

  const KeyboardCanvas = getKeyboardCanvas(props.nDimension);
  return (
    <>
      <KeyboardCanvas
        matrixKeycodes={matrixKeycodes}
        keys={keys}
        selectable={!!selectable}
        definition={definition}
        containerDimensions={dimensions}
        mode={DisplayMode.Configure}
        shouldHide={showKeyPainter || showPreview}
      />
      {showPreview ? (
        <KeyboardCanvas
          matrixKeycodes={matrixKeycodes}
          keys={keys}
          selectable={false}
          definition={definition}
          containerDimensions={dimensions}
          mode={DisplayMode.ConfigureColors}
          keyColors={previewColors}
          shouldHide={false}
        />
      ) : null}
      {showKeyboardCanvas ? (
        <KeyboardCanvas
          matrixKeycodes={matrixKeycodes}
          keys={normalizedKeys}
          selectable={showKeyPainter}
          definition={definition}
          containerDimensions={dimensions}
          mode={DisplayMode.ConfigureColors}
          keyColors={normalizedColors}
          onKeycapPointerDown={onKeycapPointerDown}
          onKeycapPointerOver={onKeycapPointerOver}
          shouldHide={!showKeyPainter || showPreview}
        />
      ) : null}
    </>
  );
};
