// Beschrijving van alle bewerkbare stamdata. De server gebruikt dit als
// whitelist voor de CRUD-routes; de client bouwt er zijn formulieren uit op
// (via /api/meta). Een veld toevoegen = hier een regel + een migratie.
// 'berekend' = kolom die de database zelf vult: wel tonen, niet invoeren.

const bron = { naam: 'bron', label: 'Bron', type: 'text' };
const notitie = { naam: 'notitie', label: 'Notitie', type: 'text', lang: true };
const spoor = { naam: 'spoor', label: 'Spoor', type: 'spoor', verplicht: true };

export const RESOURCES = {
  entiteit: {
    titel: 'Entiteiten',
    uitleg: 'Vennootschappen, stichtingen en personen die in dit spoor een rol spelen.',
    labelVeld: 'naam',
    velden: [
      spoor,
      { naam: 'naam', label: 'Naam', type: 'text', verplicht: true },
      { naam: 'kvk', label: 'KvK', type: 'text' },
      { naam: 'soort', label: 'Soort', type: 'text' },
      { naam: 'rol', label: 'Rol', type: 'text', lang: true },
      bron,
      notitie,
    ],
  },
  certificaatpositie: {
    titel: 'Certificaatposities',
    uitleg: 'Wie houdt hoeveel certificaten, tegen welke inleg.',
    labelVeld: 'houder',
    velden: [
      spoor,
      { naam: 'houder', label: 'Houder', type: 'text', verplicht: true },
      { naam: 'vennootschap_id', label: 'Vennootschap', type: 'ref', ref: 'entiteit' },
      { naam: 'aantal', label: 'Aantal', type: 'integer', verplicht: true },
      { naam: 'nummers', label: 'Nummers', type: 'text' },
      { naam: 'inleg', label: 'Inleg (€)', type: 'number', verplicht: true },
      { naam: 'verkregen_op', label: 'Verkregen op', type: 'date', verplicht: true },
      { naam: 'vergaderrecht', label: 'Vergaderrecht', type: 'bool' },
      bron,
      notitie,
    ],
  },
  lening: {
    titel: 'Leningen',
    uitleg: 'Schulden, met rente en aflossingsregeling.',
    labelVeld: 'omschrijving',
    velden: [
      spoor,
      { naam: 'omschrijving', label: 'Omschrijving', type: 'text', verplicht: true },
      { naam: 'geldgever_id', label: 'Geldgever', type: 'ref', ref: 'entiteit' },
      { naam: 'schuldenaar', label: 'Schuldenaar', type: 'text', verplicht: true },
      { naam: 'positie_id', label: 'Financiert positie', type: 'ref', ref: 'certificaatpositie' },
      { naam: 'hoofdsom', label: 'Hoofdsom (€)', type: 'number', verplicht: true },
      { naam: 'rente_pct', label: 'Rente %', type: 'number', verplicht: true },
      { naam: 'rente_bijschrijven', label: 'Rente bijschrijven', type: 'bool' },
      { naam: 'rente_periode', label: 'Rente per', type: 'enum', opties: ['kalenderjaar', 'contractjaar'], verplicht: true },
      { naam: 'startdatum', label: 'Startdatum', type: 'date', verplicht: true },
      { naam: 'looptijd_jaren', label: 'Looptijd (jaren)', type: 'integer', verplicht: true },
      { naam: 'aflossing_uit_dividend_pct', label: 'Verplichte aflossing uit dividend %', type: 'number' },
      { naam: 'aflossing_grondslag', label: 'Over dividend', type: 'enum', opties: ['bruto', 'netto'], verplicht: true },
      { naam: 'richting', label: 'Richting', type: 'enum', opties: ['ontvangen', 'verstrekt'], verplicht: true },
      { naam: 'rekening_id', label: 'Grootboekrekening', type: 'ref', ref: 'grootboekrekening' },
      bron,
      notitie,
    ],
  },
  dividend: {
    titel: 'Dividenden',
    uitleg: 'Dividend dat de positie toekomt. Aflossingen boek je apart; de verplichting wordt getoetst in het overzicht.',
    velden: [
      { naam: 'positie_id', label: 'Positie', type: 'ref', ref: 'certificaatpositie', verplicht: true },
      { naam: 'datum', label: 'Datum', type: 'date', verplicht: true },
      { naam: 'bruto', label: 'Bruto (€)', type: 'number', verplicht: true },
      { naam: 'dividendbelasting', label: 'Dividendbelasting (€)', type: 'number', standaard: 0 },
      { naam: 'netto', label: 'Netto (€)', type: 'number', berekend: true },
      bron,
      notitie,
    ],
  },
  aflossing: {
    titel: 'Aflossingen',
    uitleg: 'Alle aflossingen: de verplichte uit dividend (art. 3.2) en vrijwillige (art. 3.3).',
    velden: [
      { naam: 'lening_id', label: 'Lening', type: 'ref', ref: 'lening', verplicht: true },
      { naam: 'datum', label: 'Datum', type: 'date', verplicht: true },
      { naam: 'bedrag', label: 'Bedrag (€)', type: 'number', verplicht: true },
      bron,
      notitie,
    ],
  },
  waardering: {
    titel: 'Waarderingen',
    uitleg: 'Ondernemingswaarde van de vennootschap op een peildatum.',
    velden: [
      { naam: 'vennootschap_id', label: 'Vennootschap', type: 'ref', ref: 'entiteit', verplicht: true },
      { naam: 'peildatum', label: 'Peildatum', type: 'date', verplicht: true },
      { naam: 'label', label: 'Label', type: 'text', verplicht: true },
      { naam: 'ondernemingswaarde', label: 'Ondernemingswaarde (€)', type: 'number', verplicht: true },
      bron,
      notitie,
    ],
  },
  noemer: {
    titel: 'Noemers',
    uitleg: 'Door hoeveel aandelen wordt de ondernemingswaarde gedeeld? (V-O01)',
    velden: [
      { naam: 'vennootschap_id', label: 'Vennootschap', type: 'ref', ref: 'entiteit', verplicht: true },
      { naam: 'aantal', label: 'Aantal aandelen', type: 'integer', verplicht: true },
      { naam: 'label', label: 'Label', type: 'text', verplicht: true },
      bron,
      notitie,
    ],
  },
  leaver_regel: {
    titel: 'Leaver-regeling',
    uitleg: 'Prijs bij vertrek als percentage van de Marktwaarde. Jaar 1 = eerste jaar na verkrijging.',
    velden: [
      { naam: 'positie_id', label: 'Positie', type: 'ref', ref: 'certificaatpositie', verplicht: true },
      { naam: 'categorie', label: 'Categorie', type: 'enum', opties: ['good', 'early', 'bad'], verplicht: true },
      { naam: 'vanaf_jaar', label: 'Vanaf jaar', type: 'integer' },
      { naam: 'tot_en_met_jaar', label: 't/m jaar', type: 'integer' },
      { naam: 'pct_marktwaarde', label: '% Marktwaarde', type: 'number', verplicht: true },
      { naam: 'max_inleg', label: 'Max. inleg', type: 'bool' },
      bron,
      notitie,
    ],
  },
  instelling: {
    titel: 'Instellingen',
    uitleg: 'Losse parameters.',
    sleutel: 'sleutel',
    velden: [
      { naam: 'sleutel', label: 'Sleutel', type: 'text', verplicht: true },
      { naam: 'waarde', label: 'Waarde', type: 'number', verplicht: true },
      { naam: 'omschrijving', label: 'Omschrijving', type: 'text', lang: true },
      bron,
    ],
  },
  grootboekrekening: {
    titel: 'Grootboekrekeningen',
    uitleg: 'Rekeningschema. "Functie" koppelt een rekening aan automatische boekingen (rente, rekening-courant DGA).',
    labelVeld: 'label',
    velden: [
      { naam: 'nummer', label: 'Nummer', type: 'text', verplicht: true },
      { naam: 'naam', label: 'Naam', type: 'text', verplicht: true },
      { naam: 'soort', label: 'Soort', type: 'enum', opties: ['balans', 'resultaat'], verplicht: true },
      { naam: 'categorie', label: 'Categorie', type: 'text', verplicht: true },
      { naam: 'functie', label: 'Functie', type: 'text' },
      { naam: 'actief', label: 'Actief', type: 'bool', standaard: true },
      notitie,
    ],
  },
  boekjaar: {
    titel: 'Boekjaren',
    uitleg: 'Afsluiten gaat via het overzicht; een afgesloten boekjaar is niet meer te wijzigen.',
    labelVeld: 'label',
    velden: [
      spoor,
      { naam: 'start', label: 'Start', type: 'date', verplicht: true },
      { naam: 'eind', label: 'Eind', type: 'date', verplicht: true },
      { naam: 'status', label: 'Status', type: 'text', berekend: true },
      notitie,
    ],
  },
  overeenkomst: {
    titel: 'Overeenkomsten en besluiten',
    uitleg: 'Schriftelijke vastlegging (art. 2:247 BW bij rechtshandelingen met de aandeelhouder). De getekende versie voeg je als bijlage toe onder Leningen.',
    labelVeld: 'titel',
    velden: [
      spoor,
      { naam: 'soort', label: 'Soort', type: 'enum', opties: ['lening', 'rekening-courant', 'besluit', 'overig'], verplicht: true },
      { naam: 'titel', label: 'Titel', type: 'text', verplicht: true },
      { naam: 'datum', label: 'Datum', type: 'date' },
      { naam: 'lening_id', label: 'Lening', type: 'ref', ref: 'lening' },
      { naam: 'partijen', label: 'Partijen', type: 'text', lang: true },
      { naam: 'ondertekend', label: 'Ondertekend', type: 'bool' },
      bron,
      notitie,
    ],
  },
  gebeurtenis: {
    titel: 'Tijdlijn',
    uitleg: 'Data en termijnen.',
    velden: [
      spoor,
      { naam: 'datum', label: 'Datum', type: 'date', verplicht: true },
      { naam: 'omschrijving', label: 'Omschrijving', type: 'text', verplicht: true, lang: true },
      bron,
    ],
  },
};

