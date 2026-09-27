import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from './db.js';
import { Invoerfout } from './resources.js';
import { plusJaren, schuldOp, schuldverloop } from './rekenen.js';

// De administratie van Dreves Holding B.V.
const HOLDING = "(SELECT id FROM entiteit WHERE code = 'holding')";
const BIJLAGEN = process.env.BIJLAGEN_DIR ?? path.resolve('data/bijlagen');
const vandaag = () => new Date().toISOString().slice(0, 10);
const cent = (n) => Math.round(Number(n) * 100);
const euro = (c) => c / 100;
const q = (sql, p = [], client = pool) => client.query(sql, p).then((r) => r.rows);
const eur = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

export class Conflict extends Error {}

// ---------------------------------------------------------------------------
// Journaal
// ---------------------------------------------------------------------------

async function postMetRegels(id, client = pool) {
  const [post] = await q('SELECT * FROM journaalpost WHERE id = $1', [id], client);
  if (!post) return null;
  post.regels = await q('SELECT * FROM journaalregel WHERE post_id = $1 ORDER BY id', [id], client);
  return post;
}

async function log(client, tabel, recordId, actie, oud, nieuw) {
  await client.query(
    'INSERT INTO wijziging_log (tabel, record_id, actie, oud, nieuw) VALUES ($1, $2, $3, $4, $5)',
    [tabel, recordId, actie, oud && JSON.stringify(oud), nieuw && JSON.stringify(nieuw)],
  );
}

async function boekjaarVoor(client, boekjaarId, datum) {
  const [bj] = boekjaarId
    ? await q('SELECT * FROM boekjaar WHERE id = $1', [boekjaarId], client)
    : await q(`SELECT * FROM boekjaar WHERE partij_id = ${HOLDING} AND $1 BETWEEN start AND eind`, [datum], client);
  if (!bj) throw new Invoerfout(`Geen boekjaar voor ${datum}`);
  if (bj.status !== 'open') throw new Invoerfout('Dit boekjaar is afgesloten; boek de correctie in een open boekjaar');
  if (datum < bj.start || datum > bj.eind) throw new Invoerfout(`Datum valt buiten het boekjaar (${bj.start} t/m ${bj.eind})`);
  return bj;
}

// Controleert een post en geeft de genormaliseerde regels terug.
async function valideer(client, invoer) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoer.datum ?? '')) throw new Invoerfout('Datum als JJJJ-MM-DD');
  if (!invoer.omschrijving?.trim()) throw new Invoerfout('Omschrijving is verplicht');
  if (!['memoriaal', 'bank', 'inkoop', 'verkoop'].includes(invoer.dagboek)) throw new Invoerfout('Kies een dagboek');
  const bj = await boekjaarVoor(client, invoer.boekjaar_id, invoer.datum);
  const regels = (invoer.regels ?? [])
    .filter((r) => r.rekening_id && (Number(r.debet) || Number(r.credit)))
    .map((r) => ({
      rekening_id: Number(r.rekening_id),
      debet: cent(r.debet || 0),
      credit: cent(r.credit || 0),
      omschrijving: r.omschrijving || null,
    }));
  if (regels.length < 2) throw new Invoerfout('Een journaalpost heeft minstens twee regels');
  for (const r of regels) {
    if (r.debet < 0 || r.credit < 0) throw new Invoerfout('Bedragen zijn positief; kies debet of credit');
    if ((r.debet === 0) === (r.credit === 0)) throw new Invoerfout('Elke regel heeft óf een debet- óf een creditbedrag');
  }
  const rekeningen = await q('SELECT id, actief FROM grootboekrekening WHERE id = ANY($1)', [regels.map((r) => r.rekening_id)], client);
  if (rekeningen.length !== new Set(regels.map((r) => r.rekening_id)).size) throw new Invoerfout('Onbekende grootboekrekening');
  const debet = regels.reduce((s, r) => s + r.debet, 0);
  const credit = regels.reduce((s, r) => s + r.credit, 0);
  if (debet !== credit) {
    throw new Invoerfout(`Niet in balans: debet ${eur(euro(debet))}, credit ${eur(euro(credit))}`);
  }
  return { bj, regels };
}

