import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link,
  Quote,
  Code,
  Heading1,
  Heading2,
  Edit3,
  Palette,
  PaintBucket,
  Type
} from 'lucide-react';

interface RichTextWidgetProps {
  content: string;
  isEditMode?: boolean;
  onContentChange?: (content: string) => void;
}

export const RichTextWidget: React.FC<RichTextWidgetProps> = ({
  content = '',
  isEditMode = false,
  onContentChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [html, setHtml] = useState(content);
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedRange, setSelectedRange] = useState<Range | null>(null);
  const [selectedFont, setSelectedFont] = useState<string>('sans-serif');
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const [showBgColorMenu, setShowBgColorMenu] = useState(false);
  
  // Google Fonts list
  const googleFonts = [
    { name: 'Default', value: 'sans-serif' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Open Sans', value: 'Open Sans' },
    { name: 'Lato', value: 'Lato' },
    { name: 'Montserrat', value: 'Montserrat' },
    { name: 'Poppins', value: 'Poppins' },
    { name: 'Playfair Display', value: 'Playfair Display' },
    { name: 'Merriweather', value: 'Merriweather' },
    { name: 'Inter', value: 'Inter' },
    { name: 'Raleway', value: 'Raleway' },
    { name: 'Source Code Pro', value: 'Source Code Pro' }
  ];
  
  const colors = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FF8800', '#8800FF',
    '#88FF00', '#0088FF', '#FF0088', '#374151', '#6B7280',
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'
  ];

  useEffect(() => {
    setHtml(content);
  }, [content]);
  
  // Load Google Fonts
  useEffect(() => {
    const loadedFonts = new Set<string>();
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    const fontsToLoad = googleFonts
      .filter(f => f.value !== 'sans-serif' && !loadedFonts.has(f.value))
      .map(f => {
        loadedFonts.add(f.value);
        return f.value.replace(' ', '+') + ':400,700';
      })
      .join('|');
    
    if (fontsToLoad) {
      link.href = `https://fonts.googleapis.com/css2?family=${fontsToLoad}&display=swap`;
      document.head.appendChild(link);
    }
    
    return () => {
      if (link.parentNode) {
        document.head.removeChild(link);
      }
    };
  }, []);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      setSelectedRange(selection.getRangeAt(0));
    }
  };

  const restoreSelection = () => {
    if (selectedRange && editorRef.current) {
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
    }
  };

  const execCommand = (command: string, value?: string) => {
    restoreSelection();
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setHtml(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  };
  
  const applyFont = (font: string) => {
    restoreSelection();
    // Wrap selection in a span with the font
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontFamily = font;
      
      try {
        range.surroundContents(span);
      } catch (e) {
        // If surroundContents fails, use execCommand
        document.execCommand('fontName', false, font);
      }
    }
    
    if (editorRef.current) {
      setHtml(editorRef.current.innerHTML);
    }
    setShowFontMenu(false);
    editorRef.current?.focus();
  };
  
  const applyColor = (color: string, isBackground: boolean = false) => {
    restoreSelection();
    if (isBackground) {
      document.execCommand('backColor', false, color);
    } else {
      document.execCommand('foreColor', false, color);
    }
    if (editorRef.current) {
      setHtml(editorRef.current.innerHTML);
    }
    setShowColorMenu(false);
    setShowBgColorMenu(false);
    editorRef.current?.focus();
  };

  const formatBlock = (tag: string) => {
    restoreSelection();
    document.execCommand('formatBlock', false, tag);
    if (editorRef.current) {
      setHtml(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  };

  const createLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleSave = () => {
    if (editorRef.current) {
      const finalContent = editorRef.current.innerHTML;
      onContentChange?.(finalContent);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setHtml(content);
    setIsEditing(false);
  };

  const toolbar = (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <div className="relative">
          <button
            onClick={() => {
              saveSelection();
              setShowFontMenu(!showFontMenu);
              setShowColorMenu(false);
              setShowBgColorMenu(false);
            }}
            className="p-2 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
            title="Font Family"
          >
            <Type size={18} />
            <span className="text-xs">▼</span>
          </button>
          {showFontMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
              {googleFonts.map(font => (
                <button
                  key={font.value}
                  onClick={() => {
                    applyFont(font.value);
                    setSelectedFont(font.value);
                  }}
                  className="block w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors"
                  style={{ fontFamily: font.value }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <button
          onClick={() => formatBlock('h1')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Heading 1"
        >
          <Heading1 size={18} />
        </button>
        <button
          onClick={() => formatBlock('h2')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>
        <button
          onClick={() => formatBlock('p')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Paragraph"
        >
          P
        </button>
      </div>

      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <button
          onClick={() => execCommand('bold')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bold"
        >
          <Bold size={18} />
        </button>
        <button
          onClick={() => execCommand('italic')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Italic"
        >
          <Italic size={18} />
        </button>
        <button
          onClick={() => execCommand('underline')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Underline"
        >
          <Underline size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <button
          onClick={() => execCommand('justifyLeft')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Align Left"
        >
          <AlignLeft size={18} />
        </button>
        <button
          onClick={() => execCommand('justifyCenter')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Align Center"
        >
          <AlignCenter size={18} />
        </button>
        <button
          onClick={() => execCommand('justifyRight')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Align Right"
        >
          <AlignRight size={18} />
        </button>
        <button
          onClick={() => execCommand('justifyFull')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Justify"
        >
          <AlignJustify size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <button
          onClick={() => execCommand('insertUnorderedList')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Bullet List"
        >
          <List size={18} />
        </button>
        <button
          onClick={() => execCommand('insertOrderedList')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </button>
      </div>

      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <button
          onClick={createLink}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Insert Link"
        >
          <Link size={18} />
        </button>
        <button
          onClick={() => formatBlock('blockquote')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Quote"
        >
          <Quote size={18} />
        </button>
        <button
          onClick={() => formatBlock('pre')}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Code Block"
        >
          <Code size={18} />
        </button>
      </div>
      
      <div className="flex items-center gap-1">
        <div className="relative">
          <button
            onClick={() => {
              saveSelection();
              setShowColorMenu(!showColorMenu);
              setShowFontMenu(false);
              setShowBgColorMenu(false);
            }}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Text Color"
          >
            <Palette size={18} />
          </button>
          {showColorMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 p-2">
              <div className="grid grid-cols-5 gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => applyColor(color)}
                    className="w-8 h-8 rounded border border-gray-300 hover:border-gray-500 transition-colors"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="relative">
          <button
            onClick={() => {
              saveSelection();
              setShowBgColorMenu(!showBgColorMenu);
              setShowFontMenu(false);
              setShowColorMenu(false);
            }}
            className="p-2 hover:bg-gray-200 rounded transition-colors"
            title="Background Color"
          >
            <PaintBucket size={18} />
          </button>
          {showBgColorMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 p-2">
              <div className="grid grid-cols-5 gap-1">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => applyColor(color, true)}
                    className="w-8 h-8 rounded border border-gray-300 hover:border-gray-500 transition-colors"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={handleCancel}
          className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-1 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );

  // Initialize editor content when entering edit mode
  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.innerHTML = html;
      editorRef.current.focus();
      
      // Ensure text direction is correct
      const style = window.getComputedStyle(editorRef.current);
      console.log('Editor styles:', {
        direction: style.direction,
        writingMode: style.writingMode,
        transform: style.transform
      });
    }
  }, [isEditing]);

  if (isEditMode && isEditing) {
    return (
      <div className="h-full flex flex-col bg-white rounded-lg overflow-hidden">
        {toolbar}
        <div
          ref={editorRef}
          contentEditable
          className="p-4 overflow-auto focus:outline-none"
          style={{
            fontFamily: selectedFont,
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#374151',
            minHeight: '200px',
            height: 'calc(100% - 60px)', // Subtract toolbar height
            direction: 'ltr',
            unicodeBidi: 'normal',
            textAlign: 'left',
            writingMode: 'horizontal-tb',
            transform: 'none',
            WebkitTransform: 'none'
          }}
          onInput={(e) => {
            if (editorRef.current) {
              setHtml(editorRef.current.innerHTML);
            }
          }}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          suppressContentEditableWarning={true}
        />
      </div>
    );
  }

  return (
    <div 
      className={`h-full relative group ${isEditMode ? 'cursor-pointer' : ''}`}
      onClick={() => isEditMode && setIsEditing(true)}
      style={{ minHeight: '40px' }}
    >
      {content ? (
        <div
          className="h-full overflow-auto p-2"
          style={{
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#374151',
            minHeight: '100%'
          }}
        >
          <div 
            className="rich-text-widget-content"
            dangerouslySetInnerHTML={{ __html: content }} 
            style={{
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}
          />
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Edit3 size={32} className="mx-auto mb-2" />
            <p className="text-sm">Click to add rich text content</p>
          </div>
        </div>
      )}
      
      {isEditMode && !isEditing && content && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="px-3 py-1 bg-gray-800 text-white text-sm rounded hover:bg-gray-700 transition-colors flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            <Edit3 size={14} />
            Edit
          </button>
        </div>
      )}
    </div>
  );
};