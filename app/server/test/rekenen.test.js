import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schuldOp, schuldverloop, leaverPrijs, leaverRegel, volleJaren, breakEven, dividendToets, simulatie } from '../src/rekenen.js';

const contract = {
  id: 1, positie_id: 1, hoofdsom: 17100, rente_pct: 5, rente_bijschrijven: true, rente_periode: 'contractjaar',
  startdatum: '2024-12-23', looptijd_jaren: 5, aflossing_uit_dividend_pct: 25, aflossing_grondslag: 'bruto',
};
const kalender = { ...contract, rente_periode: 'kalenderjaar' };
const r2 = (n) => Math.round(n * 100) / 100;

test('contractjaar: samengesteld per jaardag', () => {
  const v = schuldverloop(contract, []);
  assert.equal(v.length, 5);
  assert.deepEqual(v.map((r) => r2(r.eindsaldo)), [17955, 18852.75, 19795.39, 20785.16, 21824.41]);
  assert.equal(r2(schuldOp(contract, [], '2025-12-23').totaal), 17955);
});

test('kalenderjaar: bijschrijving op 31-12, eerste en laatste periode naar rato', () => {
  const v = schuldverloop(kalender, []);
  assert.deepEqual(v.map((r) => [r.start, r.eind]), [
    ['2024-12-23', '2024-12-31'], ['2025-01-01', '2025-12-31'], ['2026-01-01', '2026-12-31'],
    ['2027-01-01', '2027-12-31'], ['2028-01-01', '2028-12-31'], ['2029-01-01', '2029-12-22'],
  ]);
  // 2024: 9 dagen van 366 (schrikkeljaar)
  assert.equal(r2(v[0].rente), r2((17100 * 0.05 * 9) / 366));
  // 2025: vol jaar over het bijgeschreven saldo
  assert.equal(r2(v[1].rente), r2(v[0].eindsaldo * 0.05));
  // op 31-12 nog niet bijgeschreven, op 1-1 wel
  const op3112 = schuldOp(kalender, [], '2025-12-31');
  assert.equal(r2(op3112.saldo), r2(v[0].eindsaldo));
  assert.equal(r2(schuldOp(kalender, [], '2026-01-01').saldo), r2(v[1].eindsaldo));
});

test('aflossing verlaagt saldo vanaf haar datum', () => {
  const v = schuldverloop(kalender, [{ datum: '2025-07-02', bedrag: 1000 }]);
  const begin = v[1].beginsaldo;
  const verwacht = (begin * 0.05 * 182) / 365 + ((begin - 1000) * 0.05 * 183) / 365;
  assert.equal(r2(v[1].rente), r2(verwacht));
  assert.equal(r2(v[1].afgelost), 1000);
});

test('dividendtoets: bruto/netto, geen dividend = geen verplichting', () => {
  const div = [{ positie_id: 1, datum: '2025-05-08', bruto: 3150, netto: 2678 }];
  const afl = [{ lening_id: 1, datum: '2025-12-30', bedrag: 700 }, { lening_id: 1, datum: '2026-02-26', bedrag: 2000 }];
  const t = dividendToets(kalender, div, afl, 2026);
  assert.deepEqual(t.rijen.map((r) => [r.jaar, r.verplicht, r.status]), [
    [2024, 0, 'geen dividend'], [2025, 787.5, 'tekort'], [2026, 0, 'geen dividend'],
  ]);
  assert.equal(t.rijen[2].cum_verschil, 1912.5);
  const n = dividendToets({ ...kalender, aflossing_grondslag: 'netto' }, div, afl, 2025);
  assert.equal(n.rijen[1].status, 'voldaan');
});

test('leaver: bad leaver begrensd op inleg, early per jaar', () => {
  const regels = [
    { categorie: 'early', vanaf_jaar: 1, tot_en_met_jaar: 2, pct_marktwaarde: 70 },
    { categorie: 'early', vanaf_jaar: 3, tot_en_met_jaar: 3, pct_marktwaarde: 80 },
    { categorie: 'bad', vanaf_jaar: null, tot_en_met_jaar: null, pct_marktwaarde: 50, max_inleg: true },
  ];
  assert.equal(leaverRegel(regels, 'early', 3).pct_marktwaarde, 80);
  assert.equal(leaverRegel(regels, 'early', 4), undefined);
  const bad = leaverPrijs({ ondernemingswaarde: 290000, noemer: 100, regel: regels[2], extraKortingPct: 0, inlegPerCertificaat: 1900 });
  assert.equal(bad.prijs, 1450);
  const badLaag = leaverPrijs({ ondernemingswaarde: 500000, noemer: 100, regel: regels[2], extraKortingPct: 0, inlegPerCertificaat: 1900 });
  assert.ok(badLaag.begrensd);
  assert.equal(badLaag.prijs, 1900);
});

test('volle jaren en break-even', () => {
  assert.equal(volleJaren('2025-01-02', '2028-01-01'), 2);
  assert.equal(volleJaren('2025-01-02', '2028-01-02'), 3);
  const b = breakEven(855, 9, 100, 25);
  assert.equal(r2(b.dividend_rente_dekken), 9500);
  assert.equal(r2(b.dividend_schuld_stilstand), 38000);
});

test('volledig aflossen voldoet ook de opgelopen rente', () => {
  const op = schuldOp(kalender, [], '2026-06-30');
  const nul = schuldOp(kalender, [{ datum: '2026-06-30', bedrag: 1e6 }], '2026-12-31');
  assert.ok(op.totaal > op.saldo);
  assert.ok(Math.abs(nul.totaal) < 0.005);
});

test('simulatie: extra aflossen maakt eerder schuldvrij; rendement gelijk aan rente is neutraal', () => {
  const vanaf = '2026-09-23';
  const basis = simulatie(kalender, [], { vanaf, rendementPct: 5 });
  const keuze = simulatie(kalender, [], { vanaf, extraPerMaand: 1000, rendementPct: 5 });
  assert.equal(basis.schuldvrij_op, null);
  assert.ok(keuze.schuldvrij_op && keuze.schuldvrij_op < '2029-01-01');
  assert.ok(keuze.eigen_geld_ingezet > 0);
  // Bij 5% alternatief rendement tegen 5% rente scheelt het nauwelijks.
  const verschil = keuze.reeks.at(-1).netto - basis.reeks.at(-1).netto;
  assert.ok(Math.abs(verschil) < 150, `verschil ${verschil}`);
  // Bij 0% rendement levert aflossen wel op.
  const k0 = simulatie(kalender, [], { vanaf, extraPerMaand: 1000, rendementPct: 0 });
  const b0 = simulatie(kalender, [], { vanaf, rendementPct: 0 });
  assert.ok(k0.reeks.at(-1).netto - b0.reeks.at(-1).netto > 500);
});
