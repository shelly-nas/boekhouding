import { Fragment, useEffect, useState } from 'react';
import { api } from './api.js';
import { datum, eurc, pct } from './format.js';
import { BELASTINGDIENST, MetBronnen } from './bronnen.jsx';
import { Kpi } from './onderdelen.jsx';

// Fase B: concept-jaarrekening en VpB-berekening van Dreves Holding B.V.,
// afgeleid uit het journaal. De bestuurder maakt de jaarrekening op; als enig
// aandeelhouder stelt hij haar vast door te ondertekenen.

function NogTeDoen({ lijst }) {
  if (!lijst.length) return <p className="uitleg">Geen openstaande controles.</p>;
  return (
    <MetBronnen>
    <section className="kaart">
      <h3>Eerst nog te doen</h3>
      <p className="uitleg">Zolang deze punten openstaan, is dit een concept.</p>
      <ul>
        {lijst.map((m, i) => (
          <li key={i}><strong>{m.titel}</strong> — {m.detail} <small>{m.grond}</small></li>
        ))}
      </ul>
    </section>
    </MetBronnen>
  );
}

function Zijde({ titel, groepen, totaal }) {
  return (
    <div>
      <h4>{titel}</h4>
      <table>
        <tbody>
          {groepen.map((g) => (
            <Fragment key={g.post}>
              <tr className="subkop"><td>{g.post}</td><td className="getal">{eurc(g.totaal)}</td></tr>
              {g.regels.map((r) => (
                <tr key={`${g.post}-${r.nummer}-${r.naam}`}><td className="inspring"><small>{r.nummer} {r.naam}</small></td><td className="getal"><small>{eurc(r.bedrag)}</small></td></tr>
              ))}
            </Fragment>
          ))}
          <tr className="totaal"><td>Totaal</td><td className="getal">{eurc(totaal)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function Jaarrekening({ boekjaar }) {
  const [definitief, setDefinitief] = useState(false);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  useEffect(() => {
    api.get(`/administratie/jaarrekening?boekjaar_id=${boekjaar.id}&alleen_definitief=${definitief}`).then(setData, (e) => setFout(e.message));
  }, [boekjaar.id, definitief]);
  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const bj = data.boekjaar;

  return (
    <MetBronnen>
      <div className="balk">
        <label className="vink">
          <input type="checkbox" checked={definitief} onChange={(e) => setDefinitief(e.target.checked)} /> alleen definitieve boekingen
        </label>
        {data.concept > 0 && !definitief && <span className="uitleg">Inclusief {data.concept} conceptboeking(en).</span>}
      </div>
      <h2>
        Concept-jaarrekening {datum(bj.start)} t/m {datum(bj.eind)}{' '}
        <small>· {data.dagen} dagen{data.verlengd ? ', eerste boekjaar verlengd (F4)' : ''}</small>
      </h2>

      <section className="kaart">
        <h3>Balans per {datum(bj.eind)}</h3>
        <div className="twee">
          <Zijde titel="Activa" groepen={data.balans.activa} totaal={data.balans.totaal_activa} />
          <Zijde titel="Passiva" groepen={data.balans.passiva} totaal={data.balans.totaal_passiva} />
        </div>
      </section>

      <section className="kaart">
        <h3>Winst-en-verliesrekening</h3>
        <table>
          <tbody>
            {data.wv.map((g) => (
              <tr key={g.post}><td>{g.post}</td><td className="getal">{g.teken < 0 ? '−' : ''}{eurc(g.totaal)}</td></tr>
            ))}
            <tr className="totaal"><td>Resultaat vóór belastingen</td><td className="getal">{eurc(data.resultaat_voor_belasting)}</td></tr>
            <tr><td>Vennootschapsbelasting (geboekt)</td><td className="getal">−{eurc(data.vpb_geboekt)}</td></tr>
            <tr className="totaal"><td>Resultaat na belastingen</td><td className="getal">{eurc(data.resultaat_na_belasting)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="kaart">
        <h3>Toelichting (concept)</h3>
        <ul>
          <li><strong>Grondslagen.</strong> Certificaten tegen verkrijgingsprijs; vorderingen en schulden tegen nominale waarde. Het resultaat is het verschil tussen de baten en lasten die aan het boekjaar zijn toe te rekenen.</li>
          <li><strong>Eerste boekjaar</strong> {datum(bj.start)} t/m {datum(bj.eind)}, verlengd bij de oprichting (B-AKTE-OPR). Geen vergelijkende cijfers.</li>
          <li><strong>Omvang.</strong> Het micro-regime (art. 2:395a BW) geldt niet voor een participatieonderneming (art. 2:398 lid 6 BW). Houdt de holding alleen de certificaten zonder zich met de bedrijfsvoering in te laten, dan is zij dat vermoedelijk en geldt het regime voor kleine rechtspersonen (art. 2:396 BW) — aanname A5, open vraag V-F60.</li>
          <li><strong>Termijnen.</strong> Opmaken binnen vijf maanden na afloop van het boekjaar (art. 2:210 lid 1 BW); de ondertekening door de enig aandeelhouder-bestuurder geldt als vaststelling. Deponeren bij de KVK: art. 2:394 BW.</li>
        </ul>
      </section>

      <NogTeDoen lijst={data.nog_te_doen} />
    </MetBronnen>
  );
}

export function Vpb({ boekjaar }) {
  const [definitief, setDefinitief] = useState(false);
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);
  useEffect(() => {
    api.get(`/administratie/vpb?boekjaar_id=${boekjaar.id}&alleen_definitief=${definitief}`).then(setData, (e) => setFout(e.message));
  }, [boekjaar.id, definitief]);
  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const t = data.tarief;
  const [zonder, met] = data.varianten;
  const verschilGeboekt = zonder.vpb != null && Math.abs(zonder.vpb - data.vpb_geboekt) >= 0.01;

  return (
    <MetBronnen>
      <div className="balk">
        <label className="vink">
          <input type="checkbox" checked={definitief} onChange={(e) => setDefinitief(e.target.checked)} /> alleen definitieve boekingen
        </label>
      </div>
      <h2>
        VpB-berekening {datum(data.boekjaar.start)} t/m {datum(data.boekjaar.eind)}{' '}
        <small>· eerste aangifte, over het verlengde boekjaar</small>
      </h2>
      <div className="kpis">
        <Kpi titel="Resultaat vóór belastingen" waarde={eurc(data.resultaat_voor_belasting)} sub="uit de jaarrekening" />
        <Kpi titel="VpB zonder deelnemingsvrijstelling" waarde={zonder.vpb == null ? '—' : eurc(zonder.vpb)}
          sub={zonder.verlies ? `verlies ${eurc(zonder.verlies)}, verrekenbaar (art. 20 Wet VpB 1969)` : `belastbaar ${eurc(zonder.belastbaar_bedrag)}`} />
        <Kpi titel="VpB met deelnemingsvrijstelling" waarde={met.vpb == null ? '—' : eurc(met.vpb)}
          sub={met.verlies ? `verlies ${eurc(met.verlies)}, verrekenbaar` : `belastbaar ${eurc(met.belastbaar_bedrag)}`} />
        <Kpi titel="VpB geboekt" waarde={eurc(data.vpb_geboekt)} sub={verschilGeboekt ? 'wijkt af van de berekening' : 'sluit aan (zonder vrijstelling)'} />
      </div>

      <section className="kaart">
        <h3>Van resultaat naar belastbaar bedrag</h3>
        <table>
          <thead>
            <tr><th /><th className="getal">Zonder deelnemingsvrijstelling</th><th className="getal">Met deelnemingsvrijstelling</th></tr>
          </thead>
          <tbody>
            <tr><td>Resultaat vóór belastingen</td><td className="getal">{eurc(data.resultaat_voor_belasting)}</td><td className="getal">{eurc(data.resultaat_voor_belasting)}</td></tr>
            {met.correcties.map((c) => (
              <tr key={c.omschrijving}><td>{c.omschrijving} <small>{c.grond}</small></td><td className="getal">—</td><td className="getal">{eurc(c.bedrag)}</td></tr>
            ))}
            <tr className="totaal"><td>Belastbaar bedrag</td><td className="getal">{eurc(zonder.belastbaar_bedrag)}</td><td className="getal">{eurc(met.belastbaar_bedrag)}</td></tr>
            <tr><td>VpB</td><td className="getal">{eurc(zonder.vpb)}</td><td className="getal">{eurc(met.vpb)}</td></tr>
          </tbody>
        </table>
        <ul className="uitleg">
          <li>
            Tarief: {pct(t.laag)} tot {eurc(t.grens)}, {pct(t.hoog)} daarboven (art. 22 Wet VpB 1969; 2025 en 2026 gelijk,{' '}
            <a className="bron" href={BELASTINGDIENST.vpb2026} target="_blank" rel="noreferrer">Belastingdienst</a>). Bij een boekjaar over twee
            kalenderjaren wordt de winst naar dagen over de jaren verdeeld, elk met het tarief van dat jaar; de schijfgrens wordt niet verhoogd.
            Omdat de tarieven van 2025 en 2026 gelijk zijn, maakt dat hier niets uit.
          </li>
          <li>
            Een verlies is voorwaarts onbeperkt verrekenbaar en een jaar achterwaarts; boven € 1 mln alleen met 50% van de winst
            (art. 20 Wet VpB 1969).
          </li>
          <li>
            Deelnemingsvrijstelling: of de certificaten kwalificeren is open (V-F19, V-F48). Dividend uit de certificaten dit boekjaar:{' '}
            {eurc(data.dividend_certificaten)}.
          </li>
          <li>
            Niet in deze berekening: het honorarium voor de overname (nog niet geboekt; aftrek en doorbelasting V-F23, V-F32) en een eventuele
            renteaftrekbeperking (V-F36).
          </li>
          <li>Aangifte: zonder uitnodiging geldt een eigen meldplicht (art. 6 lid 3 AWR, V-F02).</li>
        </ul>
      </section>

      <NogTeDoen lijst={data.nog_te_doen} />
    </MetBronnen>
  );
}
