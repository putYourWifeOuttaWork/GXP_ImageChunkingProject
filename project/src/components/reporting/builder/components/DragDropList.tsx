/**
 * DragDropList - Native HTML5 drag and drop implementation
 * Compatible with React 18 and doesn't require external dependencies
 */

import React, { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface DragDropListProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  keyExtractor: (item: T) => string;
  className?: string;
  dropZoneClassName?: string;
}

export function DragDropList<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  className = '',
  dropZoneClassName = ''
}: DragDropListProps<T>) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropZoneIndex, setDropZoneIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set some data to make it valid, but we'll use state instead
    e.dataTransfer.setData('text/plain', 'dragging');
    
    // Add drag image styling
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null);
    setDropZoneIndex(null);
    
    // Reset styling
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropZoneIndex(index);
  };

  const handleDragLeave = () => {
    setDropZoneIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    // Use draggedIndex from state instead of dataTransfer
    if (draggedIndex === null) {
      console.error('No dragged index found in state');
      return;
    }
    
    const dragIndex = draggedIndex;
    
    // Validate indices
    if (dragIndex < 0 || dragIndex >= items.length) {
      console.error('Invalid drag index:', dragIndex, 'items length:', items.length);
      return;
    }
    
    if (dropIndex < 0 || dropIndex >= items.length) {
      console.error('Invalid drop index:', dropIndex, 'items length:', items.length);
      return;
    }
    
    if (dragIndex !== dropIndex) {
      const newItems = [...items];
      const draggedItem = newItems[dragIndex];
      
      if (!draggedItem) {
        console.error('Dragged item not found at index:', dragIndex);
        return;
      }
      
      // Remove dragged item
      newItems.splice(dragIndex, 1);
      
      // Insert at new position (adjust drop index if necessary)
      const adjustedDropIndex = dragIndex < dropIndex ? dropIndex - 1 : dropIndex;
      newItems.splice(adjustedDropIndex, 0, draggedItem);
      
      onReorder(newItems);
    }
    
    setDraggedIndex(null);
    setDropZoneIndex(null);
  };

  return (
    <div className={className}>
      {items.map((item, index) => {
        const isDragging = draggedIndex === index;
        const isDropZone = dropZoneIndex === index;
        
        return (
          <div
            key={keyExtractor(item)}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            className={`
              transition-all duration-200 cursor-move
              ${isDragging ? 'opacity-50 scale-105 shadow-lg' : ''}
              ${isDropZone ? dropZoneClassName : ''}
            `}
          >
            {renderItem(item, index, isDragging)}
          </div>
        );
      })}
    </div>
  );
}

interface DraggableItemProps {
  children: React.ReactNode;
  className?: string;
  dragHandleClassName?: string;
}

export const DraggableItem: React.FC<DraggableItemProps> = ({
  children,
  className = '',
  dragHandleClassName = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      <div className={`absolute left-2 top-2 cursor-grab active:cursor-grabbing hover:bg-gray-100 p-1 rounded ${dragHandleClassName}`}>
        <GripVertical size={16} className="text-gray-400 hover:text-gray-600" />
      </div>
      <div className="pl-8">
        {children}
      </div>
    </div>
  );
};