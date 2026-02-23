import React, { useState } from 'react';
import { MessageSquare, Sparkles, Copy, Check, RefreshCw } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useStyleStore } from '../../stores/styleStore';
import clsx from 'clsx';
import toast from 'react-hot-toast';

function PromptAssistPanel() {
  const [input, setInput] = useState('');
  const [taskType, setTaskType] = useState('generate');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  const { assistPrompt } = useGeminiApi();
  const { promptTemplates, addToPromptHistory, addFavoritePrompt } = useStyleStore();

  const taskTypes = [
    { id: 'generate', label: 'Image Generation', description: 'Create new images' },
    { id: 'edit', label: 'Image Editing', description: 'Modify existing images' },
    { id: 'style', label: 'Style Description', description: 'Describe artistic styles' },
    { id: 'segmentation', label: 'Segmentation', description: 'Object detection prompts' },
  ];

  const handleGenerate = async () => {
    if (!input.trim()) return;

    try {
      const result = await assistPrompt(input, taskType);
      if (result) {
        setGeneratedPrompt(result);
      }
    } catch (error) {
      console.error('Prompt generation failed:', error);
    }
  };

  const handleCopy = async () => {
    if (generatedPrompt) {
      await navigator.clipboard.writeText(generatedPrompt);
      setCopied(true);
      toast.success('Copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleUsePrompt = () => {
    if (generatedPrompt) {
      addToPromptHistory(generatedPrompt);
      toast.success('Added to prompt history!');
    }
  };

  const handleSaveAsFavorite = () => {
    if (generatedPrompt) {
      addFavoritePrompt(generatedPrompt);
      toast.success('Saved as favorite!');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={18} className="text-editor-accent" />
          <h2 className="font-semibold">AI Prompt Assistant</h2>
        </div>
        <p className="text-xs text-gray-500">
          Let AI help you create better prompts
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Task Type Selection */}
        <div>
          <label className="label">Prompt Type</label>
          <div className="grid grid-cols-2 gap-2">
            {taskTypes.map((task) => (
              <button
                key={task.id}
                onClick={() => setTaskType(task.id)}
                className={clsx(
                  'p-2 rounded-lg text-left transition-colors border',
                  taskType === task.id
                    ? 'bg-editor-accent/20 border-editor-accent'
                    : 'bg-editor-bg border-transparent hover:border-editor-border'
                )}
              >
                <p className="text-sm font-medium">{task.label}</p>
                <p className="text-xs text-gray-500">{task.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div>
          <label className="label">Describe Your Idea</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              taskType === 'generate'
                ? "E.g., 'a cute cat in space'"
                : taskType === 'edit'
                ? "E.g., 'make the background sunset'"
                : taskType === 'style'
                ? "E.g., 'vintage 80s movie poster'"
                : "E.g., 'find all the people'"
            }
            className="input-field h-24 resize-none"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!input.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Sparkles size={18} />
          Generate Prompt
        </button>

        {/* Generated Prompt */}
        {generatedPrompt && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label">Generated Prompt</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="p-1 hover:bg-editor-hover rounded text-gray-400"
                  title="Copy"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
                <button
                  onClick={handleGenerate}
                  className="p-1 hover:bg-editor-hover rounded text-gray-400"
                  title="Regenerate"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
            <div className="bg-editor-bg rounded-lg p-3">
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{generatedPrompt}</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleUsePrompt}
                className="btn-secondary flex-1 text-sm"
              >
                Add to History
              </button>
              <button
                onClick={handleSaveAsFavorite}
                className="btn-secondary flex-1 text-sm"
              >
                Save as Favorite
              </button>
            </div>
          </div>
        )}

        {/* Prompt Templates */}
        <div>
          <label className="label">Quick Templates</label>
          <div className="space-y-2">
            {promptTemplates
              .filter(t => t.category === (taskType === 'generate' ? 'Generation' : 'Editing'))
              .slice(0, 4)
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => setInput(template.example_filled || template.template)}
                  className="w-full text-left p-3 bg-editor-bg hover:bg-editor-hover rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium">{template.name}</p>
                  <p className="text-xs text-gray-500">{template.description}</p>
                  {template.example_filled && (
                    <p className="text-xs text-gray-400 mt-1 italic truncate">
                      Example: {template.example_filled}
                    </p>
                  )}
                </button>
              ))}
          </div>
        </div>

        {/* Tips */}
        <div className="bg-editor-bg/50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-2">Tips for better prompts:</p>
          <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
            <li>Be specific about subject, style, and mood</li>
            <li>Include lighting and composition details</li>
            <li>Reference specific artists or art styles</li>
            <li>Describe what you DON'T want (negative prompts)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default PromptAssistPanel;
