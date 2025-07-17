import React, { useState } from 'react';
import { Folder, FolderPlus } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import TextArea from '../common/TextArea';
import { ReportManagementService } from '../../services/reportManagementService';
import type { CreateFolderRequest } from '../../types/reports';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (folderId: string) => void;
  parentFolderId?: string;
}

const FOLDER_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#10B981' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Gray', value: '#6B7280' },
  { name: 'Indigo', value: '#6366F1' }
];

export function CreateFolderModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  parentFolderId 
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!folderName.trim()) {
      setError('Folder name is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const request: CreateFolderRequest = {
        folder_name: folderName.trim(),
        parent_folder_id: parentFolderId || null,
        description: description.trim() || undefined,
        color: selectedColor,
        icon: 'folder'
      };

      const newFolder = await ReportManagementService.createFolder(request);
      
      // Reset form
      setFolderName('');
      setDescription('');
      setSelectedColor(FOLDER_COLORS[0].value);
      
      onSuccess(newFolder.folder_id);
    } catch (error: any) {
      setError(error.message || 'Failed to create folder');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Folder"
      size="md"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Folder Name <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g., Q4 Reports"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color
          </label>
          <div className="flex gap-2">
            {FOLDER_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => setSelectedColor(color.value)}
                className={`w-8 h-8 rounded-full border-2 ${
                  selectedColor === color.value ? 'border-gray-400' : 'border-gray-200'
                } hover:border-gray-400 transition-colors`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
            {error}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isLoading || !folderName.trim()}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Creating...
            </>
          ) : (
            <>
              <FolderPlus size={16} />
              Create Folder
            </>
          )}
        </Button>
      </div>
    </Modal>
  );
}

export default CreateFolderModal;