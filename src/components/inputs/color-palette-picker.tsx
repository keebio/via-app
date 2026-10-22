import {Color} from '@the-via/reader';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {useDispatch} from 'react-redux';
import {useAppSelector} from 'src/store/hooks';
import {
  getSelected256PaletteColor,
  getSelectedLayerIndex,
  getSelectedPaletteBrightness,
  getSelectedPaintIndicator,
  getSelectedPaletteTransparent,
  setSelectedPaletteBrightness,
  setSelectedPaletteColor,
  setPaintIndicatorsOnly,
  setSelectedPaintIndicator,
  setSelectedPaletteTransparent,
} from 'src/store/keymapSlice';
import {
  getSelectedCustomMenuData,
  paintPerKeyLeds,
  updateShowKeyPainter,
} from 'src/store/menusSlice';
import {
  getPerKeyLighting,
  INDICATOR_NAMES,
  resolvePaintOverlay,
} from 'src/utils/per-key-lighting';
import {getRGB} from 'src/utils/color-math';
import styled from 'styled-components';
import {ColorPicker} from './color-picker';
import {PainterColorPicker} from './painter-color-picker';

type Props = {
  color: Color;
  setColor: (hue: number, sat: number) => void;
};

const ColorPalettePickerContainer = styled.div`
  display: flex;
  align-items: center;
  column-gap: 10px;
`;

const PreviousColorContainer = styled.div`
  display: flex;
  background: var(--bg_control);
  border-radius: 15px;
`;

const PreviousColorOption = styled.div<{$selected: boolean}>`
  display: inline-block;
  height: 25px;
  width: 25px;
  border-radius: 50%;
  border: 4px solid var(--border_color_cell);
  cursor: pointer;
  transition: transform 0.2s ease-out;
  &:hover {
    opacity: 0.8;
  }
  transform: ${(props) => (props.$selected ? 'scale(0.8)' : 'scale(0.6)')};
  border-color: ${(props) =>
    props.$selected ? 'var(--color_accent)' : 'var(--border_color_cell)'};
`;

export const ConnectedColorPalettePicker: React.FC<{
  indicatorsOnly?: boolean;
}> = ({indicatorsOnly = false}) => {
  const dispatch = useDispatch();
  const [hue, sat] = useAppSelector(getSelected256PaletteColor);
  const brightness = useAppSelector(getSelectedPaletteBrightness);
  const transparent = useAppSelector(getSelectedPaletteTransparent);
  // Lighting layer follows VIA's keymap layer selector
  const layer = useAppSelector(getSelectedLayerIndex);
  const customMenuData = useAppSelector(getSelectedCustomMenuData);
  const {layers, layerCount, indicatorCount, underglow} =
    getPerKeyLighting(customMenuData);
  const selectedIndicator = useAppSelector(getSelectedPaintIndicator);
  const {indicator, overlay} = resolvePaintOverlay(
    Math.max(layerCount, 1),
    indicatorCount,
    layer,
    selectedIndicator,
    indicatorsOnly,
  );
  // Underglow on the overlay being painted: one entry, or null if mixed
  const underglowLeds = layers
    ? underglow.map((i) => layers[overlay]?.[i])
    : [];
  const underglowLed = underglowLeds.every(
    (led) => led && led.join() === underglowLeds[0].join(),
  )
    ? underglowLeds[0]
    : null;
  const onPaintUnderglow = useCallback(
    () =>
      dispatch(
        paintPerKeyLeds(overlay, underglow, {
          hue,
          sat,
          brightness,
          transparent,
        }) as any,
      ),
    [dispatch, overlay, underglow, hue, sat, brightness, transparent],
  );
  useEffect(() => {
    dispatch(setPaintIndicatorsOnly(indicatorsOnly));
    return () => {
      dispatch(setPaintIndicatorsOnly(false));
    };
  }, [dispatch, indicatorsOnly]);
  const onChange = useCallback(
    (hue: number, sat: number, brightness: number) => {
      dispatch(setSelectedPaletteColor([hue, sat]));
      dispatch(setSelectedPaletteBrightness(brightness));
      dispatch(setSelectedPaletteTransparent(false));
    },
    [dispatch],
  );
  const onTransparent = useCallback(
    () => dispatch(setSelectedPaletteTransparent(true)),
    [dispatch],
  );
  const onIndicatorChange = useCallback(
    (indicator: number | null) =>
      dispatch(setSelectedPaintIndicator(indicator)),
    [dispatch],
  );
  useEffect(() => {
    dispatch(updateShowKeyPainter(true));
    return () => {
      dispatch(updateShowKeyPainter(false));
    };
  });
  return (
    <PainterColorPicker
      hue={hue}
      sat={sat}
      brightness={brightness}
      onChange={onChange}
      layerCount={Math.max(layerCount, 1)}
      layer={Math.max(0, Math.min(layer, layerCount - 1))}
      transparent={transparent && overlay > 0}
      onTransparent={onTransparent}
      indicators={INDICATOR_NAMES.slice(0, indicatorCount)}
      indicator={indicator}
      onIndicatorChange={onIndicatorChange}
      allowLayer={!indicatorsOnly}
      {...(underglowLeds.length > 0 && {
        underglowLed,
        onPaintUnderglow,
      })}
    />
  );
};
export const ColorPalettePicker: React.FC<{
  color: [number, number];
  setColor: Props['setColor'];
}> = (props) => {
  const {color, setColor} = props;
  const [selectedColor, setSelectedColor] = useState(color);
  const [colorPickerColor, setPickerColor] = useState(color);
  const initialColors = useMemo(() => {
    return Array(9)
      .fill(0)
      .map((_, i) => {
        return [Math.round((i * 255) / 10), 255, 255];
      });
  }, []);
  return (
    <ColorPalettePickerContainer>
      <PreviousColorContainer>
        {initialColors.map((savedColor, idx) => {
          const isSelected =
            selectedColor[0] === savedColor[0] &&
            selectedColor[1] === savedColor[1];
          return (
            <PreviousColorOption
              key={idx}
              $selected={isSelected}
              style={{
                background: getRGB({
                  hue: savedColor[0] ?? 0,
                  sat: savedColor[1] ?? 0,
                }),
              }}
              onClick={() => {
                setSelectedColor(savedColor as [number, number]);
                setColor(savedColor[0], savedColor[1]);
              }}
            />
          );
        })}
      </PreviousColorContainer>
      <ColorPicker
        isSelected={
          colorPickerColor[0] === selectedColor[0] &&
          colorPickerColor[1] === selectedColor[1]
        }
        color={{hue: colorPickerColor[0], sat: colorPickerColor[1]}}
        setColor={(h, s) => {
          setSelectedColor([h, s]);
          setPickerColor([h, s]);
        }}
        onOpen={() => {
          setSelectedColor([colorPickerColor[0], colorPickerColor[1]]);
          setColor(colorPickerColor[0], colorPickerColor[1]);
        }}
        onMouseUp={() => {
          setSelectedColor([colorPickerColor[0], colorPickerColor[1]]);
          setColor(colorPickerColor[0], colorPickerColor[1]);
        }}
      />
    </ColorPalettePickerContainer>
  );
};
