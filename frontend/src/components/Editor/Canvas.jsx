import { useRef, useEffect, useState, useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { base64ToUrl } from '../../utils/imageUtils';
import clsx from 'clsx';

function Canvas() {
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  const {
    layers,
    activeLayerId,
    setActiveLayerId,
    zoom,
    panOffset,
    setPanOffset,
    activeTool,
    addLayer,
    updateLayer,
    initializeCanvas
  } = useEditorStore();

  // Initialize blank canvas on mount
  useEffect(() => {
    initializeCanvas(1024, 1024);
  }, [initializeCanvas]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ width: 1024, height: 1024 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [lastPoint, setLastPoint] = useState(null);

  // Get visible layers
  const visibleLayers = layers.filter(l => l.visible).sort((a, b) => a.order - b.order);

  // Helper to get canvas coordinates from mouse event
  // Uses overlay canvas bounding rect which accounts for CSS transforms
  const getCanvasCoords = (e) => {
    const overlay = overlayRef.current;
    if (!overlay) {
      // Fallback if overlay not ready
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - panOffset.x) / zoom,
        y: (e.clientY - rect.top - panOffset.y) / zoom
      };
    }

    // Get the overlay's bounding rect (accounts for all CSS transforms)
    const rect = overlay.getBoundingClientRect();

    // Convert screen coordinates to canvas coordinates
    // rect.width/height is the display size (after transforms)
    // overlay.width/height is the drawing surface size
    const scaleX = overlay.width / rect.width;
    const scaleY = overlay.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  // Handle panning, selection and drawing
  const handleMouseDown = (e) => {
    // Panning with move tool or middle mouse button
    if (activeTool === 'move' || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      return;
    }

    // Select tool - find and select layer at click position
    if (activeTool === 'select' && e.button === 0) {
      const coords = getCanvasCoords(e);
      // Check if click is within canvas bounds
      if (coords.x >= 0 && coords.x <= canvasSize.width && coords.y >= 0 && coords.y <= canvasSize.height) {
        // Find the topmost visible layer (layers are sorted by order, last one is on top)
        const clickedLayer = [...visibleLayers].reverse().find(layer => {
          // For simplicity, select any visible layer in bounds
          // A more sophisticated approach would check pixel-level hit testing
          return layer.visible;
        });
        if (clickedLayer) {
          setActiveLayerId(clickedLayer.id);
        }
      }
      return;
    }

    // Drawing tools
    if (['brush', 'eraser', 'rectangle', 'ellipse'].includes(activeTool) && e.button === 0) {
      const { x, y } = getCanvasCoords(e);
      setIsDrawing(true);
      setStartPoint({ x, y });
      setLastPoint({ x, y });

      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        // For eraser: load active layer content onto overlay first
        if (activeTool === 'eraser') {
          const activeLayer = layers.find(l => l.id === activeLayerId);
          if (activeLayer && activeLayer.image_base64) {
            setIsErasing(true);
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0);
            };
            img.src = base64ToUrl(activeLayer.image_base64);
          }
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }

    if (!isDrawing || !['brush', 'eraser', 'rectangle', 'ellipse'].includes(activeTool)) return;

    const { x, y } = getCanvasCoords(e);

    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.globalCompositeOperation = activeTool === 'eraser' ? 'destination-out' : 'source-over';

    if (activeTool === 'brush' || activeTool === 'eraser') {
      if (lastPoint) {
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        setLastPoint({ x, y });
      }
    } else if (activeTool === 'rectangle') {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      const width = x - startPoint.x;
      const height = y - startPoint.y;
      ctx.strokeRect(startPoint.x, startPoint.y, width, height);
    } else if (activeTool === 'ellipse') {
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.beginPath();
      ctx.ellipse(
        (startPoint.x + x) / 2,
        (startPoint.y + y) / 2,
        Math.abs(x - startPoint.x) / 2,
        Math.abs(y - startPoint.y) / 2,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (isDrawing && ['brush', 'eraser', 'rectangle', 'ellipse'].includes(activeTool)) {
      commitDrawing();
    }
    setIsDrawing(false);
    setIsErasing(false);
    setStartPoint(null);
    setLastPoint(null);
  };

  // Handle wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
      useEditorStore.getState().setZoom(newZoom);
    }
  };

  // Update canvas size based on active layer
  useEffect(() => {
    const activeLayer = layers.find(l => l.id === activeLayerId);
    if (activeLayer && activeLayer.image_base64) {
      const img = new Image();
      img.onload = () => {
        setCanvasSize({ width: img.width, height: img.height });
      };
      img.src = base64ToUrl(activeLayer.image_base64);
    }
  }, [activeLayerId, layers]);

  // Sync overlay canvas size
  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.width = canvasSize.width;
      overlay.height = canvasSize.height;
    }
  }, [canvasSize]);

  const commitDrawing = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    const data = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    const hasPixels = data.some(v => v !== 0);
    if (!hasPixels && !isErasing) return;

    const base64 = overlay.toDataURL('image/png').split(',')[1];

    // For eraser: update the active layer instead of creating new
    if (isErasing && activeLayerId) {
      updateLayer(activeLayerId, { image_base64: base64 });
    } else {
      addLayer({
        id: `layer-${Date.now()}`,
        name: `Sketch (${activeTool})`,
        type: 'image',
        image_base64: base64,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });
    }

    ctx.clearRect(0, 0, overlay.width, overlay.height);
  }, [isErasing, activeLayerId, activeTool, layers.length, addLayer, updateLayer]);

  return (
    <div
      ref={containerRef}
      className="flex-1 canvas-container overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        className="relative"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: 'top left',
          width: canvasSize.width,
          height: canvasSize.height,
        }}
      >
        {/* Canvas Background */}
        <div
          className="absolute inset-0 bg-white rounded shadow-2xl"
          style={{
            width: canvasSize.width,
            height: canvasSize.height,
          }}
        />

        {/* Render Layers */}
        {visibleLayers.map((layer) => (
          <div
            key={layer.id}
            className={clsx(
              'absolute inset-0 cursor-pointer transition-opacity',
              layer.id === activeLayerId && 'ring-2 ring-editor-accent ring-offset-2 ring-offset-transparent'
            )}
            style={{
              opacity: layer.opacity,
              mixBlendMode: layer.blend_mode || 'normal',
            }}
            onClick={() => setActiveLayerId(layer.id)}
          >
            {layer.image_base64 && (
              <img
                src={base64ToUrl(layer.image_base64)}
                alt={layer.name}
                className="w-full h-full object-contain pointer-events-none"
                draggable={false}
              />
            )}
          </div>
        ))}

        {/* Drawing overlay */}
        <canvas
          ref={overlayRef}
          className="absolute inset-0"
          style={{ pointerEvents: isDrawing || ['brush', 'eraser', 'rectangle', 'ellipse'].includes(activeTool) ? 'auto' : 'none' }}
        />

        {/* Empty State */}
        {visibleLayers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-lg mb-2">No images yet</p>
              <p className="text-sm">Generate or upload an image to get started</p>
            </div>
          </div>
        )}
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 left-4 bg-editor-panel/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm text-gray-400">
        {Math.round(zoom * 100)}%
      </div>

      {/* Canvas info */}
      {canvasSize.width > 0 && (
        <div className="absolute bottom-4 left-20 bg-editor-panel/80 backdrop-blur px-3 py-1.5 rounded-lg text-sm text-gray-400">
          {canvasSize.width} × {canvasSize.height}
        </div>
      )}
    </div>
  );
}

export default Canvas;
