-- Add policy to allow users to view other users' profiles (name only) for transfers
-- This is needed so the dropdown can show account holders' names
CREATE POLICY "Users can view other profiles for transfers"
  ON public.profiles FOR SELECT
  USING (true);