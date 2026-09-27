import { useEffect, useState } from 'react';
import { api } from './api.js';
import { datum, eur, num, pct } from './format.js';
import { Bereik, Kpi, Netto } from './onderdelen.jsx';
import { BELASTINGDIENST, MetBronnen } from './bronnen.jsx';

// Overdracht privé → holding: verkoop van de privécertificaten tegen
// marktwaarde aan Dreves Holding B.V. Per jaar van overdracht: prijs bij ×3 en
// ×4, het resultaat privé, de schuld die opeisbaar kan worden, en daarna de
// belasting op het dividend. De voorwaarden staan eronder, met hun vindplaats.

const bereik = (lijst) => ({ min: Math.min(...lijst), max: Math.max(...lijst) });

export default function Overdracht() {
  const [box2Vanaf, setBox2Vanaf] = useState('');
  const [vp, setVp] = useState('inleg');
  const [data, setData] = useState(null);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    const q = new URLSearchParams({ box2_vanaf: box2Vanaf, verkrijgingsprijs: vp });
    api.get(`/overdracht?${q}`).then((d) => { setData(d); setFout(null); }, (e) => setFout(e.message));
  }, [box2Vanaf, vp]);

  if (fout) return <p className="fout">{fout}</p>;
  if (!data) return <p className="uitleg">Laden…</p>;
  const eerste = data.rijen[0];
  const box2 = data.box2_vanaf != null;

  return (
    <MetBronnen>
    <>
      <h2>
        Privécertificaten verkopen aan Dreves Holding B.V.{' '}
        <small>· {num(data.prive.aandelen)} aandelen tegen marktwaarde</small>
      </h2>
      <p className="uitleg">
        Verkoop tegen marktwaarde; ×3 en ×4 geven de bandbreedte van minst tot meest gunstig (B-PRES dia 8). Overdracht op
        31-12 van het jaar: de prijs is de waardering die in dat jaar geldt (A12), de schuld die op die datum. Zelfde
        waardering, lening en boxkeuze als bij Verra A&V.
      </p>
      <div className="keuzes">
        <label>
          Privé belast in{' '}
          <select value={String(data.box2_vanaf ?? 'nooit')} onChange={(e) => setBox2Vanaf(e.target.value)}>
            <option value="nooit">box 3, alle jaren</option>
            {data.rijen.map((r) => (
              <option key={r.jaar} value={String(r.jaar)}>box 2 vanaf {r.jaar}</option>
            ))}
          </select>{' '}
          <small>V-F47, V-F48, A13</small>
        </label>
        {box2 && (
          <label>
            Verkrijgingsprijs box 2{' '}
            <select value={data.verkrijgingsprijs} onChange={(e) => setVp(e.target.value)}>
              <option value="inleg">inleg {eur(data.prive.inleg)}</option>
              <option value="waarde_ontstaan">waarde bij ontstaan aanmerkelijk belang ({data.box2_vanaf})</option>
            </select>{' '}
            <small>V-F49</small>
          </label>
        )}
      </div>

      <div className="kpis">
        {data.na_overdracht && (
          <Kpi titel="Holding na overdracht" waarde={`${num(data.na_overdracht.aandelen)} van ${data.noemer} = ${pct(data.na_overdracht.pct)}`}
            sub={`nu ${num(data.holding.aandelen)}; privé houdt daarna niets meer rechtstreeks`} />
        )}
        {eerste && (
          <>
            <Kpi titel={`Koopsom bij overdracht ${datum(eerste.datum)}`} waarde={<Bereik {...bereik(eerste.per_factor.map((f) => f.prijs))} kleur={false} />}
              sub={eerste.per_factor.map((f) => `×${num(f.factor)} ${eur(f.per_aandeel)}/aandeel`).join(' · ')} />
            <Kpi titel="Resultaat privé" waarde={<Bereik {...bereik(eerste.per_factor.map((f) => f.resultaat))} />}
              sub={eerste.box === 2 ? `tegenover verkrijgingsprijs ${eur(eerste.per_factor[0].verkrijgingsprijs)}` : 'box 3: niet belast als resultaat'} />
            <Kpi titel="Box 2-heffing bij overdracht" waarde={eerste.box === 2 ? <Bereik {...bereik(eerste.per_factor.map((f) => Math.max(0, f.heffing)))} kleur={false} /> : eur(0)}
              sub={eerste.box === 2 && eerste.per_factor.some((f) => f.heffing < 0) ? 'verlies uit aanmerkelijk belang, verrekenbaar (art. 4.49 Wet IB 2001)' : `box ${eerste.box}`} />
            <Kpi titel="Schuld lening 2024" waarde={eur(eerste.schuld)} sub="opeisbaar bij einde participatie (F16); of overdracht dat is, is open (V-F57)" />
          </>
        )}
      </div>

      <Conclusie data={data} />

      <section className="kaart">
        <h3>Per jaar van overdracht</h3>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Overdracht op</th>
                {data.factoren.map((f) => <th key={f} className="getal">×{num(f)}: koopsom · resultaat · box 2</th>)}
                <th className="getal">Schuld lening 2024</th>
                <th className="getal">Kas privé als de lening opeisbaar wordt</th>
              </tr>
            </thead>
            <tbody>
              {data.rijen.map((r) => (
                <tr key={r.jaar}>
                  <td>{datum(r.datum)}<br /><small>box {r.box}</small></td>
                  {r.per_factor.map((f) => (
                    <td key={f.factor} className="getal">
                      <strong>{eur(f.prijs)}</strong> <small>({eur(f.per_aandeel)}/aandeel)</small>
                      <br />resultaat <Netto n={f.resultaat} />
                      <br />
                      <small>
                        {r.box === 3 ? 'box 3: geen heffing over het resultaat'
                          : f.heffing > 0 ? `te betalen ${eur(f.heffing)} (${pct(data.dividend.box2_tarief)})`
                          : f.heffing < 0 ? `verlies, waarde ${eur(-f.heffing)} bij verrekening`
                          : 'geen heffing'}
                      </small>
                      <br /><small>{f.waarde_bron}</small>
                    </td>
                  ))}
                  <td className="getal">{eur(r.schuld)}</td>
                  <td className="getal"><Bereik {...bereik(r.per_factor.map((f) => f.kas_na_schuld))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="uitleg">
          <li>
            Resultaat = koopsom − verkrijgingsprijs (art. 4.19 en 4.21 Wet IB 2001). In box 2 belast tegen {pct(data.dividend.box2_tarief)} in
            de eerste schijf (art. 2.12 Wet IB 2001; schijfgrens 2026 € 68.843, <a className="bron" href={BELASTINGDIENST.box2} target="_blank" rel="noreferrer">Belastingdienst</a>). Een negatief resultaat is een verlies uit
            aanmerkelijk belang dat alleen iets oplevert als het wordt verrekend met ander box 2-inkomen (art. 4.49 Wet IB 2001).
          </li>
          <li>
            In box 3 wordt het resultaat niet belast; de heffing gaat over het vermogen op 1 januari. Na verkoop is de
            vordering op de holding (of het geld) privévermogen in plaats van de certificaten.
          </li>
          <li>
            "Kas privé" = koopsom − schuld − box 2-heffing, als de lening bij de overdracht in één keer moet worden afgelost.
            Negatief betekent bijbetalen uit eigen middelen. Blijft de koopsom schuldig bij de holding, dan is er geen kas maar
            een vordering op de holding.
          </li>
          <li>
            De waarde loopt na 2026 door zolang er geen nieuwe jaarresultaten of waardering zijn (Verra A&V → Stamdata).
            Komt de waardering boven de verkrijgingsprijs uit, dan kost een latere overdracht in box 2 meer.
          </li>
        </ul>
      </section>

      <section className="kaart">
        <h3>Na de overdracht: belasting op het dividend over deze {num(data.prive.aandelen)} aandelen</h3>
        <p className="uitleg">
          Bij {eur(data.dividend.totaal_vennootschap)} dividend van de vennootschap (het laatst ontvangen dividend, omgerekend)
          is dat {eur(data.dividend.bruto)} bruto per jaar.
        </p>
        <div className="kpis">
          <Kpi titel="Privé, box 2" waarde={eur(data.dividend.prive_box2)} sub={`${pct(data.dividend.box2_tarief)}; dividendbelasting is voorheffing`} />
          <Kpi titel="Privé, box 3" waarde={eur(data.dividend.prive_box3)} sub="dividend zelf onbelast; vermogen op 1-1 wel (niet gemodelleerd)" />
          <Kpi titel="Holding, met deelnemingsvrijstelling" waarde={eur(data.dividend.holding_met_dv)} sub="art. 13 Wet VpB 1969; of die geldt, is open (V-F19)" />
          <Kpi titel="Holding, zonder deelnemingsvrijstelling" waarde={data.dividend.holding_zonder_dv == null ? '—' : eur(data.dividend.holding_zonder_dv)}
            sub={data.dividend.vpb_tarief == null ? 'VpB-tarief ontbreekt in de instellingen' : <>{pct(data.dividend.vpb_tarief)} VpB, art. 22 Wet VpB 1969 · <a className="bron" href={BELASTINGDIENST.vpb2026} target="_blank" rel="noreferrer">Belastingdienst</a></>} />
        </div>
        <p className="uitleg">
          Wat in de holding blijft, is niet privé beschikbaar: een uitkering van de holding aan A. Dreves is later belast in box 2
          (100% aanmerkelijk belang). Het voordeel is dus vooral uitstel, en ruimte om binnen de holding aan te wenden (bijv.
          aflossing van de lening 2025).
        </p>
      </section>

      <section className="kaart">
        <h3>Voorwaarden en open punten</h3>
        <ul className="voorwaarden">
          <li><strong>Toestemming van de STAK.</strong> Vervreemding door de participant is niet toegestaan (F18, B-PART-OVK art. 5.1); overdracht aan de holding vergt toestemming (V-O07, art. 5.1 en 8.6).</li>
          <li><strong>Lening 2024.</strong> Opeisbaar bij beëindiging van de participatie (F16, B-GL-2024 art. 4.1(a)); de geldgever mag verrekenen (art. 4.2). Of een overdracht aan de eigen holding de participatie beëindigt, is open (V-F57).</li>
          <li><strong>Leaverregeling.</strong> Geldt nu voor de privépositie (B-PART-OVK art. 6). Of zij na overdracht voor deze certificaten bij de holding blijft gelden, is open (V-F58).</li>
          <li><strong>Schriftelijk vastleggen.</strong> Koop tussen de holding en haar enig aandeelhouder: art. 2:247 BW. Blijft de koopsom schuldig, dan ook de lening of rekening-courant van A. Dreves aan de holding, met zakelijke rente.</li>
          <li><strong>Zakelijke prijs.</strong> Tussen A. Dreves en de eigen holding moet de prijs de marktwaarde zijn; welke factor de STAK hanteert, is open (V-F44).</li>
          <li><strong>Box 2 of box 3 privé</strong> (V-F47, V-F48), de verkrijgingsprijs in box 2 (V-F49) en de gevolgen van inbreng of verkoop (V-F03, V-F35).</li>
          <li><strong>Deelnemingsvrijstelling bij de holding</strong> na overdracht, bij {data.na_overdracht ? pct(data.na_overdracht.pct) : '—'}: de 5%-eis (art. 13 lid 2 Wet VpB 1969) en de vraag of certificaten zonder vergaderrecht kwalificeren (V-F19).</li>
          <li><strong>Lucratief belang.</strong> Kwalificeren de certificaten als lucratief belang, dan gelden andere regels (art. 3.92b Wet IB 2001, V-F09).</li>
          <li><strong>Hypotheek.</strong> Onderbrengen in de holding zou de leencapaciteit niet raken (adviseursnotities, V-F53); niet-fiscaal argument.</li>
        </ul>
      </section>
    </>
    </MetBronnen>
  );
}

// Wat de huidige cijfers zeggen over het moment. Afgeleid, geen advies: de
// open punten hieronder kunnen de uitkomst omdraaien.
function Conclusie({ data }) {
  const rijen = data.rijen;
  if (!rijen.length) return null;
  const heffing = (r) => r.per_factor.map((f) => Math.max(0, f.heffing));
  const zonder = rijen.filter((r) => heffing(r).every((h) => h === 0));
  const eersteMet = rijen.find((r) => heffing(r).some((h) => h > 0));
  const schuldGroei = rijen.at(-1).schuld - rijen[0].schuld;
  const jarenDividend = rijen.length - 1;
  const perJaar = data.box2_vanaf != null ? data.dividend.prive_box2 : 0;
  return (
    <MetBronnen>
    <section className="kaart conclusie">
      <h3>Wat de huidige cijfers zeggen</h3>
      <ul>
        <li>
          {zonder.length === rijen.length
            ? `Overdracht kost in geen van de jaren ${rijen[0].jaar}–${rijen.at(-1).jaar} box 2-heffing, bij ×3 noch ×4.`
            : zonder.length
              ? `Zonder box 2-heffing kan het t/m ${zonder.at(-1).jaar}; vanaf ${eersteMet.jaar} is er heffing bij ten minste één factor.`
              : 'Overdracht kost in elk jaar box 2-heffing bij ten minste één factor.'}
          {data.box2_vanaf == null && ' In box 3 wordt het resultaat niet belast.'}
        </li>
        {data.box2_vanaf != null && (
          <li>
            Het dividend over deze aandelen kost privé {eur(perJaar)} per jaar in box 2. Eerder overdragen in {rijen[0].jaar} in plaats van{' '}
            {rijen.at(-1).jaar} scheelt {jarenDividend} jaar, {eur(perJaar * jarenDividend)} — mits de deelnemingsvrijstelling geldt (V-F19),
            en als uitstel: uitkeren aan A. Dreves is later box 2.
          </li>
        )}
        <li>
          De schuld op de lening 2024 loopt in die periode {schuldGroei >= 0 ? 'op' : 'af'} met {eur(Math.abs(schuldGroei))}. Wordt zij bij overdracht
          opeisbaar (V-F57), dan moet er {rijen[0].per_factor.every((f) => f.kas_na_schuld < 0) ? 'in elk scenario' : 'mogelijk'} uit eigen middelen worden bijbetaald.
        </li>
        <li>
          De waarde na {rijen[0].jaar} is doorgetrokken; pas met nieuwe jaarresultaten (Verra A&V → Stamdata) blijkt of een later moment duurder wordt.
        </li>
      </ul>
    </section>
    </MetBronnen>
  );
}
