-- 1. Account freeze support
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS frozen_reason TEXT;

-- 2. Transaction linkage / reversal tracking
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS transfer_group UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS transactions_transfer_group_idx ON public.transactions(transfer_group);

-- transactions need UPDATE privilege for the security definer functions / owner writes
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;

-- 3. Auto freeze / unfreeze based on negative balance
CREATE OR REPLACE FUNCTION public.enforce_negative_balance_freeze()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.balance < 0 THEN
    NEW.is_frozen := true;
    NEW.frozen_reason := 'Account frozen: negative balance after a payment reversal. It will unfreeze automatically once the balance is cleared.';
  ELSIF NEW.balance >= 0 AND OLD.is_frozen IS TRUE AND OLD.balance < 0 THEN
    NEW.is_frozen := false;
    NEW.frozen_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS accounts_negative_balance_freeze ON public.accounts;
CREATE TRIGGER accounts_negative_balance_freeze
BEFORE UPDATE OF balance ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.enforce_negative_balance_freeze();

-- 4. Atomic transfer: debits sender, credits recipient
CREATE OR REPLACE FUNCTION public.transfer_money(
  p_recipient_account TEXT,
  p_recipient_name TEXT,
  p_amount NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_sender public.accounts;
  v_recipient public.accounts;
  v_group UUID := gen_random_uuid();
  v_sender_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_sender FROM public.accounts WHERE user_id = v_uid FOR UPDATE;
  IF v_sender.id IS NULL THEN
    RAISE EXCEPTION 'Your account was not found';
  END IF;

  IF v_sender.is_frozen THEN
    RAISE EXCEPTION 'Your account is frozen and cannot send money until the balance is cleared';
  END IF;

  IF v_sender.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  SELECT * INTO v_recipient FROM public.accounts
   WHERE account_number = p_recipient_account FOR UPDATE;

  IF v_recipient.id IS NULL THEN
    RAISE EXCEPTION 'Recipient account number not found';
  END IF;

  IF v_recipient.id = v_sender.id THEN
    RAISE EXCEPTION 'You cannot send money to your own account';
  END IF;

  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = v_uid;

  UPDATE public.accounts SET balance = balance - p_amount WHERE id = v_sender.id;
  UPDATE public.accounts SET balance = balance + p_amount WHERE id = v_recipient.id;

  INSERT INTO public.transactions
    (account_id, user_id, type, amount, recipient_account, recipient_name, description, status, transfer_group)
  VALUES
    (v_sender.id, v_uid, 'debit', p_amount, p_recipient_account, p_recipient_name,
     COALESCE(NULLIF(p_description, ''), 'Money transfer'), 'completed', v_group);

  INSERT INTO public.transactions
    (account_id, user_id, type, amount, recipient_account, recipient_name, description, status, transfer_group)
  VALUES
    (v_recipient.id, v_recipient.user_id, 'credit', p_amount, v_sender.account_number,
     COALESCE(v_sender_name, 'SAI Bank user'),
     'Received from ' || COALESCE(v_sender_name, 'SAI Bank user'), 'completed', v_group);

  RETURN jsonb_build_object('success', true, 'transfer_group', v_group);
END;
$$;

-- 5. Reversal within 24 hours, pulls back from recipient even into negative balance
CREATE OR REPLACE FUNCTION public.reverse_transaction(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tx public.transactions;
  v_sender public.accounts;
  v_recipient public.accounts;
  v_new_recipient_balance NUMERIC;
  v_sender_name TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_tx FROM public.transactions
   WHERE id = p_transaction_id AND user_id = v_uid FOR UPDATE;

  IF v_tx.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_tx.type <> 'debit' OR v_tx.is_reversal THEN
    RAISE EXCEPTION 'Only outgoing payments can be reversed';
  END IF;

  IF v_tx.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'This payment has already been reversed';
  END IF;

  IF now() - v_tx.created_at > INTERVAL '24 hours' THEN
    RAISE EXCEPTION 'This payment can no longer be reversed (24 hour window has passed)';
  END IF;

  SELECT * INTO v_sender FROM public.accounts WHERE id = v_tx.account_id FOR UPDATE;
  IF v_sender.id IS NULL OR v_sender.user_id <> v_uid THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  SELECT * INTO v_recipient FROM public.accounts
   WHERE account_number = v_tx.recipient_account FOR UPDATE;

  IF v_recipient.id IS NULL THEN
    RAISE EXCEPTION 'Recipient account not found, this payment cannot be reversed automatically';
  END IF;

  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = v_uid;

  -- take the money back from the recipient, allowing a negative balance
  UPDATE public.accounts SET balance = balance - v_tx.amount
   WHERE id = v_recipient.id
   RETURNING balance INTO v_new_recipient_balance;

  UPDATE public.accounts SET balance = balance + v_tx.amount WHERE id = v_sender.id;

  UPDATE public.transactions SET reversed_at = now(), status = 'reversed'
   WHERE id = v_tx.id;

  IF v_tx.transfer_group IS NOT NULL THEN
    UPDATE public.transactions SET reversed_at = now(), status = 'reversed'
     WHERE transfer_group = v_tx.transfer_group AND type = 'credit' AND is_reversal = false;
  END IF;

  INSERT INTO public.transactions
    (account_id, user_id, type, amount, recipient_account, recipient_name, description, status, transfer_group, is_reversal)
  VALUES
    (v_sender.id, v_uid, 'credit', v_tx.amount, v_tx.recipient_account, v_tx.recipient_name,
     'Wrong payment reversed - amount restored', 'completed', v_tx.transfer_group, true);

  INSERT INTO public.transactions
    (account_id, user_id, type, amount, recipient_account, recipient_name, description, status, transfer_group, is_reversal)
  VALUES
    (v_recipient.id, v_recipient.user_id, 'debit', v_tx.amount, v_sender.account_number,
     COALESCE(v_sender_name, 'SAI Bank user'),
     'Wrong payment reversed - amount returned to sender', 'completed', v_tx.transfer_group, true);

  RETURN jsonb_build_object(
    'success', true,
    'recipient_balance', v_new_recipient_balance,
    'recipient_frozen', v_new_recipient_balance < 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_money(TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reverse_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_money(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_transaction(UUID) TO authenticated;