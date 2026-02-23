import React, { useState } from 'react';
import {
  Eye, EyeOff, Trash2, Copy, ChevronUp, ChevronDown,
  Plus, Layers, Lock, Unlock, MoreVertical
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { base64ToUrl } from '../../utils/imageUtils';
import clsx from 'clsx';

function LayerPanel() {
  const {
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    updateLayer,
    removeLayer,
    reorderLayers
  } = useEditorStore();

  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);

  const sortedLayers = [...layers].sort((a, b) => b.order - a.order);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDropTargetIndex(index);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const items = [...sortedLayers];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(index, 0, draggedItem);

    // Update order for all items
    items.forEach((item, i) => {
      updateLayer(item.id, { order: items.length - 1 - i });
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleAddLayer = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      type: 'image',
      image_base64: '',
      visible: true,
      opacity: 1,
      blend_mode: 'normal',
      order: layers.length
    };
    addLayer(newLayer);
  };

  const handleDuplicate = (layer) => {
    const newLayer = {
      ...layer,
      id: `layer-${Date.now()}`,
      name: `${layer.name} (Copy)`,
      order: layers.length
    };
    addLayer(newLayer);
  };

  const handleMoveUp = (index) => {
    if (index > 0) {
      // Swap order values between current and previous layer
      const currentLayer = sortedLayers[index];
      const previousLayer = sortedLayers[index - 1];
      const currentOrder = currentLayer.order;
      const previousOrder = previousLayer.order;
      updateLayer(currentLayer.id, { order: previousOrder });
      updateLayer(previousLayer.id, { order: currentOrder });
    }
  };

  const handleMoveDown = (index) => {
    if (index < sortedLayers.length - 1) {
      // Swap order values between current and next layer
      const currentLayer = sortedLayers[index];
      const nextLayer = sortedLayers[index + 1];
      const currentOrder = currentLayer.order;
      const nextOrder = nextLayer.order;
      updateLayer(currentLayer.id, { order: nextOrder });
      updateLayer(nextLayer.id, { order: currentOrder });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-editor-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-gray-400" />
          <span className="font-medium text-sm">Layers</span>
          <span className="text-xs text-gray-500">({layers.length})</span>
        </div>
        <button
          onClick={handleAddLayer}
          className="p-1.5 hover:bg-editor-hover rounded transition-colors"
          title="Add Layer"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedLayers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <p>No layers yet</p>
            <p className="text-xs mt-1">Generate or upload an image</p>
          </div>
        ) : (
          sortedLayers.map((layer, index) => (
            <div
              key={layer.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => setActiveLayerId(layer.id)}
              className={clsx(
                'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors group',
                activeLayerId === layer.id
                  ? 'bg-editor-accent/20 border border-editor-accent'
                  : 'hover:bg-editor-hover border border-transparent',
                draggedIndex === index && 'opacity-50',
                dropTargetIndex === index && draggedIndex !== null && 'border-2 border-dashed border-editor-accent'
              )}
            >
              {/* Thumbnail */}
              <div className="w-10 h-10 bg-editor-bg rounded overflow-hidden flex-shrink-0">
                {layer.image_base64 ? (
                  <img
                    src={base64ToUrl(layer.image_base64)}
                    alt={layer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600">
                    <Layers size={16} />
                  </div>
                )}
              </div>

              {/* Layer Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{layer.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {layer.type} • {Math.round(layer.opacity * 100)}%
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveUp(index);
                  }}
                  disabled={index === 0}
                  className="p-1 hover:bg-editor-border rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move Up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveDown(index);
                  }}
                  disabled={index === sortedLayers.length - 1}
                  className="p-1 hover:bg-editor-border rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move Down"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(layer.id, { visible: !layer.visible });
                  }}
                  className="p-1 hover:bg-editor-border rounded"
                  title={layer.visible ? 'Hide' : 'Show'}
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate(layer);
                  }}
                  className="p-1 hover:bg-editor-border rounded"
                  title="Duplicate"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                  className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Layer Properties */}
      {activeLayerId && (
        <div className="p-3 border-t border-editor-border">
          <div className="mb-3">
            <label className="label">Opacity</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="100"
                value={(layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100}
                onChange={(e) => updateLayer(activeLayerId, { opacity: e.target.value / 100 })}
                className="flex-1"
              />
              <span className="text-sm text-gray-400 w-10 text-right">
                {Math.round((layers.find(l => l.id === activeLayerId)?.opacity || 1) * 100)}%
              </span>
            </div>
          </div>

          <div>
            <label className="label">Blend Mode</label>
            <select
              value={layers.find(l => l.id === activeLayerId)?.blend_mode || 'normal'}
              onChange={(e) => updateLayer(activeLayerId, { blend_mode: e.target.value })}
              className="select-field text-sm"
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="darken">Darken</option>
              <option value="lighten">Lighten</option>
              <option value="color-dodge">Color Dodge</option>
              <option value="color-burn">Color Burn</option>
              <option value="hard-light">Hard Light</option>
              <option value="soft-light">Soft Light</option>
              <option value="difference">Difference</option>
              <option value="exclusion">Exclusion</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default LayerPanel;
