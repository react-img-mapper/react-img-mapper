import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import isEqual from 'react-fast-compare';

import { getExtendedArea } from '@/helpers/area';
import { generateProps, rerenderPropsList } from '@/helpers/constants';
import { getDimensions } from '@/helpers/dimensions';
import drawShape from '@/helpers/draw';
import {
  click,
  imageClick,
  imageMouseMove,
  mouseDown,
  mouseEnter,
  mouseLeave,
  mouseMove,
  mouseUp,
  touchEnd,
  touchStart,
} from '@/helpers/events';
import styles from '@/helpers/styles';

import type { ImageMapperProps, Map, MapArea, RefProperties, Refs } from '@/types';
import type { CTX } from '@/types/draw.type';
import type { ReactNode } from 'react';

export * from '@/types';

const ImageMapper = forwardRef<RefProperties, Required<ImageMapperProps>>((props, ref) => {
  const {
    active,
    disabled,
    fillColor,
    lineWidth,
    map,
    src,
    strokeColor,
    natural,
    height,
    width,
    imgWidth,
    areaKeyName,
    highlighted,
    parentWidth,
    responsive,
    onChange,
    onLoad,
    onMouseEnter,
    onMouseLeave,
    onClick,
    onImageClick,
    onImageMouseMove,
    onTouchStart,
    onTouchEnd,
    onMouseUp,
    onMouseDown,
    onMouseMove,
  } = props;

  const [isRendered, setRendered] = useState<boolean>(false);
  const mapRef = useRef<Map>(map);
  const containerRef = useRef<Refs['containerRef']>(null);
  const img = useRef<Refs['imgRef']>(null);
  const canvas = useRef<Refs['canvasRef']>(null);
  const ctx = useRef<CTX<null>['current']>(null);
  const interval = useRef<number>(0);
  const prevParentWidth = useRef<number>(parentWidth ?? 0);

  const dimensionParams = useMemo(
    () => ({ width, height, responsive, parentWidth, natural }),
    [width, height, responsive, parentWidth, natural]
  );

  const scaleCoordsParams = useMemo(
    () => ({ width, height, responsive, parentWidth, imgWidth }),
    [width, height, responsive, parentWidth, imgWidth]
  );

  const areaParams = useMemo(
    () => ({ fillColor, lineWidth, strokeColor }),
    [fillColor, lineWidth, strokeColor]
  );

  const init = useCallback(() => {
    if (img.current?.complete && canvas.current && containerRef.current) {
      ctx.current = canvas.current.getContext('2d');

      setRendered(true);
      console.log({ img: img.current });
    }
  }, []);

  useEffect(() => {
    if (!isRendered) {
      interval.current = window.setInterval(init, 500);
    } else {
      clearInterval(interval.current);
    }
  }, [init, isRendered]);

  const renderPrefilledAreas = useCallback(() => {
    map.areas.forEach(area => {
      const extendedArea = getExtendedArea(area, { img, ...scaleCoordsParams }, areaParams);

      if (!extendedArea.preFillColor) return false;

      return drawShape({ ...extendedArea, fillColor: extendedArea.preFillColor }, ctx);
    });
  }, [areaParams, map, scaleCoordsParams]);

  const clearCanvas = useCallback(() => {
    if (!(ctx.current && canvas.current)) return;

    ctx.current.clearRect(0, 0, canvas.current.width, canvas.current.height);
  }, []);

  const resetCanvasAndPrefillArea = useCallback(() => {
    clearCanvas();
    renderPrefilledAreas();
  }, [clearCanvas, renderPrefilledAreas]);

  const highlightArea = (area: MapArea): boolean => {
    const extendedArea = getExtendedArea(area, { img, ...scaleCoordsParams }, areaParams);

    if (!extendedArea.active) return false;

    return drawShape(extendedArea, ctx);
  };

  const onHighlightArea = (area: MapArea): void => {
    if (!highlighted) return;

    const { isMulti = true, toggle = false } = highlighted;
    const areasRef = mapRef.current.areas;

    const chosenArea = isMulti ? area : areasRef.find(c => c[areaKeyName] === area[areaKeyName]);
    if (!chosenArea) return;

    const extendedArea = getExtendedArea(chosenArea, { img, ...scaleCoordsParams }, areaParams);
    if (!(active && extendedArea.active)) return;

    const chosenMap = isMulti ? map : mapRef.current;
    const newArea = { ...chosenArea };

    if (toggle && newArea.preFillColor) {
      const isPreFillColorFromJSON = chosenMap.areas.find(
        c => c[areaKeyName] === area[areaKeyName]
      );

      if (isPreFillColorFromJSON?.preFillColor) delete newArea.preFillColor;
    } else {
      newArea.preFillColor = extendedArea.fillColor;
    }

    const areas = chosenMap.areas.map(cur =>
      cur[areaKeyName] === area[areaKeyName] ? newArea : cur
    );

    onChange(newArea, areas);
  };

  const initCanvas = useCallback(
    (isFirstTime = true, triggerOnLoad = false) => {
      const { width: imageWidth, height: imageHeight } = getDimensions({ img, ...dimensionParams });

      if (!(img.current && canvas.current && containerRef.current && ctx.current)) return;

      containerRef.current.style.width = `${imageWidth}px`;
      containerRef.current.style.height = `${imageHeight}px`;

      if (isFirstTime) {
        initCanvas(false, true);
      } else {
        img.current.width = imageWidth;
        img.current.height = imageHeight;

        canvas.current.width = imageWidth;
        canvas.current.height = imageHeight;

        renderPrefilledAreas();
      }

      if (onLoad && triggerOnLoad) {
        onLoad(img.current, { width: imageWidth, height: imageHeight });
      }
    },
    [dimensionParams, onLoad, renderPrefilledAreas]
  );

  useEffect(() => {
    if (isRendered) initCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRendered]);

  useEffect(() => {
    if (responsive && parentWidth) {
      if (prevParentWidth.current !== parentWidth) {
        initCanvas();
        prevParentWidth.current = parentWidth;
      }
    }
  }, [responsive, parentWidth, initCanvas]);

  useImperativeHandle(
    ref,
    () => ({
      clearHighlightedArea: () => resetCanvasAndPrefillArea(),
      getRefs: () => ({
        containerRef: containerRef.current,
        imgRef: img.current,
        canvasRef: canvas.current,
      }),
    }),
    [resetCanvasAndPrefillArea]
  );

  const handleMouseEnter = (area: MapArea): void => {
    if (active) highlightArea(area);
  };

  const handleMouseLeave = (): void => {
    if (active) resetCanvasAndPrefillArea();
  };

  const handleClick = (area: MapArea): void => {
    onHighlightArea(area);
  };

  const renderAreas = (): ReactNode =>
    map.areas.map((area, index) => {
      const { scaledCoords } = getExtendedArea(area, { img, ...scaleCoordsParams }, areaParams);

      if (area.disabled) return null;

      const { preFillColor, shape, href } = area;

      return (
        <area
          {...(preFillColor ? { className: 'img-mapper-area-highlighted' } : {})}
          key={area[areaKeyName] ?? index.toString()}
          shape={shape}
          coords={scaledCoords.join(',')}
          onMouseEnter={mouseEnter({ area, index }, { onMouseEnter, cb: handleMouseEnter })}
          onMouseLeave={mouseLeave({ area, index }, { onMouseLeave, cb: handleMouseLeave })}
          onMouseMove={mouseMove({ area, index }, { onMouseMove })}
          onMouseDown={mouseDown({ area, index }, { onMouseDown })}
          onMouseUp={mouseUp({ area, index }, { onMouseUp })}
          onTouchStart={touchStart({ area, index }, { onTouchStart })}
          onTouchEnd={touchEnd({ area, index }, { onTouchEnd })}
          onClick={click({ area, index }, { onClick, cb: handleClick })}
          href={href}
          alt="map"
        />
      );
    });

  return (
    <div ref={containerRef} id="img-mapper" style={styles.container}>
      <img
        ref={img}
        role="presentation"
        className="img-mapper-img"
        style={{ ...styles.img(responsive), ...(!isRendered ? { display: 'none' } : null) }}
        src={src}
        useMap={`#${map.name}`}
        alt="map"
        onClick={imageClick({ onImageClick })}
        onMouseMove={imageMouseMove({ onImageMouseMove })}
      />
      <canvas ref={canvas} className="img-mapper-canvas" style={styles.canvas} />
      <map className="img-mapper-map" name={map.name} style={styles.map(onClick)}>
        {isRendered && !disabled && renderAreas()}
      </map>
    </div>
  );
});

ImageMapper.displayName = 'ImageMapperForwarded';

const ImageMapperRequired = forwardRef<RefProperties, ImageMapperProps>((props, ref) => (
  <ImageMapper ref={ref} {...generateProps(props)} />
));

ImageMapperRequired.displayName = 'ImageMapperRequiredForwarded';

export default memo(ImageMapperRequired, (prevProps, nextProps) => {
  const propChanged = rerenderPropsList.some(prop => prevProps[prop] !== nextProps[prop]);

  return isEqual(prevProps.map, nextProps.map) && !propChanged;
});
