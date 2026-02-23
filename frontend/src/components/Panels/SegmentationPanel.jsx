import React, { useState } from 'react';
import { Scissors, Target, Download, Plus, Layers, Combine, Minus, CircleDot, X, ChevronDown, Wand2 } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { base64ToUrl, applyMaskToImage, combineMasks, invertMask, removeMaskFromImage } from '../../utils/imageUtils';
import clsx from 'clsx';

const MASK_OPERATIONS = [
  { value: 'union', label: 'Union (Add)', icon: Plus, description: 'Combine all selected masks' },
  { value: 'intersection', label: 'Intersection', icon: CircleDot, description: 'Keep only overlapping areas' },
  { value: 'subtract', label: 'Subtract', icon: Minus, description: 'Remove second mask from first' },
  { value: 'xor', label: 'Exclusive (XOR)', icon: X, description: 'Non-overlapping areas only' },
];

const LAYER_MASK_OPERATIONS = [
  { value: 'keep', label: 'Keep Mask Area', description: 'Extract only the masked area from layer' },
  { value: 'remove', label: 'Remove Mask Area', description: 'Remove the masked area from layer' },
  { value: 'keep_inverted', label: 'Keep Outside Mask', description: 'Keep everything except the masked area' },
];

function SegmentationPanel() {
  const [prompt, setPrompt] = useState('');
  const [segments, setSegments] = useState([]);
  const [selectedSegments, setSelectedSegments] = useState([]);
  const [maskOperation, setMaskOperation] = useState('union');
  const [combinedMaskPreview, setCombinedMaskPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetLayerId, setTargetLayerId] = useState(null);
  const [layerMaskOperation, setLayerMaskOperation] = useState('keep');

  const { segmentObjects } = useGeminiApi();
  const { layers, activeLayerId, addLayer, updateLayer } = useEditorStore();
  // Model switching is now handled centrally in ModelSelector based on activePanel

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const targetLayer = layers.find(l => l.id === targetLayerId);
  const imageLayers = layers.filter(l => l.type === 'image' && l.image_base64);

  const handleSegment = async () => {
    if (!activeLayer?.image_base64) return;

    try {
      const result = await segmentObjects(activeLayer.image_base64, prompt || 'Detect and segment all objects');

      if (result.success && result.segments) {
        setSegments(result.segments);
        setSelectedSegments([]);
      }
    } catch (error) {
      console.error('Segmentation failed:', error);
    }
  };

  const handleExtractSegment = async (segment) => {
    if (!activeLayer?.image_base64) return;

    try {
      const extracted = await applyMaskToImage(activeLayer.image_base64, segment.mask_base64);

      addLayer({
        id: `layer-${Date.now()}`,
        name: `Extracted: ${segment.label}`,
        type: 'image',
        image_base64: extracted,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });
    } catch (error) {
      console.error('Extraction failed:', error);
    }
  };

  const handleCreateMaskLayer = (segment) => {
    addLayer({
      id: `layer-${Date.now()}`,
      name: `Mask: ${segment.label}`,
      type: 'mask',
      image_base64: segment.mask_base64,
      visible: true,
      opacity: 0.5,
      blend_mode: 'normal',
      order: layers.length
    });
  };

  const handleExtractSelected = async () => {
    const selectedSegs = segments.filter((_, i) => selectedSegments.includes(i));

    for (const segment of selectedSegs) {
      await handleExtractSegment(segment);
    }
  };

  const toggleSegmentSelection = (index) => {
    if (selectedSegments.includes(index)) {
      setSelectedSegments(selectedSegments.filter(i => i !== index));
      setCombinedMaskPreview(null);
    } else {
      setSelectedSegments([...selectedSegments, index]);
      setCombinedMaskPreview(null);
    }
  };

  // Preview combined mask with selected operation
  const handlePreviewCombinedMask = async () => {
    if (selectedSegments.length < 2) return;

    setIsProcessing(true);
    try {
      const selectedMasks = selectedSegments.map(i => segments[i].mask_base64);
      const combined = await combineMasks(selectedMasks, maskOperation);
      setCombinedMaskPreview(combined);
    } catch (error) {
      console.error('Failed to combine masks:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Create a combined mask layer
  const handleCreateCombinedMaskLayer = async () => {
    if (selectedSegments.length < 2) return;

    setIsProcessing(true);
    try {
      const selectedMasks = selectedSegments.map(i => segments[i].mask_base64);
      const combined = await combineMasks(selectedMasks, maskOperation);
      const labels = selectedSegments.map(i => segments[i].label).join(' + ');

      addLayer({
        id: `layer-${Date.now()}`,
        name: `Combined Mask: ${maskOperation} (${labels})`,
        type: 'mask',
        image_base64: combined,
        visible: true,
        opacity: 0.5,
        blend_mode: 'normal',
        order: layers.length
      });
    } catch (error) {
      console.error('Failed to create combined mask:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Extract image using combined mask
  const handleExtractWithCombinedMask = async () => {
    if (!activeLayer?.image_base64 || selectedSegments.length < 2) return;

    setIsProcessing(true);
    try {
      const selectedMasks = selectedSegments.map(i => segments[i].mask_base64);
      const combined = await combineMasks(selectedMasks, maskOperation);
      const extracted = await applyMaskToImage(activeLayer.image_base64, combined);
      const labels = selectedSegments.map(i => segments[i].label).join(' + ');

      addLayer({
        id: `layer-${Date.now()}`,
        name: `Extracted: ${maskOperation} (${labels})`,
        type: 'image',
        image_base64: extracted,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });
    } catch (error) {
      console.error('Failed to extract with combined mask:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Invert a single mask
  const handleInvertMask = async (segment, index) => {
    setIsProcessing(true);
    try {
      const inverted = await invertMask(segment.mask_base64);
      const newSegments = [...segments];
      newSegments[index] = {
        ...segment,
        mask_base64: inverted,
        label: `Inverted: ${segment.label}`
      };
      setSegments(newSegments);
    } catch (error) {
      console.error('Failed to invert mask:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply mask operation to a target layer
  const handleApplyMaskToLayer = async (maskBase64, operation = layerMaskOperation) => {
    if (!targetLayer?.image_base64 || !maskBase64) return;

    setIsProcessing(true);
    try {
      let result;
      let operationName;

      switch (operation) {
        case 'keep':
          result = await applyMaskToImage(targetLayer.image_base64, maskBase64);
          operationName = 'Masked';
          break;
        case 'remove':
          result = await removeMaskFromImage(targetLayer.image_base64, maskBase64);
          operationName = 'Mask Removed';
          break;
        case 'keep_inverted':
          result = await applyMaskToImage(targetLayer.image_base64, maskBase64, true);
          operationName = 'Inverse Masked';
          break;
        default:
          return;
      }

      addLayer({
        id: `layer-${Date.now()}`,
        name: `${operationName}: ${targetLayer.name}`,
        type: 'image',
        image_base64: result,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });
    } catch (error) {
      console.error('Failed to apply mask to layer:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply selected/combined mask to target layer
  const handleApplySelectedMaskToLayer = async () => {
    if (selectedSegments.length === 0) return;

    let maskToApply;
    if (selectedSegments.length === 1) {
      maskToApply = segments[selectedSegments[0]].mask_base64;
    } else {
      const selectedMasks = selectedSegments.map(i => segments[i].mask_base64);
      maskToApply = await combineMasks(selectedMasks, maskOperation);
    }

    await handleApplyMaskToLayer(maskToApply);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Scissors size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Segmentation</h2>
        </div>
        <p className="text-xs text-gray-500">
          Extract objects with AI-powered masks
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Source Image */}
        <div>
          <label className="label">Source Image</label>
          {activeLayer?.image_base64 ? (
            <div className="relative rounded-lg overflow-hidden bg-editor-bg">
              <img
                src={base64ToUrl(activeLayer.image_base64)}
                alt="Source"
                className="w-full h-40 object-contain"
              />
            </div>
          ) : (
            <div className="h-40 bg-editor-bg rounded-lg flex items-center justify-center text-gray-500 text-sm">
              Select a layer to segment
            </div>
          )}
        </div>

        {/* Segmentation Prompt */}
        <div>
          <label className="label">What to Segment</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., 'the dog', 'all people', 'the red car'..."
            className="input-field h-20 resize-none"
          />
        </div>

        {/* Quick Prompts */}
        <div>
          <label className="label">Quick Prompts</label>
          <div className="flex flex-wrap gap-1">
            {[
              'all objects',
              'the main subject',
              'all people',
              'all animals',
              'the background',
              'foreground elements'
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setPrompt(`Segment ${p}`)}
                className="px-2 py-1 text-xs bg-editor-bg hover:bg-editor-hover rounded transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Segment Results */}
        {segments.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Detected Segments ({segments.length})</label>
              {selectedSegments.length > 0 && (
                <span className="text-xs text-editor-accent">
                  {selectedSegments.length} selected
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {segments.map((segment, index) => (
                <div
                  key={index}
                  className={clsx(
                    'p-3 bg-editor-bg rounded-lg border transition-colors',
                    selectedSegments.includes(index)
                      ? 'border-editor-accent'
                      : 'border-transparent hover:border-editor-border'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedSegments.includes(index)}
                        onChange={() => toggleSegmentSelection(index)}
                        className="rounded"
                      />
                      <span className="font-medium text-sm truncate max-w-[120px]" title={segment.label}>
                        {segment.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleInvertMask(segment, index)}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-editor-hover rounded text-gray-400 hover:text-white"
                        title="Invert mask"
                      >
                        <CircleDot size={14} />
                      </button>
                      <button
                        onClick={() => handleExtractSegment(segment)}
                        className="p-1.5 hover:bg-editor-hover rounded text-gray-400 hover:text-white"
                        title="Extract to new layer"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => handleCreateMaskLayer(segment)}
                        className="p-1.5 hover:bg-editor-hover rounded text-gray-400 hover:text-white"
                        title="Create mask layer"
                      >
                        <Layers size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Mask Preview */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <img
                        src={base64ToUrl(segment.mask_base64)}
                        alt={`Mask: ${segment.label}`}
                        className="w-full h-16 object-contain bg-black/20 rounded"
                      />
                      <p className="text-[10px] text-gray-500 mt-1 text-center">Mask</p>
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">
                        <p>Box:</p>
                        <p className="font-mono text-[10px]">
                          {segment.box?.join(', ') || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mask Operations - shown when 2+ masks selected */}
        {selectedSegments.length >= 2 && (
          <div className="bg-editor-bg rounded-lg p-3 border border-editor-accent/30">
            <div className="flex items-center gap-2 mb-3">
              <Combine size={16} className="text-editor-accent" />
              <label className="label mb-0">Mask Operations</label>
            </div>

            {/* Operation Selection */}
            <div className="space-y-2 mb-3">
              {MASK_OPERATIONS.map((op) => {
                const Icon = op.icon;
                return (
                  <label
                    key={op.value}
                    className={clsx(
                      'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                      maskOperation === op.value
                        ? 'bg-editor-accent/20 border border-editor-accent'
                        : 'hover:bg-editor-hover border border-transparent'
                    )}
                  >
                    <input
                      type="radio"
                      name="maskOperation"
                      value={op.value}
                      checked={maskOperation === op.value}
                      onChange={(e) => {
                        setMaskOperation(e.target.value);
                        setCombinedMaskPreview(null);
                      }}
                      className="sr-only"
                    />
                    <Icon size={14} className="text-gray-400" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{op.label}</p>
                      <p className="text-[10px] text-gray-500">{op.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Preview Button */}
            <button
              onClick={handlePreviewCombinedMask}
              disabled={isProcessing}
              className="w-full btn-secondary text-xs mb-2"
            >
              {isProcessing ? 'Processing...' : 'Preview Combined Mask'}
            </button>

            {/* Combined Mask Preview */}
            {combinedMaskPreview && (
              <div className="mb-3">
                <p className="text-[10px] text-gray-500 mb-1">Combined Mask Preview:</p>
                <img
                  src={base64ToUrl(combinedMaskPreview)}
                  alt="Combined mask preview"
                  className="w-full h-24 object-contain bg-black/20 rounded"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateCombinedMaskLayer}
                disabled={isProcessing}
                className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
              >
                <Layers size={12} />
                Add as Mask
              </button>
              <button
                onClick={handleExtractWithCombinedMask}
                disabled={isProcessing || !activeLayer?.image_base64}
                className="flex-1 btn-primary text-xs flex items-center justify-center gap-1"
              >
                <Plus size={12} />
                Extract
              </button>
            </div>
          </div>
        )}

        {/* Single mask quick actions */}
        {selectedSegments.length === 1 && (
          <div className="bg-editor-bg/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">Quick Actions for Selected Mask:</p>
            <div className="flex gap-2">
              <button
                onClick={() => handleExtractSegment(segments[selectedSegments[0]])}
                className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
              >
                <Plus size={12} />
                Extract
              </button>
              <button
                onClick={() => handleCreateMaskLayer(segments[selectedSegments[0]])}
                className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
              >
                <Layers size={12} />
                Add Mask
              </button>
            </div>
          </div>
        )}

        {/* Apply Mask to Layer - shown when segments exist and at least one is selected */}
        {segments.length > 0 && selectedSegments.length >= 1 && imageLayers.length > 0 && (
          <div className="bg-editor-bg rounded-lg p-3 border border-purple-500/30">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-purple-400" />
              <label className="label mb-0">Apply Mask to Layer</label>
            </div>

            {/* Target Layer Selection */}
            <div className="mb-3">
              <label className="text-[10px] text-gray-500 mb-1 block">Target Layer</label>
              <select
                value={targetLayerId || ''}
                onChange={(e) => setTargetLayerId(e.target.value || null)}
                className="w-full input-field text-xs"
              >
                <option value="">Select a layer...</option>
                {imageLayers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Operation Selection */}
            <div className="space-y-1.5 mb-3">
              {LAYER_MASK_OPERATIONS.map((op) => (
                <label
                  key={op.value}
                  className={clsx(
                    'flex items-start gap-2 p-2 rounded cursor-pointer transition-colors',
                    layerMaskOperation === op.value
                      ? 'bg-purple-500/20 border border-purple-500'
                      : 'hover:bg-editor-hover border border-transparent'
                  )}
                >
                  <input
                    type="radio"
                    name="layerMaskOperation"
                    value={op.value}
                    checked={layerMaskOperation === op.value}
                    onChange={(e) => setLayerMaskOperation(e.target.value)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-medium">{op.label}</p>
                    <p className="text-[10px] text-gray-500">{op.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Apply Button */}
            <button
              onClick={handleApplySelectedMaskToLayer}
              disabled={isProcessing || !targetLayerId}
              className="w-full btn-primary text-xs flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-500"
            >
              <Wand2 size={12} />
              Apply {selectedSegments.length > 1 ? 'Combined Mask' : 'Mask'} to Layer
            </button>

            {!targetLayerId && (
              <p className="text-[10px] text-gray-500 mt-2 text-center">
                Select a target layer to apply the mask
              </p>
            )}
          </div>
        )}

        {/* Tips - collapsed when segments exist */}
        {segments.length === 0 && (
          <div className="bg-editor-bg/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">Tips for better segmentation:</p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
              <li>Be specific about what to segment</li>
              <li>Use descriptive terms (color, position)</li>
              <li>Select multiple masks to combine them</li>
            </ul>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-editor-border space-y-2">
        <button
          onClick={handleSegment}
          disabled={!activeLayer?.image_base64}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Target size={18} />
          Detect & Segment
        </button>
        {segments.length > 0 && (
          <button
            onClick={() => {
              setSegments([]);
              setSelectedSegments([]);
              setCombinedMaskPreview(null);
            }}
            className="btn-secondary w-full text-xs"
          >
            Clear Results
          </button>
        )}
      </div>
    </div>
  );
}

export default SegmentationPanel;
