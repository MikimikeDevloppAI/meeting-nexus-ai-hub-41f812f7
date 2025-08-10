-- Insert reference products into produit_injection
INSERT INTO public.produit_injection (produit, molecule, fabricant, concentration, presentation, prix_patient, prix_achat, representant, telephone, email, seuil_alerte)
VALUES
  ('Eylea 8mg','Aflibercept','Bayer','8mg/0.07ml','Préchargé',936.40,870.8,'Mr GIRARD Michel','079 257 64 59','michel.girard@bayer.com',0),
  ('Eylea 2mg','Aflibercept','Bayer','2mg/0.05ml','Préchargé',936.40,NULL,NULL,NULL,NULL,0),
  ('Vabysmo','Faricimab','Roche','6mg/0.05ml','Préchargé',920.00,861.06,'Mme DELAJOUD Anaïs','079 291 37 52','anais.delajoud@roche.com',0),
  ('Lucentis','Ranibizumab','Novartis','2.3mg/0.23ml','Préchargé',677.60,NULL,'Mr FURRER Adrian','0041 800 808 190','adrian.furrer@novartis.com',0),
  ('Beovu','Brolucizumab','Novartis','6mg/0.05ml','Préchargé',726.50,NULL,NULL,NULL,NULL,0),
  ('Avastin','Bévacizumab','Roche','100mg/4ml','Flacon',322.95,NULL,NULL,NULL,NULL,0),
  ('Ozurdex','Dexaméthason','Abbvie','1 pièce','Préchargé',1203.65,NULL,NULL,NULL,NULL,0),
  ('Byooviz','Ranibizumab','Samsung','2.3mg/0.23ml','Flacon',620.60,NULL,NULL,NULL,NULL,0),\
  ('Ranivisio','Ranibizumab','Bioeq','2.3mg/0.23ml','Flacon',620.60,NULL,NULL,NULL,NULL,0),
  ('Ximluci','Ranibizumab','Spirig','2.3mg/0.23ml','Flacon',544.60,NULL,NULL,NULL,NULL,0);
