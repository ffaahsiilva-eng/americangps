
CREATE TABLE public.sale_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  note_number integer NOT NULL,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text,
  total numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_notes TO authenticated;
GRANT ALL ON public.sale_notes TO service_role;

ALTER TABLE public.sale_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own sale_notes" ON public.sale_notes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE INDEX idx_sale_notes_client ON public.sale_notes(client_id, occurred_at DESC);
CREATE INDEX idx_sale_notes_owner ON public.sale_notes(owner_id, occurred_at DESC);

ALTER TABLE public.sales ADD COLUMN note_id uuid REFERENCES public.sale_notes(id) ON DELETE CASCADE;
CREATE INDEX idx_sales_note ON public.sales(note_id);

CREATE OR REPLACE FUNCTION public.create_sale_note(
  _client_id uuid,
  _occurred_at date,
  _payment_method text,
  _paid boolean,
  _items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _next int;
  _note_id uuid;
  _total numeric := 0;
  _item jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'items required';
  END IF;

  SELECT COALESCE(MAX(note_number),0)+1 INTO _next
    FROM public.sale_notes WHERE owner_id = _uid;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _total := _total + COALESCE((_item->>'amount')::numeric, 0);
  END LOOP;

  INSERT INTO public.sale_notes (owner_id, client_id, note_number, occurred_at, payment_method, total, paid)
    VALUES (_uid, _client_id, _next, _occurred_at, _payment_method, _total, _paid)
    RETURNING id INTO _note_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.sales (owner_id, client_id, note_id, kind, description, amount, occurred_at, paid, payment_method)
    VALUES (
      _uid, _client_id, _note_id,
      _item->>'kind',
      _item->>'description',
      (_item->>'amount')::numeric,
      _occurred_at,
      _paid,
      _payment_method
    );
  END LOOP;

  RETURN jsonb_build_object('note_id', _note_id, 'note_number', _next, 'total', _total);
END;
$$;
