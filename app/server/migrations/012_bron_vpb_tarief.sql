-- Bron van het VpB-tarief aangescherpt na controle (2026-09-27): het tarief
-- staat in art. 22 (hoofdstuk V "Tarief"); dat het in lid 1 staat, is niet
-- nagelezen. Tarief 2026 bevestigd door de Belastingdienst (19% t/m € 200.000,
-- 25,8% daarboven, ongewijzigd t.o.v. 2025).
UPDATE instelling
SET bron = 'art. 22 Wet VpB 1969; tarief 2026 bevestigd op belastingdienst.nl (Veranderingen vennootschapsbelasting 2026), geraadpleegd 2026-09-27'
WHERE sleutel = 'vpb_tarief_laag' AND bron = 'art. 22 lid 1 Wet VpB 1969';
