import React from 'react';
import { AlertTriangle, Save, Trash2, X } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { downloadImage, compositeImages } from '../../utils/imageUtils';
import toast from 'react-hot-toast';

function UnsavedChangesModal({ onClose, onDiscard, onSaveAndContinue }) {
  const { layers } = useEditorStore();

  const handleSave = async () => {
    try {
      // Flatten all visible layers into one image
      const visibleLayers = layers
        .filter(l => l.visible && l.image_base64)
        .sort((a, b) => a.order - b.order);

      if (visibleLayers.length === 0) {
        toast.error('No visible layers to save');
        return;
      }

      let finalImage = visibleLayers[0].image_base64;

      // Composite all layers
      for (let i = 1; i < visibleLayers.length; i++) {
        const layer = visibleLayers[i];
        finalImage = await compositeImages(finalImage, layer.image_base64, 0, 0, layer.opacity);
      }

      // Download the image
      const filename = `project-${Date.now()}.png`;
      downloadImage(finalImage, filename);

      toast.success('Image saved!');

      if (onSaveAndContinue) {
        onSaveAndContinue();
      }
    } catch (error) {
      console.error('Failed to save image:', error);
      toast.error('Failed to save image');
    }
  };

  const handleDiscard = () => {
    if (onDiscard) {
      onDiscard();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-editor-border">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-yellow-500" />
            <h2 className="text-lg font-semibold">Unsaved Changes</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-editor-hover rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-300 mb-4">
            You have unsaved changes. Do you want to save your work before loading a new image?
          </p>

          <div className="bg-editor-bg rounded-lg p-3 mb-4">
            <p className="text-sm text-gray-400">
              Current project has <span className="text-white font-medium">{layers.length} layer{layers.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-editor-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleDiscard}
            className="btn-secondary flex items-center gap-2 text-red-400 hover:text-red-300"
          >
            <Trash2 size={16} />
            Discard
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex items-center gap-2"
          >
            <Save size={16} />
            Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default UnsavedChangesModal;
