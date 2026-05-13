#!/bin/bash
# Apply RLS fix using Supabase CLI

# Make sure you're logged in to Supabase
# npx supabase@latest login

# Push the specific migration
npx supabase@latest db push --include-migration "20260401_fix_onboarding_rls_policies"

echo "RLS policies updated!"
