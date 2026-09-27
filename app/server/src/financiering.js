// Financiering: alle leningen van de eigen partijen, privé en holding, in één
// overzicht. Een lening met een grootboekrekening wordt in de administratie
// van de holding geboekt; daar is het journaal leidend voor de aflossingen.
// Zonder grootboekrekening tellen de aflossingen uit de stamdata.
import { pool } from './db.js';
import { leningMutaties } from './administratie.js';
import { dividendToets, plusJaren, schuldOp, schuldverloop } from './rekenen.js';

const vandaag = () => new Date().toISOString().slice(0, 10);
const q = (sql, p = []) => pool.query(sql, p).then((r) => r.rows);

// Aflossingen per lening, volgens de bron die voor die lening leidend is.
export async function aflossingenPerLening(leningen) {
  const [holding] = await q("SELECT id FROM entiteit WHERE code = 'holding'");
  const tabel = await q('SELECT * FROM aflossing ORDER BY datum');
  const uit = new Map();
  for (const l of leningen) {
    if (l.rekening_id) {
      const richting = l.schuldenaar_id === holding?.id ? 'ontvangen' : 'verstrekt';
      const { aflossingen } = await leningMutaties({ ...l, richting });
      uit.set(l.id, { bron: 'journaal', aflossingen });
    } else {
      const eigen = tabel.filter((a) => a.lening_id === l.id).map((a) => ({ datum: a.datum, bedrag: a.bedrag }));
      uit.set(l.id, { bron: 'stamdata', aflossingen: eigen });
    }
  }
  return uit;
}

export async function leningen({ peildatum = vandaag() } = {}) {
  const [lijst, dividenden, partijen] = await Promise.all([
    q(`SELECT l.*, g.naam AS geldgever, s.naam AS schuldenaar, s.code AS schuldenaar_code,
              h.naam AS positie_houder, coalesce(p.aantal_rekenbasis, p.aantal) AS positie_aandelen
       FROM lening l
       LEFT JOIN entiteit g ON g.id = l.geldgever_id
       LEFT JOIN entiteit s ON s.id = l.schuldenaar_id
       LEFT JOIN certificaatpositie p ON p.id = l.positie_id
       LEFT JOIN entiteit h ON h.id = p.houder_id
       WHERE s.code IS NOT NULL OR g.code IS NOT NULL
       ORDER BY l.startdatum, l.id`),
    q('SELECT * FROM dividend ORDER BY datum'),
    q("SELECT id, naam, code FROM entiteit WHERE code IS NOT NULL ORDER BY code = 'prive' DESC, id"),
  ]);
  const afl = await aflossingenPerLening(lijst);
  const jaar = Number(peildatum.slice(0, 4));
  const uit = lijst.map((l) => {
    const { bron, aflossingen } = afl.get(l.id);
    const schuld = schuldOp(l, aflossingen, peildatum);
    return {
      ...l,
      einddatum: plusJaren(l.startdatum, l.looptijd_jaren),
      aflossingen,
      aflossingen_bron: bron,
      afgelost: aflossingen.filter((a) => a.datum <= peildatum).reduce((s, a) => s + a.bedrag, 0),
      schuld,
      verloop: schuldverloop(l, aflossingen, { vandaag: vandaag() }),
      dividend_toets: l.aflossing_uit_dividend_pct
        ? dividendToets(l, dividenden, aflossingen.map((a) => ({ ...a, lening_id: l.id })), jaar)
        : null,
    };
  });
  // Totalen per eigen partij, als schuldenaar.
  const totalen = partijen.map((p) => {
    const eigen = uit.filter((l) => l.schuldenaar_id === p.id);
    return {
      partij: p.naam,
      code: p.code,
      hoofdsom: eigen.reduce((s, l) => s + l.hoofdsom, 0),
      schuld: eigen.reduce((s, l) => s + l.schuld.totaal, 0),
      rente: eigen.reduce((s, l) => s + l.schuld.opgelopen_rente, 0),
      aantal: eigen.length,
    };
  });
  return { peildatum, leningen: uit, totalen };
}
