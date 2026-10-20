import {PropsWithChildren, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

export const Keycap2DTooltip: React.FC<PropsWithChildren> = (props) => {
  const styles = useMemo(
    () => ({
      containerStyles: {
        position: 'absolute',
        left: '50%',
        transformOrigin: 'left',
        transition: 'all 0.1s ease-in-out',
        top: 0,
        marginTop: -40,
        zIndex: 4,
        pointerEvents: 'none',
        filter: 'drop-shadow(0px 0px 1px white)',
      },
      contentStyles: {
        padding: '5px 8px',
        borderRadius: 10,
        background: 'var(--color_accent)',
        color: 'var(--color_inside-accent)',
        fontFamily:
          "'Fira Sans Condensed', Helvetica, Helvetica Neue, Arial, serif",
        fontSize: 16,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textTransform: 'uppercase',
        zIndex: 5,
        transform: 'translateX(-50%)',
      },
      pointerStyles: {
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `6px solid var(--color_accent)`,
        position: 'absolute',
        marginLeft: -6,
        width: 0,
      },
    }),
    [],
  );

  return (
    <Tooltip
      {...props}
      containerStyles={styles.containerStyles}
      contentStyles={styles.contentStyles}
      pointerStyles={styles.pointerStyles}
    />
  );
};

export const KeycapTooltip: React.FC<any> = (props) => {
  const styles = useMemo(
    () => ({
      containerStyles: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        marginTop: -800,
      },
      contentStyles: {
        padding: '70px 70px',
        background: 'var(--color_accent)',
        color: 'var(--color_inside-accent)',
        borderRadius: 100,
        fontSize: 200,
        fontFamily: "'Fira Sans', Helvetica, Helvetica Neue, Arial, serif",
        whiteSpace: 'nowrap',
        letterSpacing: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontWeight: 'bold',
      },
      pointerStyles: {
        height: 150,
        width: 150,
        marginTop: -100,
        transform: 'rotate(45deg)',
        background: 'var(--color_accent)',
      },
    }),
    [],
  );

  return (
    <Tooltip
      {...props}
      containerStyles={styles.containerStyles}
      contentStyles={styles.contentStyles}
      pointerStyles={styles.pointerStyles}
    />
  );
};

export const CategoryMenuTooltip: React.FC<any> = (props) => {
  const styles = useMemo(
    () => ({
      containerStyles: {
        position: 'absolute',
        top: 45,
        left: 0,
        transformOrigin: 'left',
        transition: 'all 0.1s ease-in-out',
        marginTop: 0,
        zIndex: 4,
        pointerEvents: 'none',
      },
      contentStyles: {
        padding: '5px 10px',
        borderRadius: 10,
        background: 'var(--color_accent)',
        color: 'var(--color_inside-accent)',
        fontFamily:
          "'Fira Sans Condensed', Helvetica, Helvetica Neue, Arial, serif",
        fontSize: 18,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textTransform: 'uppercase',
        zIndex: 5,
        transform: 'translateX(-50%)',
        marginLeft: 18,
      },
      pointerStyles: {
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: `6px solid var(--color_accent)`,
        position: 'absolute',
        marginLeft: 15,
        marginTop: -41,
        width: 0,
      },
    }),
    [],
  );

  return (
    <Tooltip
      {...props}
      containerStyles={styles.containerStyles}
      contentStyles={styles.contentStyles}
      pointerStyles={styles.pointerStyles}
    />
  );
};

export const ProgressBarTooltip: React.FC<any> = (props) => {
  const styles = useMemo(
    () => ({
      containerStyles: {
        position: 'absolute',
        left: '50%',
        transformOrigin: 'left',
        transition: 'all 0.1s ease-in-out',
        top: 0,
        marginTop: -40,
        zIndex: 4,
        pointerEvents: 'none',
      },
      contentStyles: {
        padding: '5px 10px',
        borderRadius: 10,
        background: 'var(--color_inside-accent)',
        color: 'var(--color_accent)',
        fontFamily:
          "'Fira Sans Condensed', Helvetica, Helvetica Neue, Arial, serif",
        fontSize: 18,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textTransform: 'uppercase',
        zIndex: 5,
        transform: 'translateX(-50%)',
      },
      pointerStyles: {
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: `6px solid var(--color_inside-accent)`,
        position: 'absolute',
        marginLeft: -6,
        width: 0,
      },
    }),
    [],
  );

  return (
    <Tooltip
      {...props}
      containerStyles={styles.containerStyles}
      contentStyles={styles.contentStyles}
      pointerStyles={styles.pointerStyles}
    />
  );
};

