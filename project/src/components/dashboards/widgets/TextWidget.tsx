import React, { useState } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import Button from '../../common/Button';

interface TextWidgetProps {
  content: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  markdown?: boolean;
  isEditMode?: boolean;
  onContentChange?: (content: string) => void;
}

export const TextWidget: React.FC<TextWidgetProps> = ({
  content = 'Click to edit text...',
  fontSize = 14,
  fontFamily = 'inherit',
  color = '#374151',
  alignment = 'left',
  markdown = false,
  isEditMode = false,
  onContentChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  const handleSave = () => {
    onContentChange?.(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  if (isEditMode && isEditing) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full p-4 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Enter text content..."
            autoFocus
          />
        </div>
        <div className="flex justify-end space-x-2 mt-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<X size={16} />}
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Check size={16} />}
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`h-full relative group ${isEditMode ? 'cursor-pointer' : ''}`}
      onClick={() => isEditMode && setIsEditing(true)}
    >
      {content ? (
        <div
          className="prose max-w-none h-full overflow-auto"
          style={{
            fontSize,
            fontFamily,
            color,
            textAlign: alignment
          }}
        >
          {markdown ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p className="whitespace-pre-wrap">{content}</p>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Edit2 size={32} className="mx-auto mb-2" />
            <p className="text-sm">Click to add text</p>
          </div>
        </div>
      )}
      
      {isEditMode && !isEditing && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="ghost"
            icon={<Edit2 size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
};