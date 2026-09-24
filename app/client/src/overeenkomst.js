// Concept van een geldleningsovereenkomst uit de gegevens van een lening, om
// te printen of als PDF op te slaan. Wat niet in de stamdata staat, blijft een
// invulveld tussen [haken]: er wordt niets verzonnen.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const bedrag = (n) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);
const dmj = (s) => (s ? s.split('-').reverse().join('-') : '[datum]');

export function conceptOvereenkomst(l) {
  const ontvangen = l.richting === 'ontvangen';
  const geldgever = ontvangen ? l.geldgever : 'Dreves Holding B.V.';
  const geldnemer = ontvangen ? l.schuldenaar : l.schuldenaar;
  const metDga = /dreves/i.test(geldgever ?? '') && /dreves/i.test(geldnemer ?? '');
  const rentemoment = l.rente_periode === 'kalenderjaar' ? 'op het einde van elk kalenderjaar' : 'telkens op de verjaardag van deze overeenkomst';
  const aflossing = Number(l.aflossing_uit_dividend_pct)
    ? `Geldnemer is niet verplicht tot tussentijdse aflossing, behoudens ${Number(l.aflossing_uit_dividend_pct)}% van het ${l.aflossing_grondslag} dividend dat haar jaarlijks toekomt, dat als aflossing aan Geldgever wordt betaald.`
    : 'Geldnemer lost de Geldlening af volgens het volgende schema: [aflossingsschema invullen: bedrag en termijn].';

  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<title>Concept geldleningsovereenkomst – ${esc(l.omschrijving)}</title>
<style>
  body { font: 11pt/1.5 Georgia, serif; max-width: 42rem; margin: 2rem auto; color: #111; }
  h1 { font-size: 15pt; text-align: center; } h2 { font-size: 11pt; margin-top: 1.4rem; }
  .concept { border: 1px solid #b42318; color: #b42318; padding: .5rem .75rem; font: 9pt system-ui, sans-serif; }
  .tekenen { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 3rem; }
  .tekenen div { border-top: 1px solid #111; padding-top: .3rem; }
  @media print { .concept { display: none; } }
</style></head><body>
<p class="concept">CONCEPT, gegenereerd uit de boekhouding-app. Vul de velden tussen [haken] in en laat de tekst
toetsen voordat die wordt getekend. Deze melding verschijnt niet op de afdruk.</p>
<h1>Geldleningsovereenkomst</h1>
<p>De ondergetekenden:</p>
<ol>
  <li><strong>${esc(geldgever)}</strong>${ontvangen ? '' : ', KvK 99257467'}, hierna "Geldgever";</li>
  <li><strong>${esc(geldnemer)}</strong>, hierna "Geldnemer";</li>
</ol>
<p>Overwegende dat partijen de voorwaarden van de hierna omschreven geldlening schriftelijk wensen vast te leggen${
  metDga ? ', mede ter voldoening aan artikel 2:247 van het Burgerlijk Wetboek' : ''};</p>
<p>Komen overeen als volgt:</p>
<h2>1. Geldlening</h2>
<p>1.1 Geldgever verstrekt aan Geldnemer een geldlening van ${bedrag(l.hoofdsom)} (de "Geldlening"), ter beschikking gesteld op ${dmj(l.startdatum)}.</p>
<p>1.2 De Geldlening wordt aangewend voor: [doel invullen].</p>
<p>1.3 De looptijd is ${esc(l.looptijd_jaren)} jaar en eindigt op ${dmj(l.einddatum)}, waarop het dan resterende bedrag opeisbaar is.</p>
<h2>2. Rente</h2>
<p>2.1 Over het uitstaande bedrag is een rente verschuldigd van ${esc(Number(l.rente_pct))}% op jaarbasis, berekend naar rato van het aantal dagen.</p>
<p>2.2 De rente wordt ${rentemoment} ${l.rente_bijschrijven ? 'bij de hoofdsom bijgeschreven' : 'berekend en binnen [termijn] aan Geldgever betaald'}.</p>
<h2>3. Aflossing</h2>
<p>3.1 ${aflossing}</p>
<p>3.2 Geldnemer mag de Geldlening te allen tijde geheel of gedeeltelijk boetevrij aflossen.</p>
<h2>4. Zekerheid</h2>
<p>4.1 [Zekerheden invullen, of: "Voor de Geldlening wordt geen zekerheid gesteld."]</p>
<h2>5. Opeisbaarheid</h2>
<p>5.1 De Geldlening is, met de verschuldigde rente, direct opeisbaar indien Geldnemer in staat van faillissement wordt verklaard,
surseance van betaling aanvraagt, op Geldnemer de schuldsaneringsregeling natuurlijke personen van toepassing wordt verklaard,
of Geldnemer na deugdelijke ingebrekestelling een verplichting uit deze overeenkomst niet (alsnog) nakomt.</p>
<h2>6. Slotbepalingen</h2>
<p>6.1 Deze overeenkomst kan alleen schriftelijk worden gewijzigd of aangevuld.</p>
<p>6.2 Op deze overeenkomst is Nederlands recht van toepassing.</p>
<p>Aldus opgemaakt en ondertekend te [plaats] op [datum].</p>
<div class="tekenen">
  <div>${esc(geldgever)}<br>${metDga || !ontvangen ? 'vertegenwoordigd door A. Dreves, bestuurder' : 'door: [naam, functie]'}</div>
  <div>${esc(geldnemer)}<br>${/b\.v\./i.test(geldnemer ?? '') ? 'vertegenwoordigd door A. Dreves, bestuurder' : ''}</div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return alert('Sta pop-ups toe om het concept te openen.');
  w.document.write(html);
  w.document.close();
}
