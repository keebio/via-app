import {FC, useState} from 'react';
import styled from 'styled-components';
import stringify from 'json-stringify-pretty-compact';
import {ErrorMessage, SuccessMessage} from '../../styled';
import {AccentUploadButton} from '../../inputs/accent-upload-button';
import {AccentButton} from '../../inputs/accent-button';
import {getByteForCode, getCodeForByte} from '../../../utils/key';
import deprecatedKeycodes from '../../../utils/key-to-byte/deprecated-keycodes';
import {title, component} from '../../icons/save';
import {CenterPane} from '../pane';
import {Detail, Label, ControlRow, SpanOverflowCell} from '../grid';
import {
  getBasicKeyToByte,
  getSelectedDefinition,
} from 'src/store/definitionsSlice';
import {
  getSelectedRawLayers,
  saveRawKeymapToDevice,
} from 'src/store/keymapSlice';
import {useAppDispatch, useAppSelector} from 'src/store/hooks';
import {
  getSelectedConnectedDevice,
  getSelectedKeyboardAPI,
} from 'src/store/devicesSlice';
import {getExpressions, saveMacros} from 'src/store/macrosSlice';
import {useTranslation} from 'react-i18next';
import {getSelectedDefinitionName} from 'src/store/definitionNameSlice';
import {
  getCustomCommands,
  getSelectedCustomMenuData,
  updateCustomMenuValue,
  updateV3MenuData,
} from 'src/store/menusSlice';

type ViaSaveFile = {
  name: string;
  vendorProductId: number;
  layers: string[][];
  macros?: string[];
  encoders?: [string, string][][];
};

// Lighting export (keebio/via-app), kept apart from the layout so importing a
// shared keymap doesn't replace your lighting
type ViaLightingFile = {
  name: string;
  vendorProductId: number;
  // Lighting menu values by command name, e.g. id_qmk_rgb_matrix_effect
  menus?: Record<string, number[]>;
  // keebio/via_per_key_rgb: [hue, sat, val, transparent] per LED for each
  // lighting layer, then each indicator overlay
  perKey?: {
    layers: number;
    indicators: number;
    overlays: number[][][];
  };
};

// Lighting channels (backlight, RGB light, RGB matrix, LED matrix) plus
// via_per_key_rgb's underglow color. Other channel 0 values are board-specific
// and may be buttons, so they're left out.
const LIGHTING_CHANNELS = [1, 2, 3, 5];
const EXTRA_LIGHTING_COMMANDS = ['id_via_per_key_underglow'];
const isLightingCommand = (name: string, [channel]: number[]) =>
  LIGHTING_CHANNELS.includes(channel) || EXTRA_LIGHTING_COMMANDS.includes(name);

const isViaSaveFile = (obj: any): obj is ViaSaveFile =>
  obj && obj.name && obj.layers && obj.vendorProductId;

const isViaLightingFile = (obj: any): obj is ViaLightingFile =>
  obj && obj.name && obj.vendorProductId && (obj.menus || obj.perKey);

const getFileBaseName = (name: string) =>
  name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

const SaveLoadPane = styled(CenterPane)`
  height: 100%;
  background: var(--color_dark_grey);
`;

const Container = styled.div`
  display: flex;
  align-items: center;
  flex-direction: column;
  padding: 0 12px;
`;

