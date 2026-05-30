import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from 'react-konva';
import { Hand, Maximize, MousePointer2, Move, Redo2, Undo2, ZoomIn } from 'lucide-react';
import { resizeInteraction } from './resizeSnap.js';

const HANDLE_SIZE = 16;
const HANDLE_OFFSET = HANDLE_SIZE / 2;

function useLoadedImage(src) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!src) {
      setImage(null);
      return undefined;
    }
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.src = src;
    return () => {
      next.onload = null;
    };
  }, [src]);
  return image;
}

function cellFrame(cell, frame) {
  const x = frame.gap + cell.col * (frame.unitW + frame.gap);
  const y = frame.gap + cell.row * (frame.unitH + frame.gap);
  const width = cell.colSpan * frame.unitW + (cell.colSpan - 1) * frame.gap;
  const height = cell.rowSpan * frame.unitH + (cell.rowSpan - 1) * frame.gap;
  return { x, y, width, height };
}

function CellNode({
  cell,
  frame,
  image,
  selected,
  snapEnabled,
  toolMode,
  onClick,
  onResize,
  onResizeEnd,
  onImageDrop,
  onMoveCellBlock,
  onClearImage,
}) {
  const loaded = useLoadedImage(image?.thumb);
  const { x, y, width, height } = cellFrame(cell, frame);
  const cornerRadius = Math.min(frame.radius, width / 2, height / 2);
  const imageRef = useRef(null);
  const strokeRectRef = useRef(null);

  const handleMouseEnter = (event) => {
    event.target.getStage().container().style.cursor = toolMode === 'cell' || image ? 'grab' : 'pointer';
    if (imageRef.current && loaded) {
      imageRef.current.to({
        scaleX: 1.025,
        scaleY: 1.025,
        x: -(width * 0.025) / 2,
        y: -(height * 0.025) / 2,
        duration: 0.22,
        easing: Konva.Easings.EaseOut,
      });
    }
    if (strokeRectRef.current) {
      strokeRectRef.current.to({
        stroke: selected ? '#f2cd78' : 'rgba(162, 185, 161, 0.8)',
        strokeWidth: selected ? 3 : 2,
        duration: 0.2,
      });
    }
  };

  const handleMouseLeave = (event) => {
    event.target.getStage().container().style.cursor = 'default';
    if (imageRef.current) {
      imageRef.current.to({
        scaleX: 1,
        scaleY: 1,
        x: 0,
        y: 0,
        duration: 0.22,
        easing: Konva.Easings.EaseOut,
      });
    }
    if (strokeRectRef.current) {
      strokeRectRef.current.to({
        stroke: selected ? '#f2cd78' : 'rgba(255, 255, 255, 0.62)',
        strokeWidth: selected ? 3 : 1,
        duration: 0.2,
      });
    }
  };

  return (
    <Group
      x={x}
      y={y}
      draggable={(toolMode === 'select' && Boolean(image)) || toolMode === 'cell'}
      onClick={onClick}
      onTap={onClick}
      onDragStart={event => {
        event.cancelBubble = true;
        event.target.opacity(0.72);
        event.target.moveToTop();
        event.target.getStage().container().style.cursor = 'grabbing';
      }}
      onDragEnd={event => {
        event.cancelBubble = true;
        const pointer = event.target.getStage()?.getPointerPosition();
        const droppedX = event.target.x();
        const droppedY = event.target.y();
        event.target.opacity(1);
        event.target.position({ x, y });
        event.target.getStage().container().style.cursor = 'grab';
        event.target.getLayer()?.batchDraw();
        if (toolMode === 'cell') {
          const nextCol = Math.round((droppedX - frame.gap) / (frame.unitW + frame.gap));
          const nextRow = Math.round((droppedY - frame.gap) / (frame.unitH + frame.gap));
          onMoveCellBlock?.(cell.id, { row: nextRow, col: nextCol });
          return;
        }
        onImageDrop?.(cell.id, pointer);
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Rect
        width={width}
        height={height}
        fill="#1f232a"
        cornerRadius={cornerRadius}
        stroke={selected ? '#f2cd78' : '#ffffff'}
        strokeWidth={selected ? 3 : 1}
        opacity={selected ? 1 : 0.9}
        shadowColor={selected ? '#f2cd78' : '#000000'}
        shadowBlur={selected ? 18 : 4}
        shadowOpacity={selected ? 0.24 : 0.16}
      />
      {/* Clipped image area */}
      <Group clipFunc={(ctx) => {
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(0, 0, width, height, cornerRadius);
        } else {
          ctx.rect(0, 0, width, height);
        }
        ctx.closePath();
      }}>
        {loaded && image ? (
          <KonvaImage
            ref={imageRef}
            image={loaded}
            x={0}
            y={0}
            width={width}
            height={height}
            opacity={0.96}
            crop={coverCrop(loaded, width, height, image.cropX ?? 0.5, image.cropY ?? 0.5)}
            cornerRadius={cornerRadius}
          />
        ) : (
          <Text
            text={image ? '로드 중' : '빈 칸'}
            width={width}
            height={height}
            align="center"
            verticalAlign="middle"
            fill="#77736a"
            fontSize={13}
            fontFamily="Segoe UI"
          />
        )}

        {/* Rule of Thirds composition overlay when selected */}
        {selected && image ? (
          <Group opacity={0.35}>
            {/* Horizontal Gridlines */}
            <Line points={[0, height / 3, width, height / 3]} stroke="#ffffff" strokeWidth={1} dash={[3, 3]} />
            <Line points={[0, (2 * height) / 3, width, (2 * height) / 3]} stroke="#ffffff" strokeWidth={1} dash={[3, 3]} />
            {/* Vertical Gridlines */}
            <Line points={[width / 3, 0, width / 3, height]} stroke="#ffffff" strokeWidth={1} dash={[3, 3]} />
            <Line points={[(2 * width) / 3, 0, (2 * width) / 3, height]} stroke="#ffffff" strokeWidth={1} dash={[3, 3]} />
          </Group>
        ) : null}
      </Group>

      <Rect
        ref={strokeRectRef}
        width={width}
        height={height}
        cornerRadius={cornerRadius}
        stroke={selected ? '#f2cd78' : 'rgba(255,255,255,0.62)'}
        strokeWidth={selected ? 3 : 1}
      />
      {selected ? (
        <>
          {image ? (
            <Group
              x={Math.max(8, width - 34)}
              y={8}
              onClick={event => {
                event.cancelBubble = true;
                onClearImage?.(cell.id);
              }}
              onTap={event => {
                event.cancelBubble = true;
                onClearImage?.(cell.id);
              }}
            >
              <Rect
                width={26}
                height={26}
                fill="rgba(12,14,14,0.82)"
                stroke="rgba(246,217,141,0.7)"
                strokeWidth={1}
                cornerRadius={13}
              />
              <Text
                text="X"
                width={26}
                height={26}
                align="center"
                verticalAlign="middle"
                fill="#f6d98d"
                fontSize={12}
                fontStyle="bold"
                fontFamily="Segoe UI"
              />
            </Group>
          ) : null}
          <Handle x={0} y={0} corner="top-left" cell={cell} frame={frame} snapEnabled={snapEnabled} onResize={onResize} onResizeEnd={onResizeEnd} />
          <Handle x={width} y={0} corner="top-right" cell={cell} frame={frame} snapEnabled={snapEnabled} onResize={onResize} onResizeEnd={onResizeEnd} />
          <Handle x={0} y={height} corner="bottom-left" cell={cell} frame={frame} snapEnabled={snapEnabled} onResize={onResize} onResizeEnd={onResizeEnd} />
          <Handle x={width} y={height} corner="bottom-right" cell={cell} frame={frame} snapEnabled={snapEnabled} onResize={onResize} onResizeEnd={onResizeEnd} />
        </>
      ) : null}
    </Group>
  );
}

function Handle({ x, y, corner, cell, frame, snapEnabled, onResize, onResizeEnd }) {
  const latestRect = useRef({
    row: cell.row,
    col: cell.col,
    rowSpan: cell.rowSpan,
    colSpan: cell.colSpan,
  });

  function snapHandle(event) {
    event.cancelBubble = true;
    const pointer = {
      x: event.target.x() + HANDLE_OFFSET,
      y: event.target.y() + HANDLE_OFFSET,
    };
    const interaction = resizeInteraction(cell, corner, pointer, frame, snapEnabled);
    latestRect.current = interaction.rect;
    onResize?.(cell.id, interaction.rect, { corner, snapEnabled });
    event.target.position({
      x: interaction.handleCenter.x - HANDLE_OFFSET,
      y: interaction.handleCenter.y - HANDLE_OFFSET,
    });
    event.target.getLayer()?.batchDraw();
    return interaction.rect;
  }

  return (
    <Rect
      x={x - HANDLE_OFFSET}
      y={y - HANDLE_OFFSET}
      width={HANDLE_SIZE}
      height={HANDLE_SIZE}
      fill="#f6d98d"
      stroke="#7b5a1c"
      strokeWidth={1}
      cornerRadius={4}
      draggable
      onDragStart={event => {
        event.cancelBubble = true;
        latestRect.current = {
          row: cell.row,
          col: cell.col,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
        };
      }}
      onDragMove={snapHandle}
      onDragEnd={event => {
        event.cancelBubble = true;
        onResizeEnd(cell.id, latestRect.current);
      }}
    />
  );
}

function coverCrop(image, width, height, focusX = 0.5, focusY = 0.5) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  if (imageRatio > targetRatio) {
    const cropWidth = image.height * targetRatio;
    const maxX = image.width - cropWidth;
    return {
      x: maxX * clamp(focusX, 0, 1),
      y: 0,
      width: cropWidth,
      height: image.height,
    };
  }
  const cropHeight = image.width / targetRatio;
  const maxY = image.height - cropHeight;
  return {
    x: 0,
    y: maxY * clamp(focusY, 0, 1),
    width: image.width,
    height: cropHeight,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export function LayoutCanvas({
  cells,
  images,
  settings,
  selectedIds,
  resizePreview,
  canUndo,
  canRedo,
  snapEnabled = true,
  onUndo,
  onRedo,
  onToggleSnap,
  onToggleCell,
  onPreviewResize,
  onResizeCell,
  onMoveCellImage,
  onMoveCellBlock,
  onClearCellImage,
}) {
  const wrapRef = useRef(null);
  const [wrapSize, setWrapSize] = useState({ width: 760, height: 720 });
  const [toolMode, setToolMode] = useState('select');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const element = wrapRef.current;
    if (!element) return undefined;
    const applySize = rect => {
      setWrapSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };
    applySize(element.getBoundingClientRect());
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      applySize(rect);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const frame = useMemo(() => {
    const maxW = Math.max(420, wrapSize.width - 80);
    const maxH = Math.max(420, wrapSize.height - 120);
    const aspect = settings.width / settings.height;
    let canvasW = maxW;
    let canvasH = canvasW / aspect;
    if (canvasH > maxH) {
      canvasH = maxH;
      canvasW = canvasH * aspect;
    }
    const scale = canvasW / settings.width;
    const gap = Math.max(0, settings.gap * scale);
    const unitW = (canvasW - (settings.cols + 1) * gap) / settings.cols;
    const unitH = (canvasH - (settings.rows + 1) * gap) / settings.rows;
    return {
      stageW: wrapSize.width,
      stageH: wrapSize.height,
      canvasW,
      canvasH,
      offsetX: (wrapSize.width - canvasW) / 2,
      offsetY: 38,
      unitW,
      unitH,
      gap,
      radius: settings.radius * scale,
      rows: settings.rows,
      cols: settings.cols,
    };
  }, [settings, wrapSize]);

  function zoomIn() {
    setZoomLevel(current => Math.min(2, Math.round((current + 0.25) * 100) / 100));
  }

  function fitView() {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setToolMode('select');
  }

  const zoomPercent = Math.round(zoomLevel * 100);
  const canvasHint = toolMode === 'pan'
    ? '손도구: 캔버스를 드래그해 작업 영역을 이동'
    : toolMode === 'cell'
      ? '셀 이동: 병합된 셀 블록을 그리드 위에서 직접 옮깁니다'
      : '셀 이미지를 드래그해 위치 교체 · Shift/Ctrl 클릭으로 여러 칸 선택';

  function cellIdAtStagePoint(point) {
    if (!point) return '';
    const localX = (point.x - frame.offsetX - panOffset.x) / zoomLevel;
    const localY = (point.y - frame.offsetY - panOffset.y) / zoomLevel;
    const target = cells.find(cell => {
      const rect = cellFrame(cell, frame);
      return localX >= rect.x
        && localX <= rect.x + rect.width
        && localY >= rect.y
        && localY <= rect.y + rect.height;
    });
    return target?.id || '';
  }

  return (
    <section className="canvas-panel">
      <div className="canvas-toolbar">
        <div className="canvas-title">
          <strong>캔버스</strong>
          <span>{settings.rows} x {settings.cols} · {settings.width} x {settings.height}px · {zoomPercent}%</span>
        </div>
        <div className="canvas-tools" aria-label="캔버스 도구">
          <button className={`tool-button${toolMode === 'select' ? ' is-active' : ''}`} onClick={() => setToolMode('select')} title="선택 도구"><MousePointer2 size={17} /></button>
          <button className={`tool-button${toolMode === 'cell' ? ' is-active' : ''}`} onClick={() => setToolMode('cell')} title="셀 이동"><Move size={17} /></button>
          <button className={`tool-button${toolMode === 'pan' ? ' is-active' : ''}`} onClick={() => setToolMode('pan')} title="손 도구"><Hand size={17} /></button>
          <button className="tool-button" onClick={zoomIn} title="확대"><ZoomIn size={17} /></button>
          <button className="tool-button" onClick={fitView} title="맞춤 보기"><Maximize size={17} /></button>
          <span className="tool-divider" />
          <button className="tool-button" onClick={onUndo} disabled={!canUndo} title="실행 취소"><Undo2 size={17} /></button>
          <button className="tool-button" onClick={onRedo} disabled={!canRedo} title="다시 실행"><Redo2 size={17} /></button>
          <button className={`snap-toggle${snapEnabled ? ' is-on' : ''}`} onClick={onToggleSnap} type="button">
            가이드 <b>{snapEnabled ? 'ON' : 'OFF'}</b>
          </button>
        </div>
      </div>
      <div className="stage-wrap" ref={wrapRef}>
        <Stage width={frame.stageW} height={frame.stageH}>
          <Layer>
            <Group
              x={frame.offsetX + panOffset.x}
              y={frame.offsetY + panOffset.y}
              scaleX={zoomLevel}
              scaleY={zoomLevel}
              draggable={toolMode === 'pan'}
              onDragEnd={event => {
                setPanOffset({
                  x: event.target.x() - frame.offsetX,
                  y: event.target.y() - frame.offsetY,
                });
              }}
            >
              <Rect
                x={-34}
                y={-22}
                width={frame.canvasW + 68}
                height={frame.canvasH + 44}
                fill="#0d0f13"
                stroke="#303641"
                dash={[4, 4]}
                cornerRadius={8}
              />
              <Rect
                width={frame.canvasW}
                height={frame.canvasH}
                fill={settings.background}
                cornerRadius={14}
                shadowColor="#000000"
                shadowBlur={34}
                shadowOpacity={0.36}
              />
              {snapEnabled && (selectedIds.length || resizePreview) ? (
                <SnapGuides frame={frame} />
              ) : null}
              {cells.map(cell => (
                <CellNode
                  key={cell.id}
                  cell={cell}
                  frame={frame}
                  image={images[cell.imageIndex]}
                  selected={selectedIds.includes(cell.id)}
                  snapEnabled={snapEnabled}
                  toolMode={toolMode}
                  onClick={event => {
                    if (toolMode !== 'select') return;
                    onToggleCell(cell.id, event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey);
                  }}
                  onResize={(cellId, nextRect) => {
                    onPreviewResize?.(cellId, nextRect);
                  }}
                  onResizeEnd={onResizeCell}
                  onImageDrop={(sourceId, point) => {
                    const targetId = cellIdAtStagePoint(point);
                    if (targetId && targetId !== sourceId) onMoveCellImage?.(sourceId, targetId);
                  }}
                  onMoveCellBlock={onMoveCellBlock}
                  onClearImage={onClearCellImage}
                />
              ))}
            </Group>
          </Layer>
        </Stage>
        {resizePreview?.rect ? (
          <div className="resize-tooltip">
            {resizePreview.rect.colSpan} x {resizePreview.rect.rowSpan} 칸
          </div>
        ) : null}
        <div className="canvas-hint">{canvasHint}</div>
      </div>
    </section>
  );
}

function SnapGuides({ frame }) {
  const vertical = Array.from({ length: frame.cols + 1 }, (_, index) => {
    const x = frame.gap + index * (frame.unitW + frame.gap) - frame.gap / 2;
    return (
      <Line
        key={`v-${index}`}
        points={[x, 0, x, frame.canvasH]}
        stroke="rgba(94, 148, 216, 0.45)"
        dash={[5, 6]}
        strokeWidth={1}
      />
    );
  });
  const horizontal = Array.from({ length: frame.rows + 1 }, (_, index) => {
    const y = frame.gap + index * (frame.unitH + frame.gap) - frame.gap / 2;
    return (
      <Line
        key={`h-${index}`}
        points={[0, y, frame.canvasW, y]}
        stroke="rgba(94, 148, 216, 0.45)"
        dash={[5, 6]}
        strokeWidth={1}
      />
    );
  });
  return <>{vertical}{horizontal}</>;
}
