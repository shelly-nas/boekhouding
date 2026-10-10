-- Tarief dividendbelasting (voorheffing) voor de module geldstromen. Bij een
-- uitkering van de holding aan A. Dreves wordt 15% ingehouden en in box 2
-- verrekend; op dividend aan de holding blijft inhouding achterwege als de
-- deelnemingsvrijstelling geldt (art. 4 Wet DB 1965).
INSERT INTO instelling (sleutel, waarde, omschrijving, bron)
SELECT 'dividendbelasting_pct', 15, 'Dividendbelasting, voorheffing op uitgekeerd dividend',
  'Wet DB 1965; vgl. F39 (€ 472 op € 3.150 bruto); verrekening in box 2: art. 9.2 Wet IB 2001; bij de holding: art. 25 Wet VpB 1969'
WHERE NOT EXISTS (SELECT 1 FROM instelling WHERE sleutel = 'dividendbelasting_pct');
