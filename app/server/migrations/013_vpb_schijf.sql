-- VpB-tarief tweede schijf en de schijfgrens, voor de VpB-berekening van de
-- holding (fase B). Bevestigd op belastingdienst.nl, geraadpleegd 2026-09-27:
-- 2026 t/m € 200.000 19%, daarboven 25,8%, ongewijzigd t.o.v. 2025.
INSERT INTO instelling (sleutel, waarde, omschrijving, bron)
SELECT v.sleutel, v.waarde, v.omschrijving, v.bron
FROM (VALUES
  ('vpb_tarief_hoog', 25.8, 'VpB-tarief boven de schijfgrens (2025 en 2026)',
   'art. 22 Wet VpB 1969; tarief bevestigd op belastingdienst.nl (Veranderingen vennootschapsbelasting 2026), geraadpleegd 2026-09-27'),
  ('vpb_schijfgrens', 200000, 'Grens eerste schijf VpB (2025 en 2026); niet verhoogd bij een verlengd boekjaar',
   'art. 22 Wet VpB 1969; bedrag bevestigd op belastingdienst.nl, geraadpleegd 2026-09-27')
) AS v (sleutel, waarde, omschrijving, bron)
WHERE NOT EXISTS (SELECT 1 FROM instelling i WHERE i.sleutel = v.sleutel);
