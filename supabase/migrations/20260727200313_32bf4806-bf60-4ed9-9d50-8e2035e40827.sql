
CREATE TABLE public.company_settings (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  cnpj text,
  address text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own company_settings" ON public.company_settings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month text NOT NULL,
  invoice_number int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, client_id, month),
  UNIQUE (owner_id, invoice_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.closings TO authenticated;
GRANT ALL ON public.closings TO service_role;
ALTER TABLE public.closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own closings" ON public.closings FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_or_create_closing(_client_id uuid, _month text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _num int;
  _next int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT invoice_number INTO _num FROM public.closings
    WHERE owner_id = _uid AND client_id = _client_id AND month = _month;
  IF _num IS NOT NULL THEN RETURN _num; END IF;
  SELECT COALESCE(MAX(invoice_number),0)+1 INTO _next FROM public.closings WHERE owner_id = _uid;
  INSERT INTO public.closings (owner_id, client_id, month, invoice_number)
    VALUES (_uid, _client_id, _month, _next);
  RETURN _next;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_closing(uuid, text) TO authenticated;
