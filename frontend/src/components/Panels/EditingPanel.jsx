import React, { useState } from 'react';
import { Wand2, Image, Layers, Plus } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { useStyleStore } from '../../stores/styleStore';
import { base64ToUrl } from '../../utils/imageUtils';
import clsx from 'clsx';

function EditingPanel() {
  const [prompt, setPrompt] = useState('');
  const [multiImageMode, setMultiImageMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  const { editImage, multiImageEdit, inpaint, styleTransfer } = useGeminiApi();
  const { layers, activeLayerId, addLayer } = useEditorStore();
  const { styles, styleCategories, selectedStyleId, setSelectedStyleId, promptTemplates } = useStyleStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const editingTemplates = promptTemplates.filter(t => t.category === 'Editing');

  const handleEdit = async () => {
    if (!prompt.trim() || !activeLayer?.image_base64) return;

    try {
      const result = await editImage(prompt, activeLayer.image_base64, null, selectedStyleId);

      if (result.success && result.image_base64) {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Edited: ${prompt.substring(0, 20)}...`,
          type: 'image',
          image_base64: result.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      }
    } catch (error) {
      console.error('Edit failed:', error);
    }
  };

  const handleMultiImageEdit = async () => {
    if (!prompt.trim() || selectedImages.length < 2) return;

    try {
      const images = selectedImages.map(id => layers.find(l => l.id === id)?.image_base64).filter(Boolean);
      const result = await multiImageEdit(prompt, images, selectedStyleId);

      if (result.success && result.image_base64) {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Combined: ${prompt.substring(0, 20)}...`,
          type: 'image',
          image_base64: result.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      }
    } catch (error) {
      console.error('Multi-image edit failed:', error);
    }
  };

  const toggleImageSelection = (layerId) => {
    if (selectedImages.includes(layerId)) {
      setSelectedImages(selectedImages.filter(id => id !== layerId));
    } else if (selectedImages.length < 14) {
      setSelectedImages([...selectedImages, layerId]);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Edit Image</h2>
        </div>
        <p className="text-xs text-gray-500">
          Modify images with natural language prompts
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setMultiImageMode(false)}
            className={clsx(
              'flex-1 py-2 text-sm rounded-lg transition-colors',
              !multiImageMode
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
            )}
          >
            Single Image
          </button>
          <button
            onClick={() => setMultiImageMode(true)}
            className={clsx(
              'flex-1 py-2 text-sm rounded-lg transition-colors',
              multiImageMode
                ? 'bg-editor-accent text-white'
                : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
            )}
          >
            Multi-Image
          </button>
        </div>

        {/* Source Image(s) */}
        {!multiImageMode ? (
          <div>
            <label className="label">Source Image</label>
            {activeLayer?.image_base64 ? (
              <div className="relative rounded-lg overflow-hidden bg-editor-bg">
                <img
                  src={base64ToUrl(activeLayer.image_base64)}
                  alt="Source"
                  className="w-full h-40 object-contain"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs">
                  {activeLayer.name}
                </div>
              </div>
            ) : (
              <div className="h-40 bg-editor-bg rounded-lg flex items-center justify-center text-gray-500 text-sm">
                Select a layer to edit
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Select Images (2-14)</label>
              <span className="text-xs text-gray-500">{selectedImages.length}/14</span>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {layers.filter(l => l.image_base64).map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleImageSelection(layer.id)}
                  className={clsx(
                    'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors',
                    selectedImages.includes(layer.id)
                      ? 'border-editor-accent'
                      : 'border-transparent hover:border-editor-border'
                  )}
                >
                  <img
                    src={base64ToUrl(layer.image_base64)}
                    alt={layer.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedImages.includes(layer.id) && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-editor-accent rounded-full flex items-center justify-center text-xs text-white">
                      {selectedImages.indexOf(layer.id) + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Input */}
        <div>
          <label className="label">Edit Instructions</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={multiImageMode
              ? "Describe how to combine or compose the images..."
              : "Describe the changes you want to make..."
            }
            className="input-field h-24 resize-none"
          />
        </div>

        {/* Editing Templates */}
        <div>
          <label className="label">Quick Actions</label>
          <div className="flex flex-wrap gap-1">
            {[
              { label: 'Remove BG', prompt: 'Remove the background, keep only the main subject' },
              { label: 'Add Text', prompt: 'Add the text "TITLE" in large bold letters at the top' },
              { label: 'Change Style', prompt: 'Transform to oil painting style' },
              { label: 'Add Lighting', prompt: 'Add dramatic rim lighting and golden hour atmosphere' },
              { label: 'Enhance', prompt: 'Enhance colors, increase contrast, make more vibrant' }
            ].map((action, i) => (
              <button
                key={i}
                onClick={() => setPrompt(action.prompt)}
                className="px-2 py-1 text-xs bg-editor-bg hover:bg-editor-hover rounded transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Template Prompts */}
        {editingTemplates.length > 0 && (
          <div>
            <label className="label">Templates</label>
            <div className="space-y-1">
              {editingTemplates.slice(0, 4).map((template) => (
                <button
                  key={template.id}
                  onClick={() => setPrompt(template.template)}
                  className="w-full text-left p-2 bg-editor-bg hover:bg-editor-hover rounded text-sm"
                >
                  <p className="font-medium">{template.name}</p>
                  <p className="text-xs text-gray-500 truncate">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Style Selection */}
        <div>
          <label className="label">Apply Style (Optional)</label>
          <select
            value={selectedStyleId || ''}
            onChange={(e) => setSelectedStyleId(e.target.value || null)}
            className="select-field"
          >
            <option value="">No Style</option>
            {styleCategories.map((category) => (
              <optgroup key={category} label={category}>
                {styles
                  .filter((style) => style.category === category)
                  .map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-editor-border">
        <button
          onClick={multiImageMode ? handleMultiImageEdit : handleEdit}
          disabled={!prompt.trim() || (multiImageMode ? selectedImages.length < 2 : !activeLayer?.image_base64)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Wand2 size={18} />
          {multiImageMode ? `Combine ${selectedImages.length} Images` : 'Apply Edit'}
        </button>
      </div>
    </div>
  );
}

export default EditingPanel;
