import React, { useState } from 'react';
import { Sparkles, History, Star, ChevronDown, Plus, Square } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { useStyleStore } from '../../stores/styleStore';
import clsx from 'clsx';

// Predefined canvas sizes
const CANVAS_SIZES = [
  { label: '512 x 512', width: 512, height: 512 },
  { label: '1024 x 1024', width: 1024, height: 1024 },
  { label: '1920 x 1080 (HD)', width: 1920, height: 1080 },
  { label: '1080 x 1920 (Portrait)', width: 1080, height: 1920 },
  { label: '1280 x 720', width: 1280, height: 720 },
  { label: '800 x 600', width: 800, height: 600 },
];

const CANVAS_COLORS = [
  { label: 'White', color: '#ffffff' },
  { label: 'Black', color: '#000000' },
  { label: 'Transparent', color: 'transparent' },
  { label: 'Gray', color: '#808080' },
  { label: 'Light Gray', color: '#d3d3d3' },
];

function GenerationPanel() {
  const [prompt, setPrompt] = useState('');
  const [showStyles, setShowStyles] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showNewCanvas, setShowNewCanvas] = useState(false);
  const [canvasSize, setCanvasSize] = useState(CANVAS_SIZES[1]);
  const [canvasColor, setCanvasColor] = useState(CANVAS_COLORS[0]);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');

  const { generateImage } = useGeminiApi();
  const { addLayer, layers } = useEditorStore();
  const {
    styles,
    styleCategories,
    selectedStyleId,
    setSelectedStyleId,
    promptHistory,
    addToPromptHistory,
    favoritePrompts,
    addFavoritePrompt
  } = useStyleStore();

  const selectedStyle = styles.find(s => s.id === selectedStyleId);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    try {
      addToPromptHistory(prompt);
      const result = await generateImage(prompt, selectedStyleId);

      if (result.success && result.image_base64) {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Generated: ${prompt.substring(0, 20)}...`,
          type: 'generated',
          image_base64: result.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      }
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const createNewCanvas = () => {
    const width = customWidth ? parseInt(customWidth) : canvasSize.width;
    const height = customHeight ? parseInt(customHeight) : canvasSize.height;

    if (width < 1 || height < 1 || width > 4096 || height > 4096) {
      alert('Canvas size must be between 1 and 4096 pixels');
      return;
    }

    // Create canvas and fill with color
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (canvasColor.color === 'transparent') {
      // Leave transparent (default)
      ctx.clearRect(0, 0, width, height);
    } else {
      ctx.fillStyle = canvasColor.color;
      ctx.fillRect(0, 0, width, height);
    }

    const base64 = canvas.toDataURL('image/png').split(',')[1];

    addLayer({
      id: `layer-${Date.now()}`,
      name: `New Canvas (${width}x${height})`,
      type: 'image',
      image_base64: base64,
      visible: true,
      opacity: 1,
      blend_mode: 'normal',
      order: layers.length
    });

    setShowNewCanvas(false);
  };

  const stylesByCategory = styleCategories.reduce((acc, cat) => {
    acc[cat] = styles.filter(s => s.category === cat);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Generate Image</h2>
        </div>
        <p className="text-xs text-gray-500">
          Create images from text descriptions
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* New Canvas Section */}
        <div>
          <button
            onClick={() => setShowNewCanvas(!showNewCanvas)}
            className="w-full flex items-center justify-between p-3 bg-editor-accent/10 border border-editor-accent/30 rounded-lg hover:bg-editor-accent/20 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-editor-accent" />
              <span className="text-sm font-medium">Create New Canvas</span>
            </div>
            <ChevronDown size={16} className={clsx('transition-transform text-editor-accent', showNewCanvas && 'rotate-180')} />
          </button>

          {showNewCanvas && (
            <div className="mt-2 bg-editor-bg rounded-lg p-3 space-y-3">
              {/* Size Presets */}
              <div>
                <label className="label">Size Preset</label>
                <div className="grid grid-cols-2 gap-1">
                  {CANVAS_SIZES.map((size) => (
                    <button
                      key={size.label}
                      onClick={() => {
                        setCanvasSize(size);
                        setCustomWidth('');
                        setCustomHeight('');
                      }}
                      className={clsx(
                        'p-2 text-xs rounded transition-colors',
                        canvasSize.label === size.label && !customWidth
                          ? 'bg-editor-accent text-white'
                          : 'bg-editor-panel hover:bg-editor-hover'
                      )}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Size */}
              <div>
                <label className="label">Custom Size</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(e.target.value)}
                    placeholder="Width"
                    className="input-field flex-1 text-sm"
                    min="1"
                    max="4096"
                  />
                  <span className="text-gray-500">×</span>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(e.target.value)}
                    placeholder="Height"
                    className="input-field flex-1 text-sm"
                    min="1"
                    max="4096"
                  />
                </div>
              </div>

              {/* Background Color */}
              <div>
                <label className="label">Background</label>
                <div className="flex gap-1">
                  {CANVAS_COLORS.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => setCanvasColor(c)}
                      className={clsx(
                        'w-8 h-8 rounded border-2 transition-colors',
                        canvasColor.label === c.label
                          ? 'border-editor-accent'
                          : 'border-transparent hover:border-gray-500'
                      )}
                      style={{
                        backgroundColor: c.color === 'transparent' ? 'transparent' : c.color,
                        backgroundImage: c.color === 'transparent'
                          ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                          : 'none',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                      }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={createNewCanvas}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Square size={16} />
                Create Canvas
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-editor-border pt-4">
          <p className="text-xs text-gray-500 mb-3">Or generate with AI:</p>
        </div>

        {/* Prompt Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label">Prompt</label>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1 hover:bg-editor-hover rounded text-gray-400"
                title="History"
              >
                <History size={14} />
              </button>
              <button
                onClick={() => prompt && addFavoritePrompt(prompt)}
                className="p-1 hover:bg-editor-hover rounded text-gray-400"
                title="Save as favorite"
              >
                <Star size={14} />
              </button>
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to create..."
            className="input-field h-28 resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleGenerate();
              }
            }}
          />
          <p className="text-xs text-gray-500 mt-1">
            Press Ctrl+Enter to generate
          </p>
        </div>

        {/* Prompt History */}
        {showHistory && promptHistory.length > 0 && (
          <div className="bg-editor-bg rounded-lg p-2 max-h-40 overflow-y-auto">
            <p className="text-xs text-gray-500 mb-2">Recent Prompts</p>
            {promptHistory.slice(0, 10).map((p, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(p);
                  setShowHistory(false);
                }}
                className="w-full text-left text-sm p-2 hover:bg-editor-hover rounded truncate"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Style Selection */}
        <div>
          <button
            onClick={() => setShowStyles(!showStyles)}
            className="w-full flex items-center justify-between p-3 bg-editor-bg rounded-lg hover:bg-editor-hover transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Style</span>
              {selectedStyle && (
                <span className="text-xs text-editor-accent">
                  {selectedStyle.name}
                </span>
              )}
            </div>
            <ChevronDown size={16} className={clsx('transition-transform', showStyles && 'rotate-180')} />
          </button>

          {showStyles && (
            <div className="mt-2 bg-editor-bg rounded-lg p-3 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedStyleId(null);
                  setShowStyles(false);
                }}
                className={clsx(
                  'w-full text-left p-2 rounded text-sm',
                  !selectedStyleId ? 'bg-editor-accent/20 text-editor-accent' : 'hover:bg-editor-hover'
                )}
              >
                No Style (Default)
              </button>

              {Object.entries(stylesByCategory).map(([category, categoryStyles]) => (
                <div key={category} className="mt-3">
                  <p className="text-xs text-gray-500 uppercase mb-2">{category}</p>
                  <div className="space-y-1">
                    {categoryStyles.map((style) => (
                      <button
                        key={style.id}
                        onClick={() => {
                          setSelectedStyleId(style.id);
                          setShowStyles(false);
                        }}
                        className={clsx(
                          'w-full text-left p-2 rounded text-sm',
                          selectedStyleId === style.id
                            ? 'bg-editor-accent/20 text-editor-accent'
                            : 'hover:bg-editor-hover'
                        )}
                      >
                        <p className="font-medium">{style.name}</p>
                        <p className="text-xs text-gray-500 truncate">{style.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Style Tags */}
        <div>
          <label className="label">Quick Styles</label>
          <div className="flex flex-wrap gap-1">
            {['cinematic-film', 'anime-manga', 'oil-painting', 'cyberpunk', 'pixel-art', '3d-render'].map((styleId) => {
              const style = styles.find(s => s.id === styleId);
              if (!style) return null;
              return (
                <button
                  key={styleId}
                  onClick={() => setSelectedStyleId(selectedStyleId === styleId ? null : styleId)}
                  className={clsx(
                    'px-2 py-1 text-xs rounded transition-colors',
                    selectedStyleId === styleId
                      ? 'bg-editor-accent text-white'
                      : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                  )}
                >
                  {style.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Example Prompts */}
        <div>
          <label className="label">Example Prompts</label>
          <div className="space-y-2">
            {[
              'A majestic lion standing on a cliff at golden hour, photorealistic',
              'Cozy coffee shop interior with warm lighting, anime style',
              'Futuristic cityscape with flying cars, neon lights, cyberpunk',
              'Cute robot gardening in a greenhouse, digital art'
            ].map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                className="w-full text-left p-2 bg-editor-bg hover:bg-editor-hover rounded text-sm text-gray-400 hover:text-white transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <div className="p-4 border-t border-editor-border">
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          Generate Image
        </button>
      </div>
    </div>
  );
}

export default GenerationPanel;
