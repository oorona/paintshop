import React, { useState } from 'react';
import { Palette, ChevronDown, Plus, Edit2, Trash2, Image } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { useStyleStore } from '../../stores/styleStore';
import { base64ToUrl } from '../../utils/imageUtils';
import clsx from 'clsx';

function StylesPanel() {
  const [activeTab, setActiveTab] = useState('presets');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [styleStrength, setStyleStrength] = useState(0.7);
  const [styleReferenceImage, setStyleReferenceImage] = useState(null);
  const [prompt, setPrompt] = useState('Apply the artistic style');

  const { styleTransfer, editImage } = useGeminiApi();
  const { layers, activeLayerId, addLayer } = useEditorStore();
  const { styles, styleCategories, selectedStyleId, setSelectedStyleId } = useStyleStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const selectedStyle = styles.find(s => s.id === selectedStyleId);

  const filteredStyles = selectedCategory
    ? styles.filter(s => s.category === selectedCategory)
    : styles;

  const handleApplyPresetStyle = async () => {
    if (!activeLayer?.image_base64 || !selectedStyleId) return;

    try {
      const result = await editImage(
        `Transform this image to ${selectedStyle?.prompt_template || selectedStyle?.name} style`,
        activeLayer.image_base64,
        null,
        selectedStyleId
      );

      if (result.success && result.image_base64) {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Styled: ${selectedStyle?.name}`,
          type: 'image',
          image_base64: result.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      }
    } catch (error) {
      console.error('Style application failed:', error);
    }
  };

  const handleStyleTransfer = async () => {
    if (!activeLayer?.image_base64 || !styleReferenceImage) return;

    try {
      const result = await styleTransfer(
        activeLayer.image_base64,
        styleReferenceImage,
        prompt,
        styleStrength
      );

      if (result.success && result.image_base64) {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Style Transfer`,
          type: 'image',
          image_base64: result.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      }
    } catch (error) {
      console.error('Style transfer failed:', error);
    }
  };

  const handleSelectStyleReference = () => {
    const imageLayers = layers.filter(l => l.image_base64 && l.id !== activeLayerId);
    if (imageLayers.length > 0) {
      setStyleReferenceImage(imageLayers[imageLayers.length - 1].image_base64);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Palette size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Styles</h2>
        </div>
        <p className="text-xs text-gray-500">
          Apply artistic styles to your images
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-editor-border">
        <button
          onClick={() => setActiveTab('presets')}
          className={clsx(
            'flex-1 py-2 text-sm transition-colors',
            activeTab === 'presets' ? 'tab-active' : 'tab-inactive'
          )}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('transfer')}
          className={clsx(
            'flex-1 py-2 text-sm transition-colors',
            activeTab === 'transfer' ? 'tab-active' : 'tab-inactive'
          )}
        >
          Style Transfer
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'presets' ? (
          <>
            {/* Category Filter */}
            <div>
              <label className="label">Category</label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={clsx(
                    'px-2 py-1 text-xs rounded transition-colors',
                    !selectedCategory
                      ? 'bg-editor-accent text-white'
                      : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                  )}
                >
                  All
                </button>
                {styleCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={clsx(
                      'px-2 py-1 text-xs rounded transition-colors',
                      selectedCategory === cat
                        ? 'bg-editor-accent text-white'
                        : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Style Grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredStyles.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedStyleId(style.id)}
                  className={clsx(
                    'p-3 rounded-lg text-left transition-colors border',
                    selectedStyleId === style.id
                      ? 'bg-editor-accent/20 border-editor-accent'
                      : 'bg-editor-bg border-transparent hover:border-editor-border'
                  )}
                >
                  <p className="font-medium text-sm truncate">{style.name}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {style.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Selected Style Details */}
            {selectedStyle && (
              <div className="bg-editor-bg rounded-lg p-3">
                <p className="font-medium text-sm mb-2">{selectedStyle.name}</p>
                <p className="text-xs text-gray-400 mb-2">{selectedStyle.description}</p>
                {selectedStyle.example_prompt && (
                  <div className="text-xs text-gray-500">
                    <p className="font-medium mb-1">Example:</p>
                    <p className="italic">{selectedStyle.example_prompt}</p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Style Reference Image */}
            <div>
              <label className="label">Style Reference</label>
              {styleReferenceImage ? (
                <div className="relative rounded-lg overflow-hidden bg-editor-bg">
                  <img
                    src={base64ToUrl(styleReferenceImage)}
                    alt="Style reference"
                    className="w-full h-32 object-cover"
                  />
                  <button
                    onClick={() => setStyleReferenceImage(null)}
                    className="absolute top-2 right-2 p-1 bg-red-500 rounded text-white"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSelectStyleReference}
                  className="w-full h-32 bg-editor-bg rounded-lg border-2 border-dashed border-editor-border flex flex-col items-center justify-center text-gray-500 hover:border-editor-accent hover:text-editor-accent transition-colors"
                >
                  <Image size={24} />
                  <span className="text-sm mt-2">Select from layers</span>
                </button>
              )}
            </div>

            {/* Style Strength */}
            <div>
              <label className="label">Style Strength</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={styleStrength * 100}
                  onChange={(e) => setStyleStrength(e.target.value / 100)}
                  className="flex-1"
                />
                <span className="text-sm text-gray-400 w-10 text-right">
                  {Math.round(styleStrength * 100)}%
                </span>
              </div>
            </div>

            {/* Transfer Prompt */}
            <div>
              <label className="label">Instructions</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe how to apply the style..."
                className="input-field h-20 resize-none"
              />
            </div>

            {/* Target Image */}
            <div>
              <label className="label">Target Image</label>
              {activeLayer?.image_base64 ? (
                <div className="rounded-lg overflow-hidden bg-editor-bg">
                  <img
                    src={base64ToUrl(activeLayer.image_base64)}
                    alt="Target"
                    className="w-full h-32 object-cover"
                  />
                </div>
              ) : (
                <div className="h-32 bg-editor-bg rounded-lg flex items-center justify-center text-gray-500 text-sm">
                  Select a layer as target
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-editor-border">
        <button
          onClick={activeTab === 'presets' ? handleApplyPresetStyle : handleStyleTransfer}
          disabled={
            !activeLayer?.image_base64 ||
            (activeTab === 'presets' ? !selectedStyleId : !styleReferenceImage)
          }
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Palette size={18} />
          {activeTab === 'presets' ? 'Apply Style' : 'Transfer Style'}
        </button>
      </div>
    </div>
  );
}

export default StylesPanel;
