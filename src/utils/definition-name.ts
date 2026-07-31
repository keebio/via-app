import type {DynamicDefinitionName} from '@the-via/reader';

export const isDynamicDefinitionName = (
  name: unknown,
): name is DynamicDefinitionName => {
  if (!name || typeof name !== 'object') {
    return false;
  }

  const {options, content} = name as Partial<DynamicDefinitionName>;
  return (
    Array.isArray(options) &&
    options.length > 0 &&
    options.every((option) => typeof option === 'string') &&
    Array.isArray(content) &&
    content.length >= 3 &&
    typeof content[0] === 'string' &&
    content.slice(1).every((value) => typeof value === 'number')
  );
};

export const resolveDefinitionName = (
  name: unknown,
  selectedOption?: number,
): string => {
  if (typeof name === 'string') {
    return name;
  }

  if (!isDynamicDefinitionName(name)) {
    return '';
  }

  return name.options[selectedOption ?? 0] ?? name.options[0];
};
