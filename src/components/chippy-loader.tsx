import styled from 'styled-components';
import imgSrc from 'assets/images/chippy_600.png';
import { Theme } from 'src/utils/themes';
import { getDarkenedColor } from 'src/utils/color-math';
import { getSelectedTheme } from 'src/store/settingsSlice';
import { useAppSelector } from 'src/store/hooks';
import { VIALogo } from './icons/via';

const defaultChippy = {
  width: 300,
  height: 300,
  src: imgSrc,
};

const LoaderContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const CircleContainer = styled.div<{
  $containerHeight: number;
  $containerWidth: number;
  $progress: number | null;
  $progressColor: string;
}>`
  border-radius: 50%;
  background-color: var(--bg_icon);
  height: ${(props) => props.$containerHeight}px;
  width: ${(props) => props.$containerWidth}px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;

  animation-duration: 1.5s;
  animation-name: roll;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  animation-timing-function: ease-in-out;

  &::after {
    height: ${(props) => props.$containerHeight}px;
    width: ${(props) => props.$containerWidth}px;
    position: absolute;
    content: '';
    background-color: ${(p) => p.$progressColor};
    top: ${(props) => props.$containerHeight + 1}px;
    left: 0;
    right: 0;
    transition: transform 0.4s ease-out;
    transform: translate3d(
      0,
      ${(props) => -(props.$progress || 0) * props.$containerHeight}px,
      0
    );
  }
`;

type Props = {
  progress: number | null;
  width?: number;
  height?: number;
  theme: Theme;
};

const SvgComponent: React.FC<{ theme: Theme } & React.SVGProps<SVGSVGElement>> = ({ theme, ...props }) => {
  const darkAccent = getDarkenedColor(theme.accent.c, 0.8);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10%',
      boxSizing: 'border-box'
    }}>
      <VIALogo
        style={{
          width: '100%',
          height: '100%',
          ...props.style
        }}
      />
    </div>
  );
};

export default function ChippyLoader(props: Props) {
  const width = props.width || defaultChippy.width;
  const height = props.width || defaultChippy.height;
  const containerPadding = width * 0.25;
  const [containerHeight, containerWidth] = [
    height + containerPadding * 2,
    width + containerPadding * 2,
  ];
  const selectedTheme = useAppSelector(getSelectedTheme);

  return (
    <LoaderContainer>
      <CircleContainer
        $progress={props.progress}
        $progressColor={getDarkenedColor(selectedTheme.accent.c, 0.9)}
        $containerHeight={containerHeight}
        $containerWidth={containerWidth}
      >
        <div
          style={{
            zIndex: 1,
            width: width,
          }}
        >
          <SvgComponent theme={props.theme} />
        </div>
      </CircleContainer>
    </LoaderContainer>
  );
}
