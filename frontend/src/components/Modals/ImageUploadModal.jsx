import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image, Layers, Replace } from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import { fileToBase64 } from '../../utils/imageUtils';
import UnsavedChangesModal from './UnsavedChangesModal';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function ImageUploadModal({ onClose }) {
  const { addLayer, loadImage, layers, hasUnsavedChanges } = useEditorStore();
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState(null);
  const [uploadMode, setUploadMode] = useState(layers.length > 0 ? 'add' : 'replace'); // 'replace' or 'add'

  const processFiles = useCallback(async (acceptedFiles, forceMode = null) => {
    const mode = forceMode || uploadMode;

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      try {
        const base64 = await fileToBase64(file);

        // Get image dimensions
        const img = new window.Image();
        img.src = `data:${file.type};base64,${base64}`;

        img.onload = () => {
          if (mode === 'replace' && i === 0 && acceptedFiles.length === 1) {
            // Replace mode: clear canvas and load as base layer
            loadImage(base64, file.name);
          } else {
            // Add mode: add as new layers
            addLayer({
              id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: file.name,
              type: 'image',
              image_base64: base64,
              visible: true,
              opacity: 1,
              blend_mode: 'normal',
              order: layers.length + i
            });
          }

          toast.success(`Uploaded: ${file.name}`);
        };
      } catch (error) {
        toast.error(`Failed to upload: ${file.name}`);
      }
    }
    onClose();
  }, [addLayer, loadImage, layers, onClose, uploadMode]);

  const onDrop = useCallback(async (acceptedFiles) => {
    // Check if this would replace existing layers
    const isReplacingLayers = uploadMode === 'replace' && acceptedFiles.length === 1 && layers.length > 0;

    // If there are unsaved changes and we're replacing layers, show confirmation
    if (isReplacingLayers && hasUnsavedChanges) {
      setPendingFiles(acceptedFiles);
      setShowUnsavedModal(true);
      return;
    }

    // Otherwise, process files directly
    await processFiles(acceptedFiles);
  }, [layers, hasUnsavedChanges, processFiles, uploadMode]);

  const handleDiscard = () => {
    setShowUnsavedModal(false);
    if (pendingFiles) {
      processFiles(pendingFiles);
    }
  };

  const handleSaveAndContinue = () => {
    setShowUnsavedModal(false);
    if (pendingFiles) {
      processFiles(pendingFiles);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']
    },
    multiple: true
  });

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-editor-border">
            <h2 className="text-lg font-semibold">Upload Image</h2>
            <button onClick={onClose} className="p-1 hover:bg-editor-hover rounded">
              <X size={20} />
            </button>
          </div>

          <div className="p-6">
            {/* Upload Mode Toggle */}
            {layers.length > 0 && (
              <div className="mb-4">
                <label className="text-sm text-gray-400 mb-2 block">Upload Mode</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUploadMode('add')}
                    className={clsx(
                      'flex-1 py-2 px-3 text-sm rounded-lg transition-colors flex items-center justify-center gap-2',
                      uploadMode === 'add'
                        ? 'bg-editor-accent text-white'
                        : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                    )}
                  >
                    <Layers size={16} />
                    Add as Layer
                  </button>
                  <button
                    onClick={() => setUploadMode('replace')}
                    className={clsx(
                      'flex-1 py-2 px-3 text-sm rounded-lg transition-colors flex items-center justify-center gap-2',
                      uploadMode === 'replace'
                        ? 'bg-editor-accent text-white'
                        : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                    )}
                  >
                    <Replace size={16} />
                    Replace All
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {uploadMode === 'add'
                    ? 'Images will be added as new layers, keeping existing content'
                    : 'Single image will replace all existing layers'
                  }
                </p>
              </div>
            )}

            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                ${isDragActive
                  ? 'border-editor-accent bg-editor-accent/10'
                  : 'border-editor-border hover:border-editor-accent/50'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-editor-accent/20 rounded-full flex items-center justify-center mb-4">
                  <Upload size={32} className="text-editor-accent" />
                </div>
                {isDragActive ? (
                  <p className="text-lg text-editor-accent">Drop images here...</p>
                ) : (
                  <>
                    <p className="text-lg text-white mb-2">
                      Drag & drop images here
                    </p>
                    <p className="text-sm text-gray-500">
                      or click to browse files
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Image size={16} />
              <span>Supports: PNG, JPG, GIF, WebP, BMP</span>
            </div>
          </div>
        </div>
      </div>

      {showUnsavedModal && (
        <UnsavedChangesModal
          onClose={() => {
            setShowUnsavedModal(false);
            setPendingFiles(null);
          }}
          onDiscard={handleDiscard}
          onSaveAndContinue={handleSaveAndContinue}
        />
      )}
    </>
  );
}

export default ImageUploadModal;
