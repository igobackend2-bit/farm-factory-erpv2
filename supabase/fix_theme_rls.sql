-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read
CREATE POLICY "Allow Public Read System Settings" 
ON system_settings FOR SELECT 
USING (true);

-- Policy: Admin & CEO can update
-- Note: 'admin' and 'ceo' are roles in the 'profiles' or 'users' convention.
-- Adjust based on actual auth schema. Assuming user metadata or checks.
-- For simplicity in this fix, we allow authenticated users with specific roles.

CREATE POLICY "Allow Admin Update System Settings"
ON system_settings FOR UPDATE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'ceo')
  OR 
  (auth.jwt() ->> 'role') = 'service_role'
);

-- Policy: Allow Insert if not exists (for initial setup)
CREATE POLICY "Allow Admin Insert System Settings"
ON system_settings FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'ceo')
);
