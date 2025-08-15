-- Backfill commission for existing rows in vision_ophta
UPDATE public.vision_ophta
SET commission = CASE
  WHEN "CXL" = true AND "PTK" = true THEN 770
  WHEN "CXL" = true AND ("PTK" = false OR "PTK" IS NULL) THEN 460
  WHEN "PTK" = true AND ("CXL" = false OR "CXL" IS NULL) THEN 310
  ELSE COALESCE(montant * 0.55, 0)
END;