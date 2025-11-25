-- Add UPDATE policy for accounts so users can update their own account balance
CREATE POLICY "Users can update own accounts"
  ON public.accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);