import React, { useState } from 'react';
import { Link, X, Loader2 } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { API_BASE } from '../../config/api';
import toast from 'react-hot-toast';

function UrlImportModal({ onClose }) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { addLayer, layers } = useEditorStore();

  const handleImport = async () => {
    if (!url.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/import-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import image');
      }

      addLayer({
        id: `layer-${Date.now()}`,
        name: `Imported from URL`,
        type: 'image',
        image_base64: data.image_base64,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });

      toast.success('Image imported successfully!');
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-editor-border">
          <h2 className="text-lg font-semibold">Import from URL</h2>
          <button onClick={onClose} className="p-1 hover:bg-editor-hover rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <label className="label">Image URL</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="input-field pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
              />
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-500">
            <p>Enter the URL of an image you want to import.</p>
            <p className="mt-1">Supports: Direct image links (PNG, JPG, WebP, etc.)</p>
          </div>

          {/* Example URLs */}
          <div className="mt-4">
            <label className="label">Example URLs</label>
            <div className="space-y-1">
              {[
                'https://picsum.photos/1024',
                'https://placekitten.com/1024/1024',
              ].map((exampleUrl, i) => (
                <button
                  key={i}
                  onClick={() => setUrl(exampleUrl)}
                  className="w-full text-left p-2 bg-editor-bg hover:bg-editor-hover rounded text-sm text-gray-400 truncate"
                >
                  {exampleUrl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-editor-border">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!url.trim() || isLoading}
            className="btn-primary flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Link size={16} />
                Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UrlImportModal;
