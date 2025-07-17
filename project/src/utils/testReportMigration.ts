import { runFullMigration } from './runReportMigration';
import { ReportManagementService } from '../services/reportManagementService';

export async function testReportMigration() {
  console.log('🧪 Testing Report Management Migration');
  
  try {
    // Step 1: Run the migration
    console.log('\n1. Running migration...');
    const migrationSuccess = await runFullMigration();
    
    if (!migrationSuccess) {
      console.error('❌ Migration failed');
      return false;
    }

    // Step 2: Test folder creation
    console.log('\n2. Testing folder creation...');
    try {
      const testFolder = await ReportManagementService.createFolder({
        folder_name: 'Test Folder',
        parent_folder_id: null,
        description: 'Test folder for migration validation',
        color: '#3B82F6',
        icon: 'folder'
      });
      
      console.log('✅ Folder created successfully:', testFolder.folder_id);
      
      // Step 3: Test folder retrieval
      console.log('\n3. Testing folder retrieval...');
      const folders = await ReportManagementService.getFolderTree();
      console.log('✅ Folder tree retrieved:', folders.length, 'folders');
      
      // Step 4: Test folder cleanup
      console.log('\n4. Cleaning up test folder...');
      await ReportManagementService.deleteFolder(testFolder.folder_id);
      console.log('✅ Test folder cleaned up');
      
    } catch (error) {
      console.error('❌ Folder operations failed:', error);
      return false;
    }
    
    console.log('\n🎉 All tests passed! Migration is working correctly.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (typeof window !== 'undefined' && (window as any).testReportMigration) {
  (window as any).testReportMigration = testReportMigration;
}