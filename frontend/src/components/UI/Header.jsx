import React, { useState } from 'react';
import { Menu, Save, Download, Upload, Link, Undo, Redo, ZoomIn, ZoomOut, Settings } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useSessionStore } from '../../stores/sessionStore';
import ModelSelector from './ModelSelector';

function Header() {
  const { openModal, undo, redo, zoom, setZoom, layers } = useEditorStore();
  const { selectedModel, setSelectedModel } = useSessionStore();
  const [showSettings, setShowSettings] = useState(false);

  const handleSave = () => {
    // Export project as JSON
    const projectData = {
      layers,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    // Get all visible layers sorted by order (lowest first = bottom layer)
    const visibleLayers = layers
      .filter(l => l.visible && l.image_base64)
      .sort((a, b) => a.order - b.order);

    if (visibleLayers.length === 0) return;

    // Create a canvas to composite all layers
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Load first image to get dimensions
    const firstImg = new Image();
    await new Promise((resolve) => {
      firstImg.onload = resolve;
      firstImg.src = `data:image/png;base64,${visibleLayers[0].image_base64}`;
    });

    canvas.width = firstImg.width;
    canvas.height = firstImg.height;

    // Draw each layer from bottom to top
    for (const layer of visibleLayers) {
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = `data:image/png;base64,${layer.image_base64}`;
      });

      ctx.globalAlpha = layer.opacity ?? 1;
      ctx.globalCompositeOperation = layer.blend_mode === 'normal' ? 'source-over' : layer.blend_mode;
      ctx.drawImage(img, 0, 0);
    }

    // Reset context state
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Export as PNG
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  return (
    <header className="h-12 bg-editor-panel border-b border-editor-border flex items-center justify-between px-4">
      {/* Left section - Logo and menu */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="font-semibold text-white">Gemini Editor</span>
        </div>

        {/* File actions */}
        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => openModal('upload')}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Upload Image"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <button
            onClick={() => openModal('url-import')}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Import from URL"
          >
            <Link size={16} />
            <span className="hidden sm:inline">URL</span>
          </button>
          <button
            onClick={handleSave}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Save Project"
          >
            <Save size={16} />
            <span className="hidden sm:inline">Save</span>
          </button>
          <button
            onClick={handleExport}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Export Image"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Center section - History and zoom */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button onClick={undo} className="btn-ghost p-2" title="Undo (Ctrl+Z)">
            <Undo size={18} />
          </button>
          <button onClick={redo} className="btn-ghost p-2" title="Redo (Ctrl+Y)">
            <Redo size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-editor-border" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            className="btn-ghost p-2"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-sm text-gray-400 w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            className="btn-ghost p-2"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      {/* Right section - Model selector and settings */}
      <div className="flex items-center gap-4">
        <ModelSelector />

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn-ghost p-2"
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="dropdown-menu top-12 right-4">
          <div className="px-4 py-2 text-xs text-gray-500 uppercase">Settings</div>
          <div className="dropdown-item">Dark Mode (Always On)</div>
          <div className="dropdown-item">Keyboard Shortcuts</div>
          <div className="dropdown-item">About</div>
        </div>
      )}
    </header>
  );
}

export default Header;
