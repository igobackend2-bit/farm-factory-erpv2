# MOBILE APP FULL REVAMP PLAN
## IGO Group ERP Mobile Application Enhancement

### Current Issues Identified
1. **LOP/Discipline Display**: Shows "0" values instead of actual LOP entries
2. **Report  Error**: "Could not fiSubmission Block**: Cannot submit reports without a "plan" 
3. **Payslipnd table 'public.payslips'" - table missing
4. **Request History**: No history display in request pages
5. **Payment Types**: Need 3 payment types like ERP web app
6. **Chat Integration**: ERP team communication needs separate tab

### Database Schema Updates Required

#### 1. Create Missing Tables
```sql
-- Payslips table
CREATE TABLE public.payslips (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    salary_month text NOT NULL,
    net_pay numeric(10,2) NOT NULL,
    paid_on date,
    file_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Payment types table (if not exists)
CREATE TABLE public.payment_types (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- Insert default payment types
INSERT INTO public.payment_types (name, description) VALUES
('Salary', 'Monthly salary payment'),
('Advance', 'Salary advance payment'),
('Reimbursement', 'Expense reimbursement');

-- Chat messages table (verify exists)
-- Already exists from migrations
```

#### 2. Enable RLS Policies
```sql
-- Payslips RLS
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payslips" ON public.payslips
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "HR can manage all payslips" ON public.payslips
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('hr', 'admin', 'ceo')
        )
    );

-- Payment types RLS
ALTER TABLE public.payment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active payment types" ON public.payment_types
    FOR SELECT USING (is_active = true);
```

### Code Changes Required

#### 1. LOP/Discipline Screen Enhancement
- **File**: `src/screens/requests/LOPReversalScreen.tsx`
- **Issue**: Currently shows summary but may not display individual entries properly
- **Fix**: Ensure proper data fetching and display of LOP history

#### 2. Report Submission Logic
- **Files**: Work report screens (`HourlyPlanReportScreen.tsx`, `EODReportScreen.tsx`)
- **Issue**: Blocks submission without "plan"
- **Fix**: Add plan validation logic or remove unnecessary requirement

#### 3. Payslip Screen Fix
- **File**: `src/screens/profile/PayslipScreen.tsx`
- **Issue**: Queries non-existent `payslips` table
- **Fix**: Update to use correct table name or create table

#### 4. Request History Enhancement
- **Files**: `src/screens/requests/TripListScreen.tsx`, `RequestsHomeScreen.tsx`
- **Issue**: No history display
- **Fix**: Add history sections showing past requests

#### 5. Payment Types Implementation
- **Files**: Payment request screens
- **Issue**: Only one payment type
- **Fix**: Add payment type selection with 3 options

#### 6. Chat Tab Addition
- **File**: `src/navigation/AppNavigator.tsx`
- **Issue**: Chat is under "More" menu
- **Fix**: Create separate "Chat" tab in main navigation

### New Screens/Components Needed

#### 1. LOP History Screen
```typescript
// src/screens/profile/LOPHistoryScreen.tsx
- Display detailed LOP entries
- Show total days, pending reversals
- Allow reversal requests
```

#### 2. Payment Types Selector
```typescript
// src/components/PaymentTypeSelector.tsx
- Dropdown/selector for 3 payment types
- Salary, Advance, Reimbursement
```

#### 3. Request History Component
```typescript
// src/components/RequestHistory.tsx
- Show past travel requests
- Show past leave requests
- Filter by status/date
```

#### 4. Enhanced Chat Screen
```typescript
// src/screens/chat/ERPChatScreen.tsx
- Real-time messaging
- Group chat for ERP team
- File sharing capabilities
```

### Navigation Updates

#### Main Tab Navigator Changes
```typescript
// Add Chat tab to main navigation
<Tab.Screen
    name="Chat"
    component={ChatStackNavigator}
    options={{ title: 'Chat' }}
/>
```

### API/Service Updates

#### 1. Supabase Service Extensions
- Add payslip queries
- Add payment type queries
- Enhance chat message handling

#### 2. Data Fetching Hooks
```typescript
// src/hooks/useLOPData.ts
- Fetch LOP entries with proper error handling

// src/hooks/usePaymentTypes.ts
- Fetch available payment types

// src/hooks/useRequestHistory.ts
- Fetch historical requests
```

### UI/UX Improvements

#### 1. Design System Consistency
- Apply `AppScreen` wrapper to all screens
- Use unified `Button` and `Input` components
- Consistent spacing and colors

#### 2. Loading States
- Add skeleton loaders for data fetching
- Improve error handling UI

#### 3. Offline Support
- Cache critical data for offline viewing
- Sync when online

### Testing Requirements

#### 1. Database Testing
- Verify table creation
- Test RLS policies
- Check data relationships

#### 2. UI Testing
- Test all new screens
- Verify navigation flows
- Check responsive design

#### 3. Integration Testing
- Test payment flows
- Test chat functionality
- Test LOP reversal process

### Deployment Plan

#### Phase 1: Database Updates
1. Create missing tables
2. Add RLS policies
3. Migrate existing data if needed

#### Phase 2: Core Fixes
1. Fix payslip table reference
2. Fix LOP data display
3. Fix report submission logic

#### Phase 3: Feature Additions
1. Add payment types
2. Add request history
3. Add chat tab

#### Phase 4: UI Polish
1. Apply design system
2. Add loading states
3. Test all flows

#### Phase 5: Testing & Deployment
1. QA testing
2. Performance testing
3. APK build and Play Store submission

### Timeline Estimate
- **Database Setup**: 1-2 days
- **Core Bug Fixes**: 2-3 days
- **New Features**: 3-4 days
- **UI Polish**: 1-2 days
- **Testing**: 2-3 days
- **Total**: 9-14 days

### Dependencies
- Supabase CLI for migrations
- Expo CLI for testing
- EAS Build for APK generation
- Google Play Console access

### Risk Assessment
- **High**: Database schema changes could affect existing data
- **Medium**: Navigation changes may break existing flows
- **Low**: UI component additions are isolated

### Success Criteria
1. LOP shows actual data instead of zeros
2. Reports can be submitted without plan issues
3. Payslips load without errors
4. Request history is visible
5. 3 payment types available
6. Chat has dedicated tab
7. All screens use consistent design
8. APK builds successfully
9. Play Store submission ready