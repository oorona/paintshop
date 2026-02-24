import React, { useState } from 'react';
import { Image, Search, Plus, Download } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { useStyleStore } from '../../stores/styleStore';
import { base64ToUrl } from '../../utils/imageUtils';
import { API_BASE } from '../../config/api';
import clsx from 'clsx';
import toast from 'react-hot-toast';

function MemesPanel() {
  const [searchQuery, setSearchQuery] = useState('');

  const { layers, addLayer, activeLayerId } = useEditorStore();
  const { memeTemplates, selectedMemeId, setSelectedMemeId } = useStyleStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Filter memes by search query
  const filteredMemes = searchQuery
    ? memeTemplates.filter(m =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : memeTemplates;

  const selectedMeme = memeTemplates.find(m => m.id === selectedMemeId);

  const handleAddMemeToCanvas = async (meme) => {
    try {
      // If meme has a URL, fetch it directly; otherwise get from backend
      if (meme.url || meme.thumbnail_url) {
        const imageUrl = meme.url || meme.thumbnail_url;
        // Use the import-url endpoint to fetch and convert to base64
        const response = await fetch(`${API_BASE}/import-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: imageUrl })
        });

        if (!response.ok) throw new Error('Failed to load meme');

        const data = await response.json();

        addLayer({
          id: `layer-${Date.now()}`,
          name: `Meme: ${meme.name}`,
          type: 'image',
          image_base64: data.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      } else if (meme.thumbnail) {
        // Meme already has base64 data
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Meme: ${meme.name}`,
          type: 'image',
          image_base64: meme.thumbnail,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
      } else {
        throw new Error('No image source available');
      }

      toast.success(`Added "${meme.name}" to canvas`);
    } catch (error) {
      toast.error('Failed to load meme template');
    }
  };

  const handleCombineWithSegment = async () => {
    if (!selectedMeme || !activeLayer?.image_base64) {
      toast.error('Select a meme and have an active image layer');
      return;
    }

    // This would typically call the AI to combine the segmented image with the meme
    toast.success('Use the Edit panel to combine your segmented image with this meme');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Image size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Meme Templates</h2>
        </div>
        <p className="text-xs text-gray-500">
          Add meme templates to combine with your images
        </p>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-editor-border">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memes..."
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {memeTemplates.length === 0 ? (
          <div className="text-center py-8">
            <Image size={48} className="mx-auto text-gray-600 mb-4" />
            <p className="text-gray-500 mb-2">No meme templates loaded</p>
            <p className="text-xs text-gray-600">
              Meme templates load from Imgflip API. Please check your connection and try again.
            </p>
          </div>
        ) : filteredMemes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No memes match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredMemes.map((meme) => (
              <button
                key={meme.id}
                onClick={() => setSelectedMemeId(meme.id)}
                className={clsx(
                  'relative aspect-square rounded-lg overflow-hidden border-2 transition-colors group',
                  selectedMemeId === meme.id
                    ? 'border-editor-accent'
                    : 'border-transparent hover:border-editor-border'
                )}
              >
                {meme.thumbnail_url || meme.thumbnail ? (
                  <img
                    src={meme.thumbnail_url || base64ToUrl(meme.thumbnail)}
                    alt={meme.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-editor-bg flex items-center justify-center">
                    <Image size={24} className="text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddMemeToCanvas(meme);
                    }}
                    className="p-2 bg-editor-accent rounded-full text-white"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1">
                  <p className="text-xs text-white truncate">{meme.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Meme Info */}
      {selectedMeme && (
        <div className="p-4 border-t border-editor-border">
          <p className="font-medium text-sm mb-2">{selectedMeme.name}</p>
          {selectedMeme.tags && (
            <div className="flex flex-wrap gap-1 mb-3">
              {selectedMeme.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 bg-editor-bg rounded text-xs text-gray-400">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => handleAddMemeToCanvas(selectedMeme)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add to Canvas
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="p-4 border-t border-editor-border">
        <p className="text-xs text-gray-500 mb-2">How to use:</p>
        <ol className="text-xs text-gray-500 space-y-1 list-decimal list-inside">
          <li>Segment your image to extract subject</li>
          <li>Select a meme template</li>
          <li>Use Edit panel to combine them</li>
        </ol>
      </div>
    </div>
  );
}

export default MemesPanel;
