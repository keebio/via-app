import type {RangeConstraint, VIAControlItem} from '@the-via/reader';

export type RangeControl = Extract<VIAControlItem, {type: 'range'}>;
export type RangeControlMap = Record<string, RangeControl>;
export type LogicalRangeValues = Record<string, number>;

const referenceId = (constraint: RangeConstraint) =>
  typeof constraint.reference === 'string'
    ? constraint.reference
    : constraint.reference[0];

export const decodeRangeValue = (value: number[], max: number) =>
  max > 255 ? (value[0] << 8) | value[1] : value[0];

export const encodeRangeValue = (value: number, max: number) =>
  max > 255 ? [value >> 8, value & 255] : [value];

export const encodeRangeCommand = (
  content: readonly [string, number, number, ...number[]],
  value: number,
  max: number,
) => {
  const [, ...command] = content;
  return [...command, ...encodeRangeValue(value, max)];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const constraintBoundary = (
  constraint: RangeConstraint,
  referencedValue: number,
) => {
  const offsetValue = referencedValue + (constraint.offset ?? 0);
  switch (constraint.operator) {
    case '>':
      return offsetValue + 1;
    case '>=':
      return offsetValue;
    case '<':
      return offsetValue - 1;
    case '<=':
      return offsetValue;
  }
};

const violates = (
  value: number,
  constraint: RangeConstraint,
  referencedValue: number,
) => {
  const comparedValue = referencedValue + (constraint.offset ?? 0);
  switch (constraint.operator) {
    case '>':
      return value <= comparedValue;
    case '>=':
      return value < comparedValue;
    case '<':
      return value >= comparedValue;
    case '<=':
      return value > comparedValue;
  }
};

export const getRangeBounds = (
  id: string,
  controls: RangeControlMap,
  values: LogicalRangeValues,
  clampConstraintsOnly = false,
  ignoredReferenceId?: string,
) => {
  const control = controls[id];
  let [min, max] = control.options;

  for (const constraint of control.constraints ?? []) {
    if (
      (clampConstraintsOnly && constraint.onViolation === 'push') ||
      referenceId(constraint) === ignoredReferenceId
    ) {
      continue;
    }
    const referencedValue = values[referenceId(constraint)];
    if (referencedValue === undefined) {
      continue;
    }
    const boundary = constraintBoundary(constraint, referencedValue);
    if (constraint.operator === '>' || constraint.operator === '>=') {
      min = Math.max(min, boundary);
    } else {
      max = Math.min(max, boundary);
    }
  }

  return {min, max};
};

export const resolveRangeChange = (
  id: string,
  requestedValue: number,
  controls: RangeControlMap,
  currentValues: LogicalRangeValues,
): LogicalRangeValues => {
  const values = {...currentValues};
  const resolving = new Set<string>();

  const resolve = (
    controlId: string,
    value: number,
    ignoredReferenceId?: string,
  ) => {
    const control = controls[controlId];
    values[controlId] = clamp(value, control.options[0], control.options[1]);
    resolving.add(controlId);

    for (const constraint of control.constraints ?? []) {
      const referencedId = referenceId(constraint);
      const referencedValue = values[referencedId];
      if (
        referencedId === ignoredReferenceId ||
        referencedValue === undefined ||
        !violates(values[controlId], constraint, referencedValue)
      ) {
        continue;
      }

      if (constraint.onViolation === 'push' && !resolving.has(referencedId)) {
        const strictAdjustment =
          constraint.operator === '>'
            ? -1
            : constraint.operator === '<'
              ? 1
              : 0;
        const desiredReference =
          values[controlId] - (constraint.offset ?? 0) + strictAdjustment;
        resolve(referencedId, desiredReference, controlId);
      }

      const boundary = constraintBoundary(constraint, values[referencedId]);
      if (constraint.operator === '>' || constraint.operator === '>=') {
        values[controlId] = Math.max(values[controlId], boundary);
      } else {
        values[controlId] = Math.min(values[controlId], boundary);
      }
    }

    resolving.delete(controlId);
  };

  resolve(id, requestedValue);
  return values;
};

export const collectRangeControls = (menus: unknown[]): RangeControlMap => {
  const controls: RangeControlMap = {};
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') {
      return;
    }
    if ('type' in value && value.type === 'range' && 'content' in value) {
      const range = value as RangeControl;
      controls[range.content[0]] = range;
      return;
    }
    if ('content' in value && Array.isArray(value.content)) {
      value.content.forEach(visit);
    }
  };
  menus.forEach(visit);
  return controls;
};
