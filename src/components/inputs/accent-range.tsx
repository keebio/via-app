import React, { useState } from 'react';
import styled from 'styled-components';

const Container = styled.span`
  display: inline-flex;
  line-height: initial;
  width: 250px;
  gap: 8px;
`;

const ValueLabel = styled.span`
  min-width: 2.5em;
  text-align: right;
  font-size: 0.875em;
  color: var(--color_label-highlighted);
  flex-shrink: 0;
`;

const SliderInput = styled.input.attrs({ type: 'range' }) <any>`
  accent-color: var(--color_accent);
  width: 100%;
`;

export const AccentRange: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
    onChange: (x: number) => void;
  }
> = (props) => {
  const [value, setValue] = useState<number>(+(props.defaultValue ?? 0));
  return (
    <Container>
      <ValueLabel>{value}</ValueLabel>
      <SliderInput
        {...props}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const num = +e.target.value;
          setValue(num);
          props.onChange && props.onChange(num);
        }}
      />
    </Container>
  );
};
