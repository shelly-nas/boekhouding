-- Tarief vennootschapsbelasting, eerste schijf, voor de module Overdracht:
-- belasting op dividend bij de holding als de deelnemingsvrijstelling niet
-- van toepassing is (V-F19).
INSERT INTO instelling (sleutel, waarde, omschrijving, bron)
SELECT 'vpb_tarief_laag', 19, 'VpB-tarief over de eerste € 200.000 belastbare winst (2026)', 'art. 22 lid 1 Wet VpB 1969'
WHERE NOT EXISTS (SELECT 1 FROM instelling WHERE sleutel = 'vpb_tarief_laag');