async function schrijfRegels(client, postId, regels) {
  for (const r of regels) {
    await client.query(
      'INSERT INTO journaalregel (post_id, rekening_id, debet, credit, omschrijving) VALUES ($1, $2, $3, $4, $5)',
      [postId, r.rekening_id, euro(r.debet), euro(r.credit), r.omschrijving],
    );
  }
}

async function transactie(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const uit = await fn(client);
    await client.query('COMMIT');
    return uit;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function journaal({ boekjaar_id }) {
  const posts = await q(
    `SELECT p.*,
       (SELECT count(*)::int FROM bijlage b WHERE b.post_id = p.id) AS bijlagen,
       (SELECT coalesce(sum(debet), 0) FROM journaalregel r WHERE r.post_id = p.id) AS bedrag
     FROM journaalpost p
     WHERE ($1::int IS NULL OR p.boekjaar_id = $1)
     ORDER BY p.datum DESC, p.id DESC`,
    [boekjaar_id ? Number(boekjaar_id) : null],
  );
  return posts;
}

export async function post(id) {
  const p = await postMetRegels(id);
  if (!p) return null;
  p.bijlagen = await q('SELECT id, bestandsnaam, mime, grootte, sha256, geupload_op FROM bijlage WHERE post_id = $1 ORDER BY id', [id]);
  return p;
}

export async function maakPost(invoer, client) {
  const uitvoeren = async (c) => {
    const { bj, regels } = await valideer(c, invoer);
    const [p] = await q(
      `INSERT INTO journaalpost (boekjaar_id, datum, dagboek, omschrijving, referentie, status, bron, notitie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [bj.id, invoer.datum, invoer.dagboek, invoer.omschrijving.trim(), invoer.referentie || null,
       invoer.status === 'definitief' ? 'definitief' : 'concept', invoer.bron || null, invoer.notitie || null],
      c,
    );
    await schrijfRegels(c, p.id, regels);
    const nieuw = await postMetRegels(p.id, c);
    await log(c, 'journaalpost', p.id, 'aangemaakt', null, nieuw);
    return nieuw;
  };
  return client ? uitvoeren(client) : transactie(uitvoeren);
}

export async function wijzigPost(id, invoer) {
  return transactie(async (c) => {
    const oud = await postMetRegels(id, c);
    if (!oud) throw new Invoerfout('Post niet gevonden');
    if (oud.status === 'definitief') throw new Conflict('Een definitieve post wijzigt niet meer; maak een tegenboeking');
    await boekjaarVoor(c, oud.boekjaar_id, oud.datum);
    const { bj, regels } = await valideer(c, invoer);
    await c.query(
      `UPDATE journaalpost SET boekjaar_id = $2, datum = $3, dagboek = $4, omschrijving = $5, referentie = $6,
         status = $7, bron = $8, notitie = $9, gewijzigd_op = now() WHERE id = $1`,
      [id, bj.id, invoer.datum, invoer.dagboek, invoer.omschrijving.trim(), invoer.referentie || null,
       invoer.status === 'definitief' ? 'definitief' : 'concept', invoer.bron || null, invoer.notitie || null],
    );
    await c.query('DELETE FROM journaalregel WHERE post_id = $1', [id]);
    await schrijfRegels(c, id, regels);
    const nieuw = await postMetRegels(id, c);
    await log(c, 'journaalpost', id, 'gewijzigd', oud, nieuw);
    return nieuw;
  });
}

export async function verwijderPost(id) {
  return transactie(async (c) => {
    const oud = await postMetRegels(id, c);
    if (!oud) throw new Invoerfout('Post niet gevonden');
    if (oud.status === 'definitief') throw new Conflict('Een definitieve post kan niet worden verwijderd; maak een tegenboeking');
    await boekjaarVoor(c, oud.boekjaar_id, oud.datum);
    const shas = await q('SELECT sha256 FROM bijlage WHERE post_id = $1', [id], c);
    await c.query('DELETE FROM journaalpost WHERE id = $1', [id]);
    await log(c, 'journaalpost', id, 'verwijderd', oud, null);
    return shas.map((s) => s.sha256);
  }).then(opruimen);
}

export async function tegenboeking(id, datum = vandaag()) {
  const oud = await postMetRegels(id);
  if (!oud) throw new Invoerfout('Post niet gevonden');
  return maakPost({
    datum,
    dagboek: 'memoriaal',
    omschrijving: `Tegenboeking van post ${id}: ${oud.omschrijving}`,
    notitie: `Corrigeert post ${id} van ${oud.datum}`,
    regels: oud.regels.map((r) => ({ rekening_id: r.rekening_id, debet: r.credit, credit: r.debet, omschrijving: r.omschrijving })),
  });
}

export async function sluitBoekjaar(id) {
  return transactie(async (c) => {
    const [bj] = await q('SELECT * FROM boekjaar WHERE id = $1 FOR UPDATE', [id], c);
    if (!bj) throw new Invoerfout('Boekjaar niet gevonden');
    if (bj.status === 'afgesloten') throw new Invoerfout('Boekjaar is al afgesloten');
    const [{ n }] = await q("SELECT count(*)::int AS n FROM journaalpost WHERE boekjaar_id = $1 AND status = 'concept'", [id], c);
    if (n) throw new Invoerfout(`Er staan nog ${n} conceptposten in dit boekjaar`);
    await c.query("UPDATE boekjaar SET status = 'afgesloten', afgesloten_op = now() WHERE id = $1", [id]);
    await log(c, 'boekjaar', id, 'afgesloten', bj, null);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Bijlagen: op schijf onder hun sha256, zodat dezelfde inhoud één keer wordt
// opgeslagen en elke wijziging van het bestand zichtbaar is.
// ---------------------------------------------------------------------------

const bijlagePad = (sha) => path.join(BIJLAGEN, sha.slice(0, 2), sha);

export async function slaBijlageOp({ post_id, overeenkomst_id, naam, mime }, inhoud) {
  if (!inhoud?.length) throw new Invoerfout('Leeg bestand');
  if (!post_id && !overeenkomst_id) throw new Invoerfout('Koppel de bijlage aan een post of overeenkomst');
  const sha = crypto.createHash('sha256').update(inhoud).digest('hex');
  await fs.mkdir(path.dirname(bijlagePad(sha)), { recursive: true });
  await fs.writeFile(bijlagePad(sha), inhoud, { flag: 'w' });
  const [b] = await q(
    `INSERT INTO bijlage (post_id, overeenkomst_id, bestandsnaam, mime, grootte, sha256)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, bestandsnaam, mime, grootte, sha256, geupload_op`,
    [post_id ? Number(post_id) : null, overeenkomst_id ? Number(overeenkomst_id) : null,
     path.basename(naam || 'bijlage'), mime || 'application/octet-stream', inhoud.length, sha],
  );
  return b;
}

export async function leesBijlage(id) {
  const [b] = await q('SELECT * FROM bijlage WHERE id = $1', [id]);
  if (!b) return null;
  const inhoud = await fs.readFile(bijlagePad(b.sha256));
  const sha = crypto.createHash('sha256').update(inhoud).digest('hex');
  return { ...b, inhoud, intact: sha === b.sha256 };
}

export async function verwijderBijlage(id) {
  const [b] = await q(
    `SELECT b.*, p.status AS post_status FROM bijlage b LEFT JOIN journaalpost p ON p.id = b.post_id WHERE b.id = $1`,
    [id],
  );
  if (!b) throw new Invoerfout('Bijlage niet gevonden');
  if (b.post_status === 'definitief') throw new Conflict('Bijlage bij een definitieve post blijft bewaard (bewaarplicht)');
  await pool.query('DELETE FROM bijlage WHERE id = $1', [id]);
  await opruimen([b.sha256]);
}

async function opruimen(shas) {
  for (const sha of shas) {
    const [{ n }] = await q('SELECT count(*)::int AS n FROM bijlage WHERE sha256 = $1', [sha]);
    if (!n) await fs.rm(bijlagePad(sha), { force: true });
  }
}

// ---------------------------------------------------------------------------
// Rapportages
// ---------------------------------------------------------------------------

async function saldi({ van, tot, alleenDefinitief }) {
  return q(
    `SELECT g.id, g.nummer, g.naam, g.soort, g.categorie, g.functie,
            coalesce(sum(r.debet), 0) AS debet, coalesce(sum(r.credit), 0) AS credit
     FROM grootboekrekening g
     LEFT JOIN journaalregel r ON r.rekening_id = g.id
       AND EXISTS (SELECT 1 FROM journaalpost p WHERE p.id = r.post_id
                   AND ($1::date IS NULL OR p.datum >= $1) AND p.datum <= $2
                   AND (NOT $3 OR p.status = 'definitief'))
     GROUP BY g.id ORDER BY g.nummer`,
    [van, tot, !!alleenDefinitief],
  );
}

export async function rapport({ boekjaar_id, peildatum, alleen_definitief }) {
  const [bj] = boekjaar_id
    ? await q('SELECT * FROM boekjaar WHERE id = $1', [boekjaar_id])
    : await q(`SELECT * FROM boekjaar WHERE partij_id = ${HOLDING} ORDER BY start DESC LIMIT 1`);
  if (!bj) throw new Invoerfout('Geen boekjaar');
  const tot = peildatum && peildatum < bj.eind ? peildatum : bj.eind;
  const alleenDefinitief = alleen_definitief === 'true';
  const balansRek = (await saldi({ van: null, tot, alleenDefinitief })).filter((r) => r.soort === 'balans');
  const wv = (await saldi({ van: bj.start, tot, alleenDefinitief })).filter((r) => r.soort === 'resultaat');
  // Resultaatrekeningen van eerdere boekjaren die (nog) niet zijn overgeboekt.
  const eerder = (await saldi({ van: null, tot: plusDagen(bj.start, -1), alleenDefinitief }))
    .filter((r) => r.soort === 'resultaat')
    .reduce((s, r) => s + cent(r.credit) - cent(r.debet), 0);

  const regels = (lijst) => lijst
    .map((r) => ({ ...r, saldo: euro(cent(r.debet) - cent(r.credit)) }))
    .filter((r) => cent(r.debet) || cent(r.credit));
  const balans = regels(balansRek);
  const resultaat = regels(wv).map((r) => ({ ...r, bedrag: -r.saldo }));
  const resultaatCent = resultaat.reduce((s, r) => s + cent(r.bedrag), 0);

  const activa = balans.filter((r) => r.saldo > 0);
  const passiva = balans.filter((r) => r.saldo < 0).map((r) => ({ ...r, bedrag: -r.saldo }));
  if (eerder) passiva.push({ nummer: '', naam: 'Onverdeeld resultaat eerdere boekjaren', categorie: 'Eigen vermogen', bedrag: euro(eerder) });
  passiva.push({ nummer: '', naam: 'Resultaat lopend boekjaar', categorie: 'Eigen vermogen', bedrag: euro(resultaatCent) });
  const som = (l, k) => euro(l.reduce((s, r) => s + cent(r[k]), 0));

  const [{ concept }] = await q(
    "SELECT count(*)::int AS concept FROM journaalpost WHERE boekjaar_id = $1 AND status = 'concept' AND datum <= $2",
    [bj.id, tot],
  );
  return {
    boekjaar: bj,
    peildatum: tot,
    concept,
    alleen_definitief: alleenDefinitief,
    activa: activa.map((r) => ({ ...r, bedrag: r.saldo })),
    passiva,
    totaal_activa: som(activa, 'saldo'),
    totaal_passiva: som(passiva, 'bedrag'),
    resultaat,
    resultaat_totaal: euro(resultaatCent),
    proefbalans: regels([...balansRek, ...wv]).sort((a, b) => a.nummer.localeCompare(b.nummer)),
  };
}

function plusDagen(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function grootboekkaart(rekeningId, { boekjaar_id }) {
  const [rek] = await q('SELECT * FROM grootboekrekening WHERE id = $1', [rekeningId]);
  if (!rek) return null;
  const [bj] = await q('SELECT * FROM boekjaar WHERE id = $1', [boekjaar_id]);
  const van = rek.soort === 'resultaat' && bj ? bj.start : null;
  const [begin] = van || !bj
    ? [{ saldo: 0 }]
    : await q(
        `SELECT coalesce(sum(r.debet - r.credit), 0) AS saldo FROM journaalregel r
         JOIN journaalpost p ON p.id = r.post_id WHERE r.rekening_id = $1 AND p.datum < $2`,
        [rekeningId, bj.start],
      );
  const regels = await q(
    `SELECT r.*, p.datum, p.omschrijving AS post_omschrijving, p.status, p.dagboek
     FROM journaalregel r JOIN journaalpost p ON p.id = r.post_id
     WHERE r.rekening_id = $1 AND ($2::date IS NULL OR p.datum >= $2) AND ($3::date IS NULL OR p.datum <= $3)
     ORDER BY p.datum, p.id, r.id`,
    [rekeningId, bj?.start ?? null, bj?.eind ?? null],
  );
  let saldo = cent(begin.saldo);
  const beginsaldo = euro(saldo);
  for (const r of regels) {
    saldo += cent(r.debet) - cent(r.credit);
    r.saldo = euro(saldo);
  }
  return { rekening: rek, beginsaldo, regels, eindsaldo: euro(saldo) };
}

// ---------------------------------------------------------------------------
// Leningen: het journaal is leidend. Aflossingen zijn de boekingen op de
// leningrekening aan de verlagende kant; de rekenmodule berekent daarmee wat
// het saldo hoort te zijn.
// ---------------------------------------------------------------------------

// De boekingen op de leningrekening en de aflossingen die daaruit volgen. Ook
// gebruikt door Financiering, zodat een geboekte lening daar hetzelfde saldo
// toont als in de administratie.
export async function leningMutaties(l) {
  const regels = l.rekening_id
    ? await q(
        `SELECT r.debet, r.credit, p.datum, p.referentie FROM journaalregel r
         JOIN journaalpost p ON p.id = r.post_id WHERE r.rekening_id = $1 ORDER BY p.datum`,
        [l.rekening_id],
      )
    : [];
  const ontvangen = l.richting === 'ontvangen';
  const opening = regels.find((r) => r.datum === l.startdatum && (ontvangen ? r.credit : r.debet) > 0);
  const aflossingen = regels
    .filter((r) => r !== opening && !(r.referentie ?? '').startsWith('rente:') && (ontvangen ? r.debet : r.credit) > 0)
    .map((r) => ({ datum: r.datum, bedrag: ontvangen ? r.debet : r.credit }));
  return { regels, aflossingen };
}

async function leningDetail(l, peildatum) {
  const { regels, aflossingen } = await leningMutaties(l);
  const ontvangen = l.richting === 'ontvangen';
  const tot = regels.filter((r) => r.datum <= peildatum);
  const grootboek = euro(tot.reduce((s, r) => s + (ontvangen ? cent(r.credit) - cent(r.debet) : cent(r.debet) - cent(r.credit)), 0));
  const schuld = schuldOp(l, aflossingen, peildatum);
  const verloop = schuldverloop(l, aflossingen, { vandaag: vandaag() });
  const refs = new Set((await q("SELECT referentie FROM journaalpost WHERE referentie LIKE $1", [`rente:${l.id}:%`])).map((r) => r.referentie));
  for (const r of verloop) r.geboekt = refs.has(`rente:${l.id}:${r.eind}`);
  const overeenkomsten = await q('SELECT * FROM overeenkomst WHERE lening_id = $1 ORDER BY id', [l.id]);
  for (const o of overeenkomsten) {
    o.bijlagen = await q('SELECT id, bestandsnaam, grootte, geupload_op FROM bijlage WHERE overeenkomst_id = $1', [o.id]);
  }
  return {
    ...l,
    einddatum: plusJaren(l.startdatum, l.looptijd_jaren),
    schuld,
    grootboek_saldo: l.rekening_id ? grootboek : null,
    // Bij bijschrijven hoort het grootboek de bijgeschreven rente al te bevatten.
    verschil: l.rekening_id ? euro(cent(grootboek) - cent(schuld.saldo)) : null,
    verloop,
    overeenkomsten,
  };
}

// Leningen waarbij de holding partij is. 'richting' vanuit de holding gezien:
// ontvangen = schuld van de holding, verstrekt = vordering van de holding.
export const LENINGEN = `
  SELECT l.*, e.naam AS geldgever, s.naam AS schuldenaar,
         CASE WHEN l.schuldenaar_id = ${HOLDING} THEN 'ontvangen' ELSE 'verstrekt' END AS richting,
         g.nummer AS rekening_nummer, g.naam AS rekening_naam
  FROM lening l
  LEFT JOIN entiteit e ON e.id = l.geldgever_id
  LEFT JOIN entiteit s ON s.id = l.schuldenaar_id
  LEFT JOIN grootboekrekening g ON g.id = l.rekening_id
  WHERE ${HOLDING} IN (l.geldgever_id, l.schuldenaar_id)`;

export async function leningen({ peildatum = vandaag() }) {
  const lijst = await q(`${LENINGEN} ORDER BY l.id`);
  return Promise.all(lijst.map((l) => leningDetail(l, peildatum)));
}

// Maakt de renteboeking voor één renteperiode (als concept), gedateerd op het
// einde van de periode. De referentie voorkomt een dubbele boeking.
export async function boekRente(leningId, eind) {
  const [l] = await q(`${LENINGEN} AND l.id = $1`, [leningId]);
  if (!l) throw new Invoerfout('Lening niet gevonden');
  if (!l.rekening_id) throw new Invoerfout('Koppel eerst een grootboekrekening aan de lening');
  const detail = await leningDetail(l, vandaag());
  const periode = detail.verloop.find((r) => r.eind === eind);
  if (!periode) throw new Invoerfout('Onbekende renteperiode');
  const bedrag = Math.round(periode.rente * 100) / 100;
  const rek = Object.fromEntries(
    (await q('SELECT functie, id FROM grootboekrekening WHERE functie IS NOT NULL')).map((r) => [r.functie, r.id]),
  );
  const ontvangen = l.richting === 'ontvangen';
  const resultaat = ontvangen ? rek.rentelasten : rek.rentebaten;
  const tegen = l.rente_bijschrijven ? l.rekening_id : ontvangen ? rek.te_betalen_rente : rek.te_ontvangen_rente;
  if (!resultaat || !tegen) throw new Invoerfout('Rekening met functie rentelasten/rentebaten/te betalen rente ontbreekt');
  const regels = ontvangen
    ? [{ rekening_id: resultaat, debet: bedrag }, { rekening_id: tegen, credit: bedrag }]
    : [{ rekening_id: tegen, debet: bedrag }, { rekening_id: resultaat, credit: bedrag }];
  return maakPost({
    datum: eind,
    dagboek: 'memoriaal',
    omschrijving: `Rente ${l.omschrijving}, ${periode.start} t/m ${periode.eind}`,
    referentie: `rente:${l.id}:${eind}`,
    bron: l.bron,
    notitie: `${l.rente_pct}% over ${l.rente_bijschrijven ? 'bij te schrijven' : 'te betalen'} rente, naar rato van de dagen`,
    regels,
  });
}

// ---------------------------------------------------------------------------
// Controles: wat moet er nog gebeuren om binnen de regels te blijven?
// ---------------------------------------------------------------------------

export async function controles() {
  const uit = [];
  const melding = (niveau, titel, detail, grond) => uit.push({ niveau, titel, detail, grond });
  const nu = vandaag();

  const concept = await q("SELECT count(*)::int AS n FROM journaalpost WHERE status = 'concept'");
  if (concept[0].n) {
    melding('waarschuwing', `${concept[0].n} conceptboeking(en)`, 'Controleer en zet op definitief; een boekjaar sluit pas zonder concepten.', 'art. 2:10 BW');
  }

  const zonderBijlage = await q(
    `SELECT p.id, p.datum, p.omschrijving FROM journaalpost p
     WHERE p.dagboek IN ('inkoop', 'verkoop', 'bank') AND NOT EXISTS (SELECT 1 FROM bijlage b WHERE b.post_id = p.id)
     ORDER BY p.datum`,
  );
  for (const p of zonderBijlage) {
    melding('waarschuwing', `Geen bijlage bij post ${p.id}`, `${p.datum} — ${p.omschrijving}`, 'bewaarplicht art. 52 AWR, art. 2:10 lid 3 BW');
  }

  const scheef = await q(
    `SELECT post_id, sum(debet) AS d, sum(credit) AS c FROM journaalregel GROUP BY post_id HAVING sum(debet) <> sum(credit)`,
  );
  for (const s of scheef) melding('fout', `Post ${s.post_id} niet in balans`, `debet ${eur(s.d)}, credit ${eur(s.c)}`, 'dubbel boekhouden');

  const bank = await q(
    `SELECT count(*)::int AS n FROM journaalregel r JOIN grootboekrekening g ON g.id = r.rekening_id WHERE g.functie = 'bank'`,
  );
  if (!bank[0].n) {
    melding('waarschuwing', 'Nog geen bankmutaties geboekt', 'Er is een zakelijke rekening bij ING; de afschriften vanaf opening horen in het journaal (aanname A3).', 'art. 2:10 BW');
  }

  for (const l of await leningen({ peildatum: nu })) {
    if (!l.overeenkomsten.some((o) => o.ondertekend)) {
      melding('fout', `Geen ondertekende overeenkomst: ${l.omschrijving}`, 'Leg de lening schriftelijk vast; bij een lening met de aandeelhouder is dat verplicht.', 'art. 2:247 BW');
    } else if (!l.overeenkomsten.some((o) => o.bijlagen.length)) {
      melding('info', `Overeenkomst zonder bijlage: ${l.omschrijving}`, 'Voeg de getekende overeenkomst toe als bijlage.', 'bewaarplicht art. 52 AWR');
    }
    for (const r of l.verloop) {
      if (!r.geboekt && r.eind < nu) {
        melding('waarschuwing', `Rente niet geboekt: ${l.omschrijving}`, `Periode ${r.start} t/m ${r.eind}, ${eur(r.rente)}`, l.bron);
      }
    }
    if (l.verschil != null && Math.abs(l.verschil) >= 0.01) {
      melding('waarschuwing', `Grootboek wijkt af van leningberekening: ${l.omschrijving}`, `Grootboek ${eur(l.grootboek_saldo)}, berekend ${eur(l.schuld.saldo)}`, l.bron);
    }
  }

  // Excessief lenen: schuld van de DGA aan de BV op 31-12 boven € 500.000.
  const rc = await q(
    `SELECT extract(year FROM p.datum)::int AS jaar, sum(r.debet - r.credit) AS mutatie
     FROM journaalregel r JOIN journaalpost p ON p.id = r.post_id JOIN grootboekrekening g ON g.id = r.rekening_id
     WHERE g.functie = 'rc_dga' GROUP BY 1 ORDER BY 1`,
  );
  let rcSaldo = 0;
  for (const j of rc) {
    rcSaldo += Number(j.mutatie);
    if (rcSaldo > 500000) {
      melding('fout', `Rekening-courant DGA op 31-12-${j.jaar}: ${eur(rcSaldo)} te vorderen`, 'Het deel boven € 500.000 is bij de DGA belast in box 2.', 'art. 4.14a Wet IB 2001');
    }
  }
  if (rc.length) {
    const [{ n }] = await q("SELECT count(*)::int AS n FROM overeenkomst WHERE soort = 'rekening-courant' AND ondertekend");
    if (!n) melding('fout', 'Rekening-courant DGA zonder schriftelijke overeenkomst', 'Leg rente, limiet en aflossing vast.', 'art. 2:247 BW');
  }

  // Punten uit de vastlegging (openstaande-vragen/REGISTER.md) die de boeken raken.
  melding('info', 'Betaling koopsom aan de STAK niet aangetoond', 'De geldgever betaalde de koopsom namens de holding aan de STAK (23-12-2025); een betaalbewijs ontbreekt nog.', 'V-F05');
  melding('info', 'Btw-positie holding', 'Nu geen ondernemer; managementvergoeding over ca. 2 jaar. Voorbelasting mogelijk aftrekbaar als voorbereidingshandeling.', 'V-F01, V-F39');
  melding('info', 'Gebruikelijk loon', 'Nagaan of de holding werkzaamheden verricht waarvoor loon in aanmerking moet worden genomen.', 'art. 12a Wet LB 1964, V-F04');
  melding('info', 'Uitnodiging aangifte VpB', 'Zonder uitnodiging geldt een eigen meldplicht.', 'art. 6 lid 3 AWR, V-F02');

  const termijnen = await q(`SELECT * FROM gebeurtenis WHERE partij_id = ${HOLDING} AND datum >= $1 ORDER BY datum LIMIT 8`, [nu]);
  const volgorde = { fout: 0, waarschuwing: 1, info: 2 };
  return { meldingen: uit.sort((a, b) => volgorde[a.niveau] - volgorde[b.niveau]), termijnen };
}