export const Pane: FC = () => {
  const {t} = useTranslation();
  const dispatch = useAppDispatch();
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const selectedDefinitionName = useAppSelector(getSelectedDefinitionName);
  const selectedDevice = useAppSelector(getSelectedConnectedDevice);
  const api = useAppSelector(getSelectedKeyboardAPI);
  const rawLayers = useAppSelector(getSelectedRawLayers);
  const macros = useAppSelector((state) => state.macros);
  const expressions = useAppSelector(getExpressions);
  const {basicKeyToByte, byteToKey} = useAppSelector(getBasicKeyToByte);
  const customCommands = useAppSelector(getCustomCommands) as Record<
    string,
    number[]
  >;
  const customMenuData = useAppSelector(getSelectedCustomMenuData);
  const hasLighting =
    Object.entries(customCommands).some(([name, command]) =>
      isLightingCommand(name, command),
    ) || !!(customMenuData as any)?.__perKeyLayers;

  // TODO: improve typing so we can remove this
  if (!selectedDefinition || !selectedDevice || !api) {
    return null;
  }

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const getEncoderValues = async () => {
    const {layouts} = selectedDefinition;
    const {keys, optionKeys} = layouts;
    const encoders = [
      ...keys,
      ...Object.values(optionKeys)
        .flatMap((a) => Object.values(a))
        .flat(),
    ]
      .filter((a) => 'ei' in a)
      .map((a) => a.ei as number);
    if (encoders.length > 0) {
      const maxEncoder = Math.max(...encoders) + 1;
      const numberOfLayers = rawLayers.length;
      const encoderValues = await Promise.all(
        Array(maxEncoder)
          .fill(0)
          .map((_, i) =>
            Promise.all(
              Array(numberOfLayers)
                .fill(0)
                .map((_, j) =>
                  Promise.all([
                    api.getEncoderValue(j, i, false),
                    api.getEncoderValue(j, i, true),
                  ]).then(
                    (a) =>
                      a.map(
                        (keyByte) =>
                          getCodeForByte(keyByte, basicKeyToByte, byteToKey) ||
                          '',
                      ) as [string, string],
                  ),
                ),
            ),
          ),
      );
      return encoderValues;
    } else {
      return [];
    }
  };

  const getLighting = async (): Promise<
    Pick<ViaLightingFile, 'menus' | 'perKey'>
  > => {
    const menus: Record<string, number[]> = {};
    Object.entries(customCommands).forEach(([name, command]) => {
      const value = (customMenuData as any)?.[name];
      if (isLightingCommand(name, command) && Array.isArray(value)) {
        // Lighting values are at most 2 bytes (16-bit ranges, hue/sat)
        menus[name] = value.slice(0, 2);
      }
    });
    // Read per-key lighting fresh: the painter writes it straight to the device
    let perKey: ViaLightingFile['perKey'];
    const ledCount: number | undefined = (customMenuData as any)
      ?.__perKeyLayers?.[0]?.length;
    if (ledCount) {
      try {
        const {layers, indicators} = await api.getPerKeyLayerInfo();
        const overlays = [];
        for (let i = 0; i < layers + indicators; i++) {
          overlays.push(await api.getPerKeyLayer(i, ledCount));
        }
        perKey = {layers, indicators, overlays};
      } catch {
        // Firmware without lighting layers
      }
    }
    return {menus, perKey};
  };

  // Returns false if per-key lighting was skipped for not matching this board
  const loadLighting = async (lighting: ViaLightingFile) => {
    Object.entries(lighting.menus ?? {}).forEach(([name, value]) => {
      const command = customCommands[name];
      if (command && isLightingCommand(name, command)) {
        dispatch(updateCustomMenuValue(name, ...command, ...value));
      }
    });
    if (!lighting.perKey) {
      return true;
    }
    // Per-key lighting goes on last: setting the underglow color resets
    // per-key brightness in firmware
    const {layers, indicators, overlays} = lighting.perKey;
    const ledCount = overlays[0]?.length;
    try {
      const info = await api.getPerKeyLayerInfo();
      if (
        info.layers !== layers ||
        info.indicators !== indicators ||
        ledCount !== (customMenuData as any)?.__perKeyLayers?.[0]?.length ||
        overlays.some((overlay) => overlay.length !== ledCount)
      ) {
        return false;
      }
    } catch {
      return false; // Firmware without lighting layers
    }
    for (let i = 0; i < overlays.length; i++) {
      await api.setPerKeyLayer(i, overlays[i]);
    }
    await api.commitCustomMenu(0);
    // Re-read so the painter shows the imported colors
    await dispatch(updateV3MenuData(selectedDevice));
    return true;
  };

  const saveLayout = async () => {
    const {vendorProductId} = selectedDefinition;
    const name = selectedDefinitionName;
    const suggestedName = getFileBaseName(name) + '.layout.json';
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
      });
      const encoderValues = await getEncoderValues();
      const saveFile: ViaSaveFile = {
        name,
        vendorProductId,
        macros: [...expressions],
        layers: rawLayers.map(
          (layer: {keymap: number[]}) =>
            layer.keymap.map(
              (keyByte: number) =>
                getCodeForByte(keyByte, basicKeyToByte, byteToKey) || '',
            ), // TODO: should empty string be empty keycode instead?
        ),
        encoders: encoderValues,
      };

      const content = stringify(saveFile);
      const blob = new Blob([content], {type: 'application/json'});
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      console.log('User cancelled save file request');
    }

    /*
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = defaultFilename;

    link.click();
    URL.revokeObjectURL(url);
*/
  };

  const loadLayout = ([file]: Blob[]) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const reader = new FileReader();

    reader.onabort = () => setErrorMessage(t('File reading was cancelled.'));
    reader.onerror = () => setErrorMessage(t('Failed to read file.'));

    reader.onload = async () => {
      const saveFile = JSON.parse((reader as any).result.toString());
      if (!isViaSaveFile(saveFile)) {
        setErrorMessage(t('Could not load file: invalid data.'));
        return;
      }

      if (saveFile.vendorProductId !== selectedDefinition.vendorProductId) {
        setErrorMessage(
          t(
            'Could not import layout. This file was created for a different keyboard: {{name}}',
            {name: saveFile.name},
          ),
        );
        return;
      }

      if (
        saveFile.layers.findIndex(
          (layer, idx) => layer.length !== rawLayers[idx].keymap.length,
        ) > -1
      ) {
        setErrorMessage(
          t(
            'Could not import layout: incorrect number of keys in one or more layers.',
          ),
        );
        return;
      }

      if (macros.isFeatureSupported && saveFile.macros) {
        if (saveFile.macros.length !== expressions.length) {
          setErrorMessage(
            t('Could not import layout: incorrect number of macros.'),
          );
          return;
        }

        dispatch(saveMacros(selectedDevice, saveFile.macros));
      }

      const keymap: number[][] = saveFile.layers.map((layer) =>
        layer.map((key) =>
          getByteForCode(`${deprecatedKeycodes[key] ?? key}`, basicKeyToByte),
        ),
      );

      // John you drongo, don't trust the compiler, dispatches are totes awaitable for async thunks
      await dispatch(saveRawKeymapToDevice(keymap, selectedDevice));

      if (saveFile.encoders) {
        await Promise.all(
          saveFile.encoders.map((encoder, id) =>
            Promise.all(
              encoder.map((layer, layerId) =>
                Promise.all([
                  api.setEncoderValue(
                    layerId,
                    id,
                    false,
                    getByteForCode(
                      `${deprecatedKeycodes[layer[0]] ?? layer[0]}`,
                      basicKeyToByte,
                    ),
                  ),
                  api.setEncoderValue(
                    layerId,
                    id,
                    true,
                    getByteForCode(
                      `${deprecatedKeycodes[layer[1]] ?? layer[1]}`,
                      basicKeyToByte,
                    ),
                  ),
                ]),
              ),
            ),
          ),
        );
      }

      setSuccessMessage(t('Successfully updated layout!'));
    };

    reader.readAsBinaryString(file);
  };

  const saveLightingFile = async () => {
    const name = selectedDefinitionName;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: getFileBaseName(name) + '.lighting.json',
      });
      const lightingFile: ViaLightingFile = {
        name,
        vendorProductId: selectedDefinition.vendorProductId,
        ...(await getLighting()),
      };
      const blob = new Blob([stringify(lightingFile)], {
        type: 'application/json',
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
    } catch (err) {
      console.log('User cancelled save file request');
    }
  };

  const loadLightingFile = ([file]: Blob[]) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const reader = new FileReader();

    reader.onabort = () => setErrorMessage(t('File reading was cancelled.'));
    reader.onerror = () => setErrorMessage(t('Failed to read file.'));

    reader.onload = async () => {
      const lightingFile = JSON.parse((reader as any).result.toString());
      if (!isViaLightingFile(lightingFile)) {
        setErrorMessage(
          t(
            isViaSaveFile(lightingFile)
              ? 'Could not load file: this is a layout file. Use Import Layout instead.'
              : 'Could not load file: invalid data.',
          ),
        );
        return;
      }

      if (lightingFile.vendorProductId !== selectedDefinition.vendorProductId) {
        setErrorMessage(
          t(
            'Could not import lighting. This file was created for a different keyboard: {{name}}',
            {name: lightingFile.name},
          ),
        );
        return;
      }

      setSuccessMessage(
        t(
          (await loadLighting(lightingFile))
            ? 'Successfully updated lighting!'
            : 'Updated lighting settings, but skipped per-key lighting: it was saved from a different lighting setup.',
        ),
      );
    };

    reader.readAsBinaryString(file);
  };

  return (
    <SpanOverflowCell>
      <SaveLoadPane>
        <Container>
          <ControlRow>
            <Label>{t('Export Current Layout')}</Label>
            <Detail>
              <AccentButton onClick={saveLayout}>{t('Export')}</AccentButton>
            </Detail>
          </ControlRow>
          <ControlRow>
            <Label>{t('Import Layout')}</Label>
            <Detail>
              <AccentUploadButton onLoad={loadLayout}>
                {t('Import')}
              </AccentUploadButton>
            </Detail>
          </ControlRow>
          {hasLighting ? (
            <>
              <ControlRow>
                <Label>{t('Export Lighting')}</Label>
                <Detail>
                  <AccentButton onClick={saveLightingFile}>
                    {t('Export')}
                  </AccentButton>
                </Detail>
              </ControlRow>
              <ControlRow>
                <Label>{t('Import Lighting')}</Label>
                <Detail>
                  <AccentUploadButton onLoad={loadLightingFile}>
                    {t('Import')}
                  </AccentUploadButton>
                </Detail>
              </ControlRow>
            </>
          ) : null}
          {errorMessage ? <ErrorMessage>{errorMessage}</ErrorMessage> : null}
          {successMessage ? (
            <SuccessMessage>{successMessage}</SuccessMessage>
          ) : null}
        </Container>
      </SaveLoadPane>
    </SpanOverflowCell>
  );
};

export const Icon = component;
export const Title = title;