export const IconButtonTooltip: React.FC<any> = (props) => {
  const styles = useMemo(
    () => ({
      containerStyles: {
        position: 'absolute',
        top: 50,
        left: 0,
        transformOrigin: 'left',
        transition: 'all 0.1s ease-in-out',
        marginTop: 0,
        zIndex: 4,
        pointerEvents: 'none',
      },
      contentStyles: {
        padding: '5px 10px',
        borderRadius: 10,
        background: 'var(--color_inside-accent)',
        color: 'var(--color_accent)',
        fontFamily:
          "'Fira Sans Condensed', Helvetica, Helvetica Neue, Arial, serif",
        fontSize: 18,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textTransform: 'uppercase',
        zIndex: 5,
        transform: 'translateX(-50%)',
        marginLeft: 18,
      },
      pointerStyles: {
        borderStyle: 'solid',
        borderColor: 'transparent',
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: `6px solid var(--color_inside-accent)`,
        position: 'absolute',
        marginLeft: 15,
        marginTop: -41,
        width: 0,
      },
    }),
    [],
  );

  return (
    <Tooltip
      {...props}
      containerStyles={styles.containerStyles}
      contentStyles={styles.contentStyles}
      pointerStyles={styles.pointerStyles}
    />
  );
};

export const MenuTooltip: React.FC<any> = (props) => {
  const anchorRef = useRef<HTMLSpanElement>(null);

  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
  });

  useEffect(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      return;
    }

    const menuItem = anchor.parentElement;

    if (!menuItem) {
      return;
    }

    const updatePosition = () => {
      const rect = menuItem.getBoundingClientRect();

      setPosition({
        left: rect.right + 10,
        top: rect.top + rect.height / 2,
      });
    };

    const handleMouseEnter = () => {
      updatePosition();
      setVisible(true);
    };

    const handleMouseLeave = () => {
      setVisible(false);
    };

    const handleScroll = () => {
      updatePosition();
    };

    menuItem.addEventListener('mouseenter', handleMouseEnter);
    menuItem.addEventListener('mouseleave', handleMouseLeave);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      menuItem.removeEventListener('mouseenter', handleMouseEnter);
      menuItem.removeEventListener('mouseleave', handleMouseLeave);

      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  return (
    <>
      <span
        ref={anchorRef}
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          pointerEvents: 'none',
        }}
      />

      {typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,

              transform: visible
                ? 'translateY(-50%) scale(1)'
                : 'translateY(-50%) translateX(-5px) scale(0.6)',

              transformOrigin: 'left center',

              transition:
                'opacity 0.1s ease-in-out, transform 0.1s ease-in-out',

              opacity: visible ? 1 : 0,

              zIndex: 10000,
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                padding: '5px 5px',
                background: 'var(--color_inside-accent)',
                color: 'var(--color_accent)',
                borderRadius: 10,

                fontFamily:
                  "'Fira Sans Condensed', Helvetica, Helvetica Neue, Arial, serif",

                /*
                 * These values were originally inherited from Row.
                 * Because this tooltip is now rendered into document.body,
                 * they must be specified explicitly.
                 */
                fontSize: 20,
                lineHeight: '20px',
                fontWeight: 400,
                textTransform: 'uppercase',

                whiteSpace: 'nowrap',

                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {props.children}
            </div>

            <div
              style={{
                borderStyle: 'solid',
                borderColor: 'transparent',

                borderTop: '6px solid transparent',
                borderBottom: '6px solid transparent',
                borderRight: '6px solid var(--color_inside-accent)',

                position: 'absolute',

                left: -12,
                top: '50%',

                transform: 'translateY(-50%)',

                width: 0,
                height: 0,
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
};

export const Tooltip: React.FC<any> = (props) => {
  const {containerStyles, contentStyles, pointerStyles} = props;

  return (
    <div style={containerStyles} className={'tooltip'}>
      <div style={contentStyles}>{props.children}</div>
      <div style={pointerStyles}></div>
    </div>
  );
};
