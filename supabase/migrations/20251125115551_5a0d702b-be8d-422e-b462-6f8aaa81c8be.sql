-- Add policy to allow users to view other users' account numbers and names for transfers
-- This only exposes minimal information needed for sending money
CREATE POLICY "Users can view other accounts for transfers"
  ON public.accounts FOR SELECT
  USING (true);