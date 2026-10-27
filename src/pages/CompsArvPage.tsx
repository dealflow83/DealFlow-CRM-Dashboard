import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { average, median, num, sum } from '@/lib/finance';
import {
  ArvAnalysis,
  Comparable,
  PROPERTY_CONDITIONS,
  PropertyType,
} from '@/types';
import { money } from '@/lib/format';

const propertyTypes: PropertyType[] = ['Single Family', 'Multi Family', 'Condo', 'Land', 'Commercial'];

const OWNER_ID = 'local-preview-user';

const emptySubject = {
  property_address: '',
  country: '',
  state_province: '',
  city: '',
  area: '',
  zip_code: '',
  property_type: 'Single Family' as PropertyType,
  bedrooms: '',
  bathrooms: '',
  square_footage: '',
  lot_size: '',
  property_condition: 'Average',
  estimated_repair_costs: '',
  notes: '',
};

type SubjectDraft = typeof emptySubject;

function emptyComp(): Omit<Comparable, 'id' | 'arv_analysis_id' | 'created_at'> {
  return {
    address: '',
    sale_price: '',
    sale_date: '',
    square_footage: '',
    bedrooms: '',
    bathrooms: '',
    property_type: 'Single Family',
    property_condition: 'Average',
    distance: '',
    notes: '',
    excluded: false,
  } as unknown as Omit<Comparable, 'id' | 'arv_analysis_id' | 'created_at'>;
}

type CompDraft = ReturnType<typeof emptyComp>;

type Calc = {
  validComps: number;
  avgPriceSqft: number | null;
  medianSale: number | null;
  avgSale: number | null;
  estimatedArv: number | null;
  arvLow: number | null;
  arvHigh: number | null;
  repairCosts: number | null;
  equity: number | null;
  warnings: string[];
};

function computeArv(subject: SubjectDraft, comps: CompDraft[]): Calc {
  const warnings: string[] = [];
  const active = comps.filter((c) => !c.excluded && num(c.sale_price) !== null && num(c.square_footage) && (num(c.square_footage) as number) > 0);
  const priceSqfts = active
    .map((c) => (num(c.sale_price) as number) / (num(c.square_footage) as number))
    .filter((p) => Number.isFinite(p) && p > 0);
  const sales = active.map((c) => num(c.sale_price) as number).filter((p) => p > 0);

  const avgPriceSqft = priceSqfts.length ? average(priceSqfts) : null;
  const medianSale = median(sales);
  const avgSale = average(sales);
  const sqft = num(subject.square_footage);

  let estimatedArv: number | null = null;
  if (avgPriceSqft !== null && sqft && sqft > 0) {
    estimatedArv = avgPriceSqft * sqft;
  }

  // ARV range: ±5% when we have a point estimate.
  const arvLow = estimatedArv !== null ? estimatedArv * 0.95 : null;
  const arvHigh = estimatedArv !== null ? estimatedArv * 1.05 : null;

  const repairCosts = num(subject.estimated_repair_costs);
  // Equity/spread needs an asking price; not part of this calculator's inputs,
  // so we leave it null unless we can derive one. Kept for future lead linkage.
  const equity: number | null = null;

  if (active.length === 0) warnings.push('Add at least one comparable with a sale price and square footage to estimate ARV.');
  if (active.length > 0 && active.length < 3) warnings.push('For a more reliable ARV, use at least three comparable sales.');
  if (estimatedArv !== null && !sqft) warnings.push('Enter the subject property square footage to compute ARV from price per square foot.');

  return {
    validComps: active.length,
    avgPriceSqft,
    medianSale,
    avgSale,
    estimatedArv,
    arvLow,
    arvHigh,
    repairCosts,
    equity,
    warnings,
  };
}

