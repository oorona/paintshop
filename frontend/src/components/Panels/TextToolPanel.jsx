import React, { useState } from 'react';
import { Type, Plus, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Sparkles } from 'lucide-react';
import { useGeminiApi } from '../../hooks/useGeminiApi';
import { useEditorStore } from '../../stores/editorStore';
import { base64ToUrl } from '../../utils/imageUtils';
import clsx from 'clsx';
import toast from 'react-hot-toast';

const FONTS = [
  'Arial',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
];

const COLORS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
];

function TextToolPanel() {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [useStroke, setUseStroke] = useState(true);
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [alignment, setAlignment] = useState('center');
  const [position, setPosition] = useState('top'); // top, center, bottom

  const { editImage } = useGeminiApi();
  const { layers, activeLayerId, addLayer } = useEditorStore();

  const activeLayer = layers.find(l => l.id === activeLayerId);

  // Direct canvas text rendering (no AI)
  const handleAddTextDirect = () => {
    if (!text.trim() || !activeLayer?.image_base64) {
      toast.error('Enter text and select an image layer');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Set font styles
      const fontStyle = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      ctx.font = fontStyle;
      ctx.fillStyle = textColor;
      ctx.textAlign = alignment;

      // Calculate position
      let x, y;
      switch (alignment) {
        case 'left':
          x = 20;
          break;
        case 'right':
          x = canvas.width - 20;
          break;
        default:
          x = canvas.width / 2;
      }

      switch (position) {
        case 'top':
          y = fontSize + 20;
          break;
        case 'bottom':
          y = canvas.height - 20;
          break;
        default:
          y = canvas.height / 2;
      }

      // Draw stroke if enabled
      if (useStroke) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = fontSize / 12;
        ctx.lineJoin = 'round';
        ctx.strokeText(text, x, y);
      }

      // Draw text
      ctx.fillText(text, x, y);

      const base64 = canvas.toDataURL('image/png').split(',')[1];

      addLayer({
        id: `layer-${Date.now()}`,
        name: `Text: ${text.substring(0, 15)}...`,
        type: 'image',
        image_base64: base64,
        visible: true,
        opacity: 1,
        blend_mode: 'normal',
        order: layers.length
      });

      toast.success('Text added!');
    };

    img.src = `data:image/png;base64,${activeLayer.image_base64}`;
  };

  // AI-powered text rendering
  const handleAddTextWithAI = async () => {
    if (!text.trim() || !activeLayer?.image_base64) {
      toast.error('Enter text and select an image layer');
      return;
    }

    try {
      const styleDesc = [
        isBold ? 'bold' : '',
        isItalic ? 'italic' : '',
        `${fontSize}px`,
        fontFamily,
        `${textColor} color`,
        useStroke ? `with ${strokeColor} outline` : '',
      ].filter(Boolean).join(' ');

      const positionDesc = {
        top: 'at the top',
        center: 'in the center',
        bottom: 'at the bottom',
      }[position];

      const alignDesc = {
        left: 'left-aligned',
        center: 'centered',
        right: 'right-aligned',
      }[alignment];

      const prompt = `Add the text "${text}" ${positionDesc} of the image, ${alignDesc}, in ${styleDesc} style. Make sure the text is clearly readable and properly sized for the image.`;

      const result = await editImage(prompt, activeLayer.image_base64);

      if (result.success && result.image_base64) {
        addLayer({
          id: `layer-${Date.now()}`,
          name: `Text: ${text.substring(0, 15)}...`,
          type: 'image',
          image_base64: result.image_base64,
          visible: true,
          opacity: 1,
          blend_mode: 'normal',
          order: layers.length
        });
        toast.success('Text added with AI!');
      }
    } catch (error) {
      toast.error('Failed to add text');
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-editor-border">
        <div className="flex items-center gap-2 mb-2">
          <Type size={18} className="text-editor-accent" />
          <h2 className="font-semibold">Add Text</h2>
        </div>
        <p className="text-xs text-gray-500">
          Add text to your images using AI
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Text Input */}
        <div>
          <label className="label">Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your text..."
            className="input-field h-20 resize-none"
          />
        </div>

        {/* Font Family */}
        <div>
          <label className="label">Font</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="select-field"
          >
            {FONTS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>

        {/* Font Size */}
        <div>
          <label className="label">Size: {fontSize}px</label>
          <input
            type="range"
            min="12"
            max="120"
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Style Buttons */}
        <div>
          <label className="label">Style</label>
          <div className="flex gap-2">
            <button
              onClick={() => setIsBold(!isBold)}
              className={clsx(
                'p-2 rounded transition-colors',
                isBold ? 'bg-editor-accent text-white' : 'bg-editor-bg hover:bg-editor-hover'
              )}
            >
              <Bold size={18} />
            </button>
            <button
              onClick={() => setIsItalic(!isItalic)}
              className={clsx(
                'p-2 rounded transition-colors',
                isItalic ? 'bg-editor-accent text-white' : 'bg-editor-bg hover:bg-editor-hover'
              )}
            >
              <Italic size={18} />
            </button>
            <div className="h-8 w-px bg-editor-border" />
            <button
              onClick={() => setAlignment('left')}
              className={clsx(
                'p-2 rounded transition-colors',
                alignment === 'left' ? 'bg-editor-accent text-white' : 'bg-editor-bg hover:bg-editor-hover'
              )}
            >
              <AlignLeft size={18} />
            </button>
            <button
              onClick={() => setAlignment('center')}
              className={clsx(
                'p-2 rounded transition-colors',
                alignment === 'center' ? 'bg-editor-accent text-white' : 'bg-editor-bg hover:bg-editor-hover'
              )}
            >
              <AlignCenter size={18} />
            </button>
            <button
              onClick={() => setAlignment('right')}
              className={clsx(
                'p-2 rounded transition-colors',
                alignment === 'right' ? 'bg-editor-accent text-white' : 'bg-editor-bg hover:bg-editor-hover'
              )}
            >
              <AlignRight size={18} />
            </button>
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="label">Position</label>
          <div className="flex gap-2">
            {['top', 'center', 'bottom'].map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={clsx(
                  'flex-1 py-2 text-sm rounded capitalize transition-colors',
                  position === pos
                    ? 'bg-editor-accent text-white'
                    : 'bg-editor-bg hover:bg-editor-hover text-gray-400'
                )}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Colors */}
        <div>
          <label className="label">Text Color</label>
          <div className="flex flex-wrap gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setTextColor(color)}
                className={clsx(
                  'w-7 h-7 rounded border-2 transition-colors',
                  textColor === color ? 'border-editor-accent' : 'border-transparent'
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Stroke */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Outline</label>
            <button
              onClick={() => setUseStroke(!useStroke)}
              className={clsx(
                'w-10 h-5 rounded-full transition-colors relative',
                useStroke ? 'bg-editor-accent' : 'bg-editor-border'
              )}
            >
              <div className={clsx(
                'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform',
                useStroke ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </button>
          </div>
          {useStroke && (
            <div className="flex flex-wrap gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setStrokeColor(color)}
                  className={clsx(
                    'w-7 h-7 rounded border-2 transition-colors',
                    strokeColor === color ? 'border-editor-accent' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <label className="label">Preview</label>
          <div className="bg-editor-bg rounded-lg p-4 min-h-[80px] flex items-center justify-center">
            <span
              style={{
                fontFamily,
                fontSize: `${Math.min(fontSize, 32)}px`,
                color: textColor,
                fontWeight: isBold ? 'bold' : 'normal',
                fontStyle: isItalic ? 'italic' : 'normal',
                textAlign: alignment,
                textShadow: useStroke ? `1px 1px 0 ${strokeColor}, -1px -1px 0 ${strokeColor}, 1px -1px 0 ${strokeColor}, -1px 1px 0 ${strokeColor}` : 'none',
              }}
            >
              {text || 'Preview text'}
            </span>
          </div>
        </div>

        {/* Quick Templates */}
        <div>
          <label className="label">Quick Templates</label>
          <div className="space-y-1">
            {[
              { text: 'WHEN YOU', style: 'meme top' },
              { text: 'BOTTOM TEXT', style: 'meme bottom' },
              { text: 'Breaking News:', style: 'news' },
              { text: 'POV:', style: 'pov' },
            ].map((template, i) => (
              <button
                key={i}
                onClick={() => setText(template.text)}
                className="w-full text-left p-2 bg-editor-bg hover:bg-editor-hover rounded text-sm"
              >
                {template.text}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-editor-border space-y-2">
        <button
          onClick={handleAddTextDirect}
          disabled={!text.trim() || !activeLayer?.image_base64}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          Add Text (Direct)
        </button>
        <button
          onClick={handleAddTextWithAI}
          disabled={!text.trim() || !activeLayer?.image_base64}
          className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
        >
          <Sparkles size={16} />
          Add Text with AI
        </button>
        <p className="text-[10px] text-gray-500 text-center">
          Direct adds text instantly. AI may style it better but takes longer.
        </p>
      </div>
    </div>
  );
}

export default TextToolPanel;
