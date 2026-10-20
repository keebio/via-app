import React, {useCallback, useRef} from 'react';
import styled from 'styled-components';

// Key painter brush picker. Hue, saturation and brightness are 0-255 like the
// firmware's per-key values; brightness 0 paints the LED off.
type Props = {
  hue: number;
  sat: number;
  brightness: number;
  onChange: (hue: number, sat: number, brightness: number) => void;
  // Lighting layers, on firmware that has them: higher layers overlay layer 0,
  // and keys painted transparent show the layer below
  layerCount?: number;
  layer?: number;
  transparent?: boolean;
  onTransparent?: () => void;
};

const PRESETS: {label: string; hue: number; sat: number}[] = [
  {label: 'Red', hue: 0, sat: 255},
  {label: 'Orange', hue: 21, sat: 255},
  {label: 'Yellow', hue: 43, sat: 255},
  {label: 'Green', hue: 85, sat: 255},
  {label: 'Cyan', hue: 128, sat: 255},
  {label: 'Blue', hue: 170, sat: 255},
  {label: 'Magenta', hue: 213, sat: 255},
  {label: 'White', hue: 0, sat: 0},
];

const clamp255 = (n: number) => Math.round(Math.min(255, Math.max(0, n)));

export const hsvToCss = (hue: number, sat: number, val: number) => {
  const h = (hue / 255) * 6;
  const s = sat / 255;
  const v = val / 255;
  const i = Math.floor(h) % 6;
  const f = h - Math.floor(h);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ][i];
  return `rgb(${clamp255(r * 255)},${clamp255(g * 255)},${clamp255(b * 255)})`;
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: 10px;
  width: 240px;
`;

const Area = styled.div`
  position: relative;
  height: 130px;
  border: 2px solid var(--border_color_cell);
  border-radius: 4px;
  cursor: crosshair;
  touch-action: none;
`;

const AreaLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

const HueStrip = styled.div`
  position: relative;
  height: 14px;
  border: 2px solid var(--border_color_cell);
  border-radius: 4px;
  cursor: pointer;
  touch-action: none;
  background: linear-gradient(
    to right,
    red,
    yellow,
    lime,
    aqua,
    blue,
    magenta,
    red
  );
`;

const Handle = styled.div`
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.6);
  transform: translate(-50%, -50%);
  pointer-events: none;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Swatch = styled.button<{$selected: boolean}>`
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid
    ${(props) =>
      props.$selected ? 'var(--color_accent)' : 'var(--border_color_cell)'};
  cursor: pointer;
  transform: ${(props) => (props.$selected ? 'scale(1.15)' : 'none')};
  transition: transform 0.15s ease-out;
`;

const OffSwatch = styled(Swatch)`
  background: linear-gradient(
    to top right,
    #000 calc(50% - 1px),
    #c33 50%,
    #000 calc(50% + 1px)
  );
`;

const LayerLabel = styled.span`
  font-size: 13px;
  line-height: 1.3;
  color: var(--color_label);
`;

const TransparentSwatch = styled(Swatch)`
  background: repeating-conic-gradient(#999 0 25%, #eee 0 50%) 50% / 10px 10px;
`;

const Preview = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 2px solid var(--border_color_cell);
  flex: none;
`;

const Readout = styled.span`
  font-size: 14px;
  color: var(--color_label_highlighted);
  font-variant-numeric: tabular-nums;
`;

// Calls onMove with the pointer position as 0-1 fractions while dragging
const useDrag = (onMove: (x: number, y: number) => void) =>
  useCallback(
    (evt: React.PointerEvent<HTMLDivElement>) => {
      const el = evt.currentTarget;
      el.setPointerCapture(evt.pointerId);
      const move = (e: PointerEvent | React.PointerEvent) => {
        const rect = el.getBoundingClientRect();
        onMove(
          Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
          Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
        );
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      move(evt);
    },
    [onMove],
  );

export const PainterColorPicker: React.FC<Props> = (props) => {
  const {
    hue,
    sat,
    brightness,
    onChange,
    layerCount = 1,
    layer = 0,
    transparent = false,
    onTransparent,
  } = props;
  // Brightness to return to when a preset is picked after "Off"
  const lastOn = useRef(brightness || 255);
  if (brightness > 0) {
    lastOn.current = brightness;
  }

  const onAreaPointerDown = useDrag(
    useCallback(
      (x, y) => onChange(hue, clamp255(x * 255), clamp255((1 - y) * 255)),
      [hue, onChange],
    ),
  );
  const onHuePointerDown = useDrag(
    useCallback(
      (x) =>
        onChange(
          // 255 wraps back to red; keep the right edge at the last hue
          Math.min(254, clamp255(x * 255)),
          sat,
          brightness || lastOn.current,
        ),
      [sat, brightness, onChange],
    ),
  );

  const isOff = !transparent && brightness === 0;
  return (
    <Container>
      {layerCount > 1 && (
        <LayerLabel>
          {layer === 0
            ? 'Painting base layer'
            : `Painting layer ${layer} overlay`}
        </LayerLabel>
      )}
      <Area
        title="Saturation (left to right), brightness (top to bottom; bottom is off)"
        onPointerDown={onAreaPointerDown}
      >
        <AreaLayer style={{background: hsvToCss(hue, 255, 255)}} />
        <AreaLayer
          style={{background: 'linear-gradient(to right, #fff, transparent)'}}
        />
        <AreaLayer
          style={{background: 'linear-gradient(to top, #000, transparent)'}}
        />
        <Handle
          style={{
            left: `${(sat / 255) * 100}%`,
            top: `${(1 - brightness / 255) * 100}%`,
          }}
        />
      </Area>
      <HueStrip title="Hue" onPointerDown={onHuePointerDown}>
        <Handle
          style={{
            left: `${(hue / 255) * 100}%`,
            top: '50%',
            background: hsvToCss(hue, 255, 255),
          }}
        />
      </HueStrip>
      <Row>
        {PRESETS.map((preset) => (
          <Swatch
            key={preset.label}
            title={preset.label}
            $selected={
              !isOff &&
              !transparent &&
              sat === preset.sat &&
              (preset.sat === 0 || hue === preset.hue)
            }
            style={{background: hsvToCss(preset.hue, preset.sat, 255)}}
            onClick={() =>
              onChange(preset.hue, preset.sat, brightness || lastOn.current)
            }
          />
        ))}
        <OffSwatch
          title="Off"
          $selected={isOff}
          onClick={() => onChange(hue, sat, 0)}
        />
        {layer > 0 && onTransparent && (
          <TransparentSwatch
            title="Transparent: show the layer below"
            $selected={transparent}
            onClick={onTransparent}
          />
        )}
      </Row>
      <Row>
        <Preview
          style={{
            background: transparent
              ? 'repeating-conic-gradient(#999 0 25%, #eee 0 50%) 50% / 10px 10px'
              : hsvToCss(hue, sat, brightness),
          }}
        />
        <Readout>
          {transparent
            ? 'Transparent'
            : isOff
              ? 'Off'
              : `H ${Math.round((hue / 255) * 360)}°  S ${Math.round(
                  (sat / 255) * 100,
                )}%  B ${Math.round((brightness / 255) * 100)}%`}
        </Readout>
      </Row>
    </Container>
  );
};
