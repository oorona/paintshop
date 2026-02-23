import React, { useState } from 'react';
import { ScanSearch, Box, Download, Eye } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { base64ToUrl, drawBoundingBoxes } from '../../utils/imageUtils';
import clsx from 'clsx';

function DetectionPanel() {
  const [prompt, setPrompt] = useState('');
  const [detections, setDetections] = useState([]);
  const [annotatedImage, setAnnotatedImage] = useState(null);

  const { detectObjects } = useGeminiApi();
  const { layers, activeLayerId, addLayer } = useEditorStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);

  const handleDetect = async () => {
    if (!activeLayer?.image_base64) return;

    try {
      const result = await detectObjects(activeLayer.image_base64, prompt || 'Detect all objects');

      if (result.success && result.objects) {
        setDetections(result.objects);

        // Create annotated image with bounding boxes
        if (result.objects.length > 0) {
          const annotated = await drawBoundingBoxes(activeLayer.image_base64, result.objects);
          setAnnotatedImage(annotated);
        }
      }
    } catch (error) {
      console.error('Detection failed:', error);
    }
  };

  const handleSaveAnnotated = () => {
    if (annotatedImage) {
      addLayer({
        id: `layer-${Date.now()}`,
        name: `Detected Objects`,
        type: 'image',
        image_base64: annotatedImage,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <ScanSearch size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Object Detection</h2>
        </div>
        <p className="text-xs text-gray-500">
          Find and label objects with bounding boxes
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
                src={base64ToUrl(annotatedImage || activeLayer.image_base64)}
                alt="Source"
                className="w-full h-40 object-contain"
              />
              {annotatedImage && (
                <div className="absolute top-2 right-2">
                  <button
                    onClick={handleSaveAnnotated}
                    className="p-1.5 bg-editor-accent rounded text-white"
                    title="Save annotated image as layer"
                  >
                    <Download size={14} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-40 bg-editor-bg rounded-lg flex items-center justify-center text-gray-500 text-sm">
              Select a layer to analyze
            </div>
          )}
        </div>

        {/* Detection Prompt */}
        <div>
          <label className="label">What to Detect</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., 'all faces', 'vehicles', 'text'..."
            className="input-field h-20 resize-none"
          />
        </div>

        {/* Quick Prompts */}
        <div>
          <label className="label">Quick Detection</label>
          <div className="flex flex-wrap gap-1">
            {[
              'all objects',
              'people and faces',
              'text and logos',
              'vehicles',
              'animals',
              'food items'
            ].map((p, i) => (
              <button
                key={i}
                onClick={() => setPrompt(`Detect ${p}`)}
                className="px-2 py-1 text-xs bg-editor-bg hover:bg-editor-hover rounded transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Detection Results */}
        {detections.length > 0 && (
          <div>
            <label className="label">Detected Objects ({detections.length})</label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {detections.map((detection, index) => (
                <div
                  key={index}
                  className="p-3 bg-editor-bg rounded-lg flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce', '#82e0aa'][index % 6]
                      }}
                    />
                    <div>
                      <p className="font-medium text-sm">{detection.label}</p>
                      <p className="text-xs text-gray-500 font-mono">
                        [{detection.box.join(', ')}]
                      </p>
                    </div>
                  </div>
                  {detection.confidence && (
                    <span className="text-xs text-editor-accent">
                      {Math.round(detection.confidence * 100)}%
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detection Info */}
        <div className="bg-editor-bg/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">About Detection:</p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Bounding boxes use normalized coordinates (0-1000)</li>
            <li>Different colors indicate different objects</li>
            <li>Confidence shows detection certainty</li>
          </ul>
        </div>
      </div>

      {/* Action Button */}
      <div className="p-4 border-t border-editor-border">
        <button
          onClick={handleDetect}
          disabled={!activeLayer?.image_base64}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Box size={18} />
          Detect Objects
        </button>
      </div>
    </div>
  );
}

export default DetectionPanel;