export class Invoerfout extends Error {}

// Zet een binnenkomende waarde om naar wat de database verwacht; gooit bij
// ongeldige invoer, zodat de route een 400 kan geven.
export function normaliseer(veld, waarde) {
  if (waarde === undefined || waarde === null || waarde === '') {
    if (veld.verplicht) throw new Invoerfout(`${veld.label} is verplicht`);
    if (veld.standaard !== undefined) return veld.standaard;
    return veld.type === 'bool' ? false : null;
  }
  switch (veld.type) {
    case 'number': {
      const n = Number(String(waarde).replace(',', '.'));
      if (!Number.isFinite(n)) throw new Invoerfout(`${veld.label}: geen geldig getal`);
      return n;
    }
    case 'integer':
    case 'ref':
    case 'spoor': {
      const n = Number(waarde);
      if (!Number.isInteger(n)) throw new Invoerfout(`${veld.label}: geen geheel getal`);
      if (veld.type === 'spoor' && ![1, 2, 3].includes(n)) throw new Invoerfout('Spoor moet 1, 2 of 3 zijn');
      return n;
    }
    case 'bool':
      return waarde === true || waarde === 'true';
    case 'date':
      if (!/^\d{4}-\d{2}-\d{2}$/.test(waarde)) throw new Invoerfout(`${veld.label}: datum als JJJJ-MM-DD`);
      return waarde;
    case 'enum':
      if (!veld.opties.includes(waarde)) throw new Invoerfout(`${veld.label}: kies uit ${veld.opties.join(', ')}`);
      return waarde;
    default:
      return String(waarde);
  }
}