export function CompsArvPage() {
  const [subject, setSubject] = useState<SubjectDraft>(emptySubject);
  const [comps, setComps] = useState<CompDraft[]>([emptyComp()]);
  const [saved, setSaved] = useState<ArvAnalysis[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  const calc = useMemo(() => computeArv(subject, comps), [subject, comps]);

  useEffect(() => {
    void loadSaved();
  }, []);

  async function loadSaved() {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('arv_analyses')
      .select('*')
      .order('updated_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(`Could not load saved analyses: ${err.message}`);
      return;
    }
    setSaved((data as ArvAnalysis[]) || []);
  }

  function updateSubject(key: keyof SubjectDraft, value: string) {
    setSubject((s) => ({ ...s, [key]: value }));
  }

  function updateComp(index: number, key: keyof CompDraft, value: string | boolean) {
    setComps((list) => list.map((c, i) => (i === index ? { ...c, [key]: value } : c)));
  }

  function addComp() {
    setComps((list) => [...list, emptyComp()]);
  }

  function removeComp(index: number) {
    setComps((list) => list.filter((_, i) => i !== index));
  }

  function newAnalysis() {
    setSubject(emptySubject);
    setComps([emptyComp()]);
    setCurrentId(null);
    setInfo('');
    setShowSaved(false);
  }

  async function saveAnalysis(event: FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!subject.property_address.trim()) {
      setError('Property address is required before saving.');
      return;
    }
    setLoading(true);
    const now = new Date().toISOString();
    const payload = {
      owner_id: OWNER_ID,
      property_address: subject.property_address.trim(),
      country: subject.country.trim(),
      state_province: subject.state_province.trim(),
      city: subject.city.trim(),
      area: subject.area.trim(),
      zip_code: subject.zip_code.trim(),
      property_type: subject.property_type,
      bedrooms: num(subject.bedrooms),
      bathrooms: num(subject.bathrooms),
      square_footage: num(subject.square_footage),
      lot_size: num(subject.lot_size),
      property_condition: subject.property_condition,
      estimated_repair_costs: calc.repairCosts,
      estimated_arv: calc.estimatedArv,
      arv_low: calc.arvLow,
      arv_high: calc.arvHigh,
      avg_price_sqft: calc.avgPriceSqft,
      median_sale_price: calc.medianSale,
      avg_sale_price: calc.avgSale,
      notes: subject.notes.trim(),
      updated_at: now,
    };

    let analysisId = currentId;
    if (analysisId) {
      const { error: err } = await supabase.from('arv_analyses').update(payload).eq('id', analysisId);
      if (err) {
        setLoading(false);
        setError(`Save failed: ${err.message}`);
        return;
      }
      await supabase.from('comparables').delete().eq('arv_analysis_id', analysisId);
    } else {
      const { data, error: err } = await supabase
        .from('arv_analyses')
        .insert({ ...payload, created_at: now })
        .select('id')
        .maybeSingle();
      if (err || !data) {
        setLoading(false);
        setError(`Save failed: ${err?.message || 'No row returned'}`);
        return;
      }
      analysisId = (data as { id: string }).id;
      setCurrentId(analysisId);
    }

    const compRows = comps
      .filter((c) => c.address.trim() || num(c.sale_price) !== null)
      .map((c) => ({
        arv_analysis_id: analysisId,
        address: c.address.trim(),
        sale_price: num(c.sale_price),
        sale_date: c.sale_date,
        square_footage: num(c.square_footage),
        bedrooms: num(c.bedrooms),
        bathrooms: num(c.bathrooms),
        property_type: c.property_type,
        property_condition: c.property_condition,
        distance: num(c.distance),
        notes: c.notes.trim(),
        excluded: c.excluded,
      }));
    if (compRows.length) {
      const { error: err } = await supabase.from('comparables').insert(compRows);
      if (err) {
        setLoading(false);
        setError(`Comparables save failed: ${err.message}`);
        return;
      }
    }
    setLoading(false);
    setInfo(currentId ? 'Analysis updated.' : 'Analysis saved.');
    void loadSaved();
  }

  async function openAnalysis(row: ArvAnalysis) {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('comparables')
      .select('*')
      .eq('arv_analysis_id', row.id)
      .order('created_at', { ascending: true });
    setLoading(false);
    if (err) {
      setError(`Could not load comparables: ${err.message}`);
      return;
    }
    const list = (data as Comparable[]) || [];
    setSubject({
      property_address: row.property_address,
      country: row.country,
      state_province: row.state_province,
      city: row.city,
      area: row.area,
      zip_code: row.zip_code,
      property_type: row.property_type as PropertyType,
      bedrooms: row.bedrooms != null ? String(row.bedrooms) : '',
      bathrooms: row.bathrooms != null ? String(row.bathrooms) : '',
      square_footage: row.square_footage != null ? String(row.square_footage) : '',
      lot_size: row.lot_size != null ? String(row.lot_size) : '',
      property_condition: row.property_condition,
      estimated_repair_costs: row.estimated_repair_costs != null ? String(row.estimated_repair_costs) : '',
      notes: row.notes,
    });
    setComps(
      list.length
        ? list.map((c) => ({
            address: c.address,
            sale_price: c.sale_price != null ? String(c.sale_price) : '',
            sale_date: c.sale_date,
            square_footage: c.square_footage != null ? String(c.square_footage) : '',
            bedrooms: c.bedrooms != null ? String(c.bedrooms) : '',
            bathrooms: c.bathrooms != null ? String(c.bathrooms) : '',
            property_type: c.property_type,
            property_condition: c.property_condition,
            distance: c.distance != null ? String(c.distance) : '',
            notes: c.notes,
            excluded: c.excluded,
          }))
        : [emptyComp()],
    );
    setCurrentId(row.id);
    setShowSaved(false);
    setInfo(`Opened "${row.property_address || 'analysis'}".`);
  }

  async function deleteAnalysis(row: ArvAnalysis) {
    if (!confirm(`Delete this ARV analysis for "${row.property_address || 'this property'}"? This cannot be undone.`)) return;
    setLoading(true);
    const { error: err } = await supabase.from('arv_analyses').delete().eq('id', row.id);
    setLoading(false);
    if (err) {
      setError(`Delete failed: ${err.message}`);
      return;
    }
    if (currentId === row.id) newAnalysis();
    void loadSaved();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Comps / ARV Calculator</h1>
          <p>Build a comparable-sales analysis and estimate After Repair Value from real comps you enter.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => setShowSaved((v) => !v)}>
            <ClipboardList size={16} /> {saved.length} Saved
          </button>
          <button className="secondary-button" onClick={newAnalysis}>
            <Plus size={16} /> New
          </button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={15} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {info && <div className="notice-bar"><CheckCircle2 size={14} /><b>{info}</b></div>}

      {showSaved && (
        <section className="panel saved-list-panel">
          <div className="panel-title">
            <div><ClipboardList size={18} /><h2>Saved Analyses</h2></div>
            <button onClick={() => setShowSaved(false)}>Close</button>
          </div>
          {loading && <p className="muted-line">Loading…</p>}
          {!loading && saved.length === 0 && <EmptyInline text="No saved analyses yet. Save this analysis to start your history." />}
          {saved.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Property</th><th>ARV</th><th>Comps</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {saved.map((row) => (
                    <tr key={row.id}>
                      <td><b>{row.property_address || 'Untitled'}</b><small>{[row.city, row.state_province].filter(Boolean).join(', ')}</small></td>
                      <td>{row.estimated_arv != null ? money(row.estimated_arv) : '—'}</td>
                      <td>{row.median_sale_price != null ? 'Computed' : '—'}</td>
                      <td>{new Date(row.updated_at).toLocaleDateString()}</td>
                      <td className="table-actions">
                        <button onClick={() => void openAnalysis(row)}><Pencil size={15} /></button>
                        <button onClick={() => void deleteAnalysis(row)}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <form className="calc-layout" onSubmit={saveAnalysis}>
        <section className="panel calc-form-panel">
          <div className="panel-title"><div><Building2 size={18} /><h2>Subject Property</h2></div></div>
          <div className="form-grid">
            <label className="full">Property address<input value={subject.property_address} onChange={(e) => updateSubject('property_address', e.target.value)} placeholder="123 Main Street" /></label>
            <label>Country<input value={subject.country} onChange={(e) => updateSubject('country', e.target.value)} placeholder="United States" /></label>
            <label>State / Province<input value={subject.state_province} onChange={(e) => updateSubject('state_province', e.target.value)} placeholder="TX" /></label>
            <label>City<input value={subject.city} onChange={(e) => updateSubject('city', e.target.value)} placeholder="Houston" /></label>
            <label>Area / Neighborhood<input value={subject.area} onChange={(e) => updateSubject('area', e.target.value)} placeholder="Heights" /></label>
            <label>ZIP / Postal code<input value={subject.zip_code} onChange={(e) => updateSubject('zip_code', e.target.value)} placeholder="77002" /></label>
            <label>Property type
              <select value={subject.property_type} onChange={(e) => updateSubject('property_type', e.target.value)}>
                {propertyTypes.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <label>Condition
              <select value={subject.property_condition} onChange={(e) => updateSubject('property_condition', e.target.value)}>
                {PROPERTY_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>Bedrooms<input type="number" min="0" value={subject.bedrooms} onChange={(e) => updateSubject('bedrooms', e.target.value)} placeholder="3" /></label>
            <label>Bathrooms<input type="number" min="0" step="0.5" value={subject.bathrooms} onChange={(e) => updateSubject('bathrooms', e.target.value)} placeholder="2" /></label>
            <label>Square footage<input type="number" min="0" value={subject.square_footage} onChange={(e) => updateSubject('square_footage', e.target.value)} placeholder="1800" /></label>
            <label>Lot size (sqft)<input type="number" min="0" value={subject.lot_size} onChange={(e) => updateSubject('lot_size', e.target.value)} placeholder="6000" /></label>
            <label>Estimated repair costs<div className="currency-input"><span>$</span><input type="number" min="0" value={subject.estimated_repair_costs} onChange={(e) => updateSubject('estimated_repair_costs', e.target.value)} placeholder="30000" /></div></label>
            <label className="full">Notes<textarea value={subject.notes} onChange={(e) => updateSubject('notes', e.target.value)} placeholder="Property context, condition details, motivation…" /></label>
          </div>
        </section>

        <section className="panel calc-results-panel">
          <div className="panel-title"><div><Sparkles size={18} /><h2>ARV Estimate</h2></div></div>
          <div className="result-stack">
            <ResultRow label="Comparable sales used" value={String(calc.validComps)} />
            <ResultRow label="Avg price / sqft" value={calc.avgPriceSqft !== null ? money(calc.avgPriceSqft) : '—'} />
            <ResultRow label="Median sale price" value={calc.medianSale !== null ? money(calc.medianSale) : '—'} />
            <ResultRow label="Avg sale price" value={calc.avgSale !== null ? money(calc.avgSale) : '—'} />
            <ResultRow label="Estimated ARV" value={calc.estimatedArv !== null ? money(calc.estimatedArv) : '—'} highlight />
            <ResultRow label="ARV range (±5%)" value={calc.arvLow !== null && calc.arvHigh !== null ? `${money(calc.arvLow)} – ${money(calc.arvHigh)}` : '—'} />
            <ResultRow label="Estimated repair costs" value={calc.repairCosts !== null ? money(calc.repairCosts) : '—'} />
          </div>
          <div className="formula-note">
            <strong>How ARV is estimated</strong>
            <p>ARV = average price per sqft of active comps × subject square footage. Price per sqft for each comp = sale price ÷ square footage. The range applies ±5% to the point estimate. Excluded comps are not used.</p>
            <p className="muted-line">Estimates are not guaranteed market values. Verify with a licensed appraiser or agent before relying on them.</p>
          </div>
          {calc.warnings.length > 0 && (
            <div className="warn-list">
              {calc.warnings.map((w) => <span key={w}><AlertTriangle size={13} />{w}</span>)}
            </div>
          )}
          <button className="primary-button analyze-button" disabled={loading}>
            <Save size={16} /> {currentId ? 'Update Analysis' : 'Save Analysis'}
          </button>
        </section>
      </form>

      <section className="panel comps-panel">
        <div className="panel-title">
          <div><ClipboardList size={18} /><h2>Comparable Properties ({comps.length})</h2></div>
          <button type="button" className="panel-link" onClick={addComp}><Plus size={14} /> Add comparable</button>
        </div>
        <p className="form-intro">Enter real sold comparables. Toggle "Exclude" to drop a comp from the ARV calculation without deleting it.</p>

        {comps.map((comp, index) => {
          const price = num(comp.sale_price);
          const sqft = num(comp.square_footage);
          const psqft = price !== null && sqft && sqft > 0 ? price / sqft : null;
          return (
            <div className={`comp-card ${comp.excluded ? 'excluded' : ''}`} key={index}>
              <div className="comp-head">
                <strong>Comp #{index + 1}</strong>
                {psqft !== null && <span className="psqft-chip">{money(psqft)}/sqft</span>}
                <label className="exclude-toggle">
                  <input type="checkbox" checked={comp.excluded} onChange={(e) => updateComp(index, 'excluded', e.target.checked)} /> Exclude
                </label>
                <button type="button" className="comp-remove" onClick={() => removeComp(index)}><X size={15} /></button>
              </div>
              <div className="form-grid comp-grid">
                <label className="full">Address<input value={comp.address} onChange={(e) => updateComp(index, 'address', e.target.value)} placeholder="45 Oak Ave" /></label>
                <label>Sale price<div className="currency-input"><span>$</span><input type="number" min="0" value={comp.sale_price} onChange={(e) => updateComp(index, 'sale_price', e.target.value)} placeholder="210000" /></div></label>
                <label>Sale date<input type="date" value={comp.sale_date} onChange={(e) => updateComp(index, 'sale_date', e.target.value)} /></label>
                <label>Square footage<input type="number" min="0" value={comp.square_footage} onChange={(e) => updateComp(index, 'square_footage', e.target.value)} placeholder="1900" /></label>
                <label>Distance (mi)<input type="number" min="0" step="0.1" value={comp.distance} onChange={(e) => updateComp(index, 'distance', e.target.value)} placeholder="0.6" /></label>
                <label>Bedrooms<input type="number" min="0" value={comp.bedrooms} onChange={(e) => updateComp(index, 'bedrooms', e.target.value)} placeholder="3" /></label>
                <label>Bathrooms<input type="number" min="0" step="0.5" value={comp.bathrooms} onChange={(e) => updateComp(index, 'bathrooms', e.target.value)} placeholder="2" /></label>
                <label>Property type
                  <select value={comp.property_type} onChange={(e) => updateComp(index, 'property_type', e.target.value)}>
                    {propertyTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </label>
                <label>Condition
                  <select value={comp.property_condition} onChange={(e) => updateComp(index, 'property_condition', e.target.value)}>
                    {PROPERTY_CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="full">Notes<input value={comp.notes} onChange={(e) => updateComp(index, 'notes', e.target.value)} placeholder="Remodeled kitchen, similar lot size" /></label>
              </div>
            </div>
          );
        })}
        {comps.length === 0 && <EmptyInline text="No comparables yet. Add one above." />}
      </section>
    </>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`result-row ${highlight ? 'highlight' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <div className="empty-state compact"><span>{text}</span></div>;
}
