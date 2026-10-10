import { Children, cloneElement, isValidElement } from 'react';

// Bronnen als links: wetsartikelen naar wetten.overheid.nl (JCI-verwijzing,
// opent op het artikel), tarieven naar de Belastingdienst. Documenten van de
// NAS (B-...) hebben geen URL en blijven tekst.

const WET = {
  'Wet IB 2001': 'BWBR0011353',
  'Wet VpB 1969': 'BWBR0002672',
  AWR: 'BWBR0002320',
  'Wet LB 1964': 'BWBR0002471',
  'Wet DB 1965': 'BWBR0002515',
};
const BW2 = 'BWBR0003045';

export const BELASTINGDIENST = {
  vpb2026:
    'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/zakelijk/winst/vennootschapsbelasting/veranderingen-vennootschapsbelasting-2026/veranderingen-vennootschapsbelasting-2026',
  box2:
    'https://www.belastingdienst.nl/wps/wcm/connect/bldcontentnl/belastingdienst/prive/inkomstenbelasting/heffingskortingen_boxen_tarieven/boxen_en_tarieven/box_2/box_2',
  ab2026: 'https://www.belastingdienst.nl/wps/wcm/connect/fisin/fisin2026/aanmerkelijk_belang',
};

const jci = (bwbr, artikel) => `https://wetten.overheid.nl/jci1.3:c:${bwbr}&artikel=${artikel}`;

// "art. 4.19 en 4.21 Wet IB 2001", "art. 13 lid 2 Wet VpB 1969", "art. 2:247 BW".
const PATROON =
  /art\. (2:\d+[a-z]?)((?: lid \d+)?) BW|art\. (\d+(?:\.\d+)?[a-z]?)((?: lid \d+)?(?: onderdeel [a-z])?(?: (?:en|,) \d+(?:\.\d+)?[a-z]?)*) (Wet IB 2001|Wet VpB 1969|AWR|Wet LB 1964|Wet DB 1965)/g;

function linkTekst(tekst) {
  if (typeof tekst !== 'string' || !tekst.includes('art.')) return tekst;
  const delen = [];
  let rest = 0;
  for (const m of tekst.matchAll(PATROON)) {
    if (m.index > rest) delen.push(tekst.slice(rest, m.index));
    if (m[1]) {
      delen.push(<a key={m.index} href={jci(BW2, m[1].slice(2))} target="_blank" rel="noreferrer" className="bron">{m[0]}</a>);
    } else {
      // Bij "art. 4.19 en 4.21 Wet IB 2001" linkt het eerste artikel; de
      // volgende nummers krijgen elk een eigen link.
      const wet = WET[m[5]];
      const extra = [...(m[4] ?? '').matchAll(/(?:en|,) (\d+(?:\.\d+)?[a-z]?)/g)];
      if (!extra.length) {
        delen.push(<a key={m.index} href={jci(wet, m[3])} target="_blank" rel="noreferrer" className="bron">{m[0]}</a>);
      } else {
        delen.push(<a key={m.index} href={jci(wet, m[3])} target="_blank" rel="noreferrer" className="bron">art. {m[3]}</a>);
        for (const [i, e] of extra.entries()) {
          delen.push(` ${e[0].split(' ')[0]} `);
          delen.push(<a key={`${m.index}-${i}`} href={jci(wet, e[1])} target="_blank" rel="noreferrer" className="bron">{e[1]}</a>);
        }
        delen.push(` ${m[5]}`);
      }
    }
    rest = m.index + m[0].length;
  }
  if (!delen.length) return tekst;
  if (rest < tekst.length) delen.push(tekst.slice(rest));
  return delen;
}

// Loopt door de JSX die een scherm opbouwt en maakt wetsverwijzingen in tekst
// klikbaar, ook in de 'sub'-regel van een KPI. Laat links, invoer en
// keuzelijsten met rust.
const OVERSLAAN = new Set(['a', 'input', 'select', 'option', 'textarea', 'button']);

function verwerk(knoop) {
  if (typeof knoop === 'string') return linkTekst(knoop);
  if (Array.isArray(knoop)) return knoop.map(verwerk);
  if (!isValidElement(knoop) || OVERSLAAN.has(knoop.type)) return knoop;
  const props = {};
  if (knoop.props.children !== undefined) props.children = Children.map(knoop.props.children, verwerk);
  if (knoop.props.sub !== undefined) props.sub = verwerk(knoop.props.sub);
  return Object.keys(props).length ? cloneElement(knoop, props) : knoop;
}

export function MetBronnen({ children }) {
  return Children.map(children, verwerk);
}
