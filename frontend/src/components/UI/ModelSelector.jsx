import React, { useState, useEffect } from 'react';
import { ChevronDown, Cpu } from 'lucide-react';
import { useSessionStore } from '../../stores/sessionStore';
import { useEditorStore } from '../../stores/editorStore';
import clsx from 'clsx';

// All available models with their info
const MODEL_INFO = {
  'gemini-2.5-flash-image': {
    name: 'Gemini 2.5 Flash Image',
    shortName: 'Flash Image',
    description: 'Fast generation and editing',
    speed: 'fast',
    quality: 'good'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    shortName: '2.5 Flash',
    description: 'Segmentation with masks, detection',
    speed: 'fast',
    quality: 'good'
  },
  'gemini-3-pro-image-preview': {
    name: 'Gemini 3 Pro Image',
    shortName: 'Pro Image',
    description: 'Professional 4K, grounding, multi-image',
    speed: 'medium',
    quality: 'best'
  },
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash',
    shortName: '3 Flash',
    description: 'Fast understanding and detection',
    speed: 'fast',
    quality: 'good'
  },
  'gemini-3-pro-preview': {
    name: 'Gemini 3 Pro',
    shortName: '3 Pro',
    description: 'Advanced reasoning and prompts',
    speed: 'medium',
    quality: 'best'
  }
};

// Panel to model mapping - defines which models work for each panel
// First model in array is the default/preferred
const PANEL_MODEL_CONFIG = {
  'generate': {
    models: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    default: 'gemini-2.5-flash-image'
  },
  'edit': {
    models: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    default: 'gemini-2.5-flash-image'
  },
  'segment': {
    models: ['gemini-2.5-flash'],  // Only gemini-2.5-flash returns actual masks
    default: 'gemini-2.5-flash'
  },
  'detect': {
    models: ['gemini-2.5-flash', 'gemini-3-flash-preview'],
    default: 'gemini-2.5-flash'
  },
  'styles': {
    models: ['gemini-3-pro-image-preview'],  // Style transfer needs pro
    default: 'gemini-3-pro-image-preview'
  },
  'prompts': {
    models: ['gemini-3-pro-preview'],  // Prompt assist needs reasoning
    default: 'gemini-3-pro-preview'
  },
  'workflows': {
    models: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    default: 'gemini-2.5-flash-image'
  },
  'memes': {
    models: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    default: 'gemini-2.5-flash-image'
  },
  'text': {
    models: ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'],
    default: 'gemini-2.5-flash-image'
  }
};

function ModelSelector() {
  const {
    selectedModel, setSelectedModel,
    aspectRatio, setAspectRatio,
    imageSize, setImageSize,
    thinkingLevel, setThinkingLevel,
    mediaResolution, setMediaResolution,
    useGrounding, setUseGrounding
  } = useSessionStore();
  const { activePanel } = useEditorStore();

  const [isOpen, setIsOpen] = useState(false);

  // Get panel config - fallback to generate panel config
  const panelConfig = PANEL_MODEL_CONFIG[activePanel] || PANEL_MODEL_CONFIG['generate'];
  const availableModels = panelConfig.models;

  // Auto-switch to default model when panel changes if current model isn't valid for panel
  useEffect(() => {
    if (!availableModels.includes(selectedModel)) {
      setSelectedModel(panelConfig.default);
    }
  }, [activePanel, availableModels, selectedModel, setSelectedModel, panelConfig.default]);

  const currentModel = MODEL_INFO[selectedModel] || MODEL_INFO['gemini-2.5-flash-image'];

  const aspectRatios = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
  const imageSizes = ['1K', '2K', '4K'];
  const thinkingLevels = ['minimal', 'low', 'medium', 'high'];
  const mediaResolutions = ['low', 'medium', 'high'];

  // Determine which options to show based on model
  const isImageModel = selectedModel.includes('image');
  const supportsGrounding = selectedModel === 'gemini-3-pro-image-preview';
  const supports4K = selectedModel === 'gemini-3-pro-image-preview';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-editor-hover rounded-lg hover:bg-editor-border transition-colors"
      >
        <Cpu size={16} className="text-editor-accent" />
        <span className="text-sm">{currentModel.shortName}</span>
        <ChevronDown size={14} className={clsx('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-editor-panel border border-editor-border rounded-lg shadow-xl z-50 p-4">
            {/* Model Selection */}
            <div className="mb-4">
              <label className="label">Model</label>
              <div className="space-y-2">
                {availableModels.map((id) => {
                  const info = MODEL_INFO[id];
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedModel(id)}
                      className={clsx(
                        'w-full p-2 rounded-lg text-left transition-colors',
                        selectedModel === id
                          ? 'bg-editor-accent/20 border border-editor-accent'
                          : 'bg-editor-bg hover:bg-editor-hover border border-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{info.name}</span>
                        <div className="flex gap-1">
                          <span className={clsx(
                            'text-[10px] px-1.5 py-0.5 rounded',
                            info.speed === 'fast' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                          )}>
                            {info.speed}
                          </span>
                          <span className={clsx(
                            'text-[10px] px-1.5 py-0.5 rounded',
                            info.quality === 'best' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
                          )}>
                            {info.quality}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{info.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image Settings - Only for image models */}
            {isImageModel && (
              <>
                <div className="mb-4">
                  <label className="label">Aspect Ratio</label>
                  <div className="flex flex-wrap gap-1">
                    {aspectRatios.map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={clsx(
                          'px-2 py-1 text-xs rounded transition-colors',
                          aspectRatio === ratio
                            ? 'bg-editor-accent text-white'
                            : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <label className="label">Image Size</label>
                  <div className="flex gap-2">
                    {imageSizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        disabled={size === '4K' && !supports4K}
                        className={clsx(
                          'flex-1 py-1.5 text-sm rounded transition-colors',
                          imageSize === size
                            ? 'bg-editor-accent text-white'
                            : 'bg-editor-bg hover:bg-editor-hover text-gray-400',
                          size === '4K' && !supports4K && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Thinking Level - For reasoning models */}
            <div className="mb-4">
              <label className="label">Thinking Level</label>
              <div className="flex gap-1">
                {thinkingLevels.map((level) => (
                  <button
                    key={level}
                    onClick={() => setThinkingLevel(level)}
                    className={clsx(
                      'flex-1 py-1.5 text-xs rounded transition-colors capitalize',
                      thinkingLevel === level
                        ? 'bg-editor-accent text-white'
                        : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                    )}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">
                Higher = better quality, slower response
              </p>
            </div>

            {/* Media Resolution - For understanding models */}
            {!isImageModel && (
              <div className="mb-4">
                <label className="label">Media Resolution</label>
                <div className="flex gap-2">
                  {mediaResolutions.map((res) => (
                    <button
                      key={res}
                      onClick={() => setMediaResolution(res)}
                      className={clsx(
                        'flex-1 py-1.5 text-sm rounded transition-colors capitalize',
                        mediaResolution === res
                          ? 'bg-editor-accent text-white'
                          : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                      )}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Google Grounding */}
            {supportsGrounding && (
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm text-white">Google Grounding</label>
                  <p className="text-[10px] text-gray-500">Fact-verify with Google Search</p>
                </div>
                <button
                  onClick={() => setUseGrounding(!useGrounding)}
                  className={clsx(
                    'w-12 h-6 rounded-full transition-colors relative',
                    useGrounding ? 'bg-editor-accent' : 'bg-editor-border'
                  )}
                >
                  <div className={clsx(
                    'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform',
                    useGrounding ? 'translate-x-6' : 'translate-x-0.5'
                  )} />
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ModelSelector;
