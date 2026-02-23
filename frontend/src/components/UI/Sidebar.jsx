import React from 'react';
import {
  Sparkles, Wand2, Scissors, ScanSearch, Palette, MessageSquare,
  Workflow, MousePointer, Brush, Square, Circle, Eraser, Move,
  Image, Type
} from 'lucide-react';
import { useEditorStore } from '../../stores/editorStore';
import clsx from 'clsx';

const panels = [
  { id: 'generate', icon: Sparkles, label: 'Generate', description: 'Create images from text' },
  { id: 'edit', icon: Wand2, label: 'Edit', description: 'Edit images with prompts' },
  { id: 'segment', icon: Scissors, label: 'Segment', description: 'Extract objects with masks' },
  { id: 'detect', icon: ScanSearch, label: 'Detect', description: 'Find objects in images' },
  { id: 'styles', icon: Palette, label: 'Styles', description: 'Apply artistic styles' },
  { id: 'text', icon: Type, label: 'Text', description: 'Add text to images' },
  { id: 'memes', icon: Image, label: 'Memes', description: 'Meme templates library' },
  { id: 'prompts', icon: MessageSquare, label: 'AI Assist', description: 'Generate prompts with AI' },
  { id: 'workflows', icon: Workflow, label: 'Workflows', description: 'Saved automation workflows' },
];

const tools = [
  { id: 'select', icon: MousePointer, label: 'Select' },
  { id: 'move', icon: Move, label: 'Move' },
  { id: 'brush', icon: Brush, label: 'Brush' },
  { id: 'eraser', icon: Eraser, label: 'Eraser' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse' },
];

function Sidebar() {
  const { activePanel, setActivePanel, activeTool, setActiveTool } = useEditorStore();

  return (
    <div className="w-16 bg-editor-panel border-r border-editor-border flex flex-col">
      {/* AI Features */}
      <div className="flex-1 py-2 overflow-y-auto">
        <div className="px-2 mb-2">
          <span className="text-[10px] text-gray-500 uppercase">AI</span>
        </div>
        {panels.map((panel) => (
          <button
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={clsx(
              'w-full flex flex-col items-center py-2.5 px-1 transition-colors group relative',
              activePanel === panel.id
                ? 'bg-editor-accent/20 text-editor-accent'
                : 'text-gray-400 hover:text-white hover:bg-editor-hover'
            )}
            title={panel.description}
          >
            <panel.icon size={18} />
            <span className="text-[9px] mt-1 leading-tight">{panel.label}</span>

            {/* Tooltip */}
            <div className="tooltip left-full ml-2 hidden group-hover:block">
              {panel.description}
            </div>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-editor-border mx-2" />

      {/* Canvas Tools */}
      <div className="py-2">
        <div className="px-2 mb-2">
          <span className="text-[10px] text-gray-500 uppercase">Tools</span>
        </div>
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={clsx(
              'w-full flex flex-col items-center py-2.5 px-1 transition-colors group relative',
              activeTool === tool.id
                ? 'bg-editor-accent/20 text-editor-accent'
                : 'text-gray-400 hover:text-white hover:bg-editor-hover'
            )}
            title={tool.label}
          >
            <tool.icon size={16} />

            {/* Tooltip */}
            <div className="tooltip left-full ml-2 hidden group-hover:block">
              {tool.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
