# Dashboard System Test Plan

## Pre-requisites
1. Run migration 035_create_dashboard_schema_corrected.sql
2. Ensure development server is running
3. Have at least one saved report to add to dashboards

## Test Cases

### 1. Dashboard List Page (/dashboards)
- [ ] Page loads without errors
- [ ] Shows "Create Dashboard" button
- [ ] Empty state shown if no dashboards exist
- [ ] Navigation to create new dashboard works

### 2. Create Dashboard (/dashboards/new)
- [ ] Dashboard builder page loads
- [ ] Can add a name and description
- [ ] Shows available reports in sidebar
- [ ] Can drag reports to grid
- [ ] Reports render properly when added
- [ ] Can resize widgets by dragging corners
- [ ] Can move widgets by dragging
- [ ] Save button creates dashboard successfully
- [ ] Redirects to dashboard view after save

### 3. View Dashboard (/dashboards/:id)
- [ ] Dashboard loads with all widgets
- [ ] Reports render with data
- [ ] Layout matches what was saved
- [ ] Edit button visible (if permissions)
- [ ] Back button returns to list

### 4. Edit Dashboard (/dashboards/:id/edit)
- [ ] Loads existing dashboard configuration
- [ ] Can add new widgets
- [ ] Can remove widgets
- [ ] Can reposition/resize widgets
- [ ] Save updates dashboard
- [ ] Cancel returns without saving

### 5. Dashboard Permissions
- [ ] Creator has full access
- [ ] Other users can't see private dashboards
- [ ] Shared dashboards visible to permitted users

### 6. Error Handling
- [ ] 404 shown for non-existent dashboards
- [ ] Proper error messages for failed operations
- [ ] Loading states during data fetching

## Manual Testing Steps

1. **Create a Dashboard**
   ```
   1. Navigate to /dashboards
   2. Click "Create Dashboard"
   3. Enter name: "Sales Overview Q4"
   4. Add 2-3 report widgets
   5. Arrange them in a grid
   6. Click Save
   ```

2. **View the Dashboard**
   ```
   1. Should redirect to /dashboards/[id]
   2. Verify all widgets load
   3. Check responsive behavior
   ```

3. **Edit the Dashboard**
   ```
   1. Click Edit button
   2. Add another widget
   3. Resize a widget
   4. Save changes
   ```

4. **Test Permissions**
   ```
   1. Log in as different user
   2. Try to access the dashboard
   3. Should not see private dashboards
   ```

## Console Checks
- No errors in browser console
- Network requests succeed (200/201 status)
- No TypeScript errors
- Performance: Dashboard loads in < 2 seconds

## Database Verification
Run these queries to verify data:

```sql
-- Check dashboards created
SELECT * FROM dashboards ORDER BY created_at DESC;

-- Check widgets
SELECT * FROM dashboard_widgets ORDER BY created_at DESC;

-- Check permissions
SELECT * FROM dashboard_permissions;
```