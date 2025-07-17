import React, { useState, useEffect } from 'react';
import { Users, Mail, Shield, Eye, X } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import { ReportManagementService } from '../../services/reportManagementService';
import type { FolderTreeNode, FolderPermissionLevel } from '../../types/reports';

interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FolderTreeNode;
  onSuccess: () => void;
}

interface FolderPermissionUser {
  permission_id: string;
  user_id: string;
  permission_level: FolderPermissionLevel;
  user: {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
  };
}

export function ShareFolderModal({
  isOpen,
  onClose,
  folder,
  onSuccess
}: ShareFolderModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [existingPermissions, setExistingPermissions] = useState<FolderPermissionUser[]>([]);
  const [newEmails, setNewEmails] = useState('');
  const [newPermissionLevel, setNewPermissionLevel] = useState<FolderPermissionLevel>('viewer');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && folder) {
      loadExistingPermissions();
    }
  }, [isOpen, folder]);

  const loadExistingPermissions = async () => {
    try {
      setIsLoading(true);
      const permissions = await ReportManagementService.getFolderPermissions(folder.folder_id);
      setExistingPermissions(permissions as FolderPermissionUser[]);
    } catch (error) {
      console.error('Error loading permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emails = newEmails
      .split(/[,\s]+/)
      .map(email => email.trim())
      .filter(email => email && email.includes('@'));

    if (emails.length === 0) {
      setError('Please enter at least one valid email address');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await ReportManagementService.shareFolder({
        folder_id: folder.folder_id,
        user_emails: emails,
        permission_level: newPermissionLevel
      });

      setNewEmails('');
      loadExistingPermissions();
      onSuccess();
    } catch (error: any) {
      console.error('Error sharing folder:', error);
      setError(error.message || 'Failed to share folder');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemovePermission = async (permissionId: string) => {
    if (!confirm('Remove this user\'s access to the folder?')) return;

    try {
      // Note: You'll need to add this method to ReportManagementService
      await supabase
        .from('report_folder_permissions')
        .delete()
        .eq('permission_id', permissionId);
      
      loadExistingPermissions();
    } catch (error) {
      console.error('Error removing permission:', error);
    }
  };

  const getPermissionIcon = (level: FolderPermissionLevel) => {
    switch (level) {
      case 'admin':
        return <Shield size={16} className="text-purple-600" />;
      case 'viewer':
        return <Eye size={16} className="text-blue-600" />;
      default:
        return null;
    }
  };

  const getPermissionLabel = (level: FolderPermissionLevel) => {
    switch (level) {
      case 'admin':
        return 'Admin - Can edit, delete, and share';
      case 'viewer':
        return 'Viewer - Can view reports only';
      default:
        return 'No access';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Share "${folder.folder_name}"`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Add new users */}
        <form onSubmit={handleShare}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Share with users
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newEmails}
                  onChange={(e) => setNewEmails(e.target.value)}
                  placeholder="Enter email addresses (comma separated)"
                  className="flex-1"
                />
                <Select
                  value={newPermissionLevel}
                  onChange={(e) => setNewPermissionLevel(e.target.value as FolderPermissionLevel)}
                  className="w-40"
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </Select>
                <Button
                  type="submit"
                  disabled={isSaving || !newEmails.trim()}
                >
                  Share
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Users will have access to all reports in this folder
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>
        </form>

        {/* Existing permissions */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            People with access
          </h3>
          
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : existingPermissions.length > 0 ? (
            <div className="space-y-2">
              {existingPermissions.map(permission => (
                <div
                  key={permission.permission_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                      {permission.user.avatar_url ? (
                        <img
                          src={permission.user.avatar_url}
                          alt={permission.user.full_name || permission.user.email}
                          className="w-full h-full rounded-full"
                        />
                      ) : (
                        <Users size={20} className="text-gray-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {permission.user.full_name || permission.user.email}
                      </div>
                      <div className="text-sm text-gray-500">
                        {permission.user.email}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      {getPermissionIcon(permission.permission_level)}
                      <span className="text-gray-600">
                        {permission.permission_level === 'admin' ? 'Admin' : 'Viewer'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemovePermission(permission.permission_id)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Remove access"
                    >
                      <X size={16} className="text-gray-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users size={48} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No users have been shared with yet</p>
            </div>
          )}
        </div>

        {/* Permission levels explanation */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Permission Levels</h4>
          <div className="space-y-2 text-sm text-blue-800">
            <div className="flex items-start gap-2">
              <Shield size={16} className="text-purple-600 mt-0.5" />
              <div>
                <strong>Admin:</strong> {getPermissionLabel('admin')}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Eye size={16} className="text-blue-600 mt-0.5" />
              <div>
                <strong>Viewer:</strong> {getPermissionLabel('viewer')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
        <Button
          variant="secondary"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </Modal>
  );
}

// Add missing import
import { supabase } from '../../lib/supabaseClient';

export default ShareFolderModal;