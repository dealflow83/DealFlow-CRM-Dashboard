import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { monthlyPayment, num, remainingBalance, sum } from '@/lib/finance';
import { WrapAnalysis } from '@/types';
import { money, moneyCents, pct } from '@/lib/format';

const OWNER_ID = 'local-preview-user';

const empty = {
  property_address: '',
  country: '',
  state_province: '',
  city: '',
  area: '',
  estimated_value: '',
  underlying_balance: '',
  underlying_monthly_payment: '',
  underlying_rate: '',
  underlying_term_months: '',
  wrap_sale_price: '',
  buyer_down_payment: '',
  wrap_rate: '',
  wrap_term_months: '360',
  amortization_months: '360',
  balloon_amount: '',
  balloon_date: '',
  monthly_taxes: '',
  monthly_insurance: '',
  hoa_fees: '',
  other_monthly: '',
  servicing_fees: '',
  closing_costs: '',
  notes: '',
};

type Draft = typeof empty;

function compute(d: Draft) {
  const wrapSale = num(d.wrap_sale_price);
  const down = num(d.buyer_down_payment);
  const wrapPrincipal = wrapSale !== null && down !== null ? Math.max(0, wrapSale - down) : null;

  const wrapRate = num(d.wrap_rate);
  const amort = num(d.amortization_months);
  const wrapPayment =
    wrapPrincipal !== null && wrapRate !== null && amort !== null && amort > 0
      ? monthlyPayment(wrapPrincipal, wrapRate, amort)
      : null;

  const taxes = num(d.monthly_taxes);
  const insurance = num(d.monthly_insurance);
  const hoa = num(d.hoa_fees);
  const other = num(d.other_monthly);
  const servicing = num(d.servicing_fees);
  const totalBuyerPayment =
    wrapPayment !== null ? sum(wrapPayment, taxes, insurance, hoa, other) : null;

  const underlyingPayment = num(d.underlying_monthly_payment);
  const grossSpread =
    wrapPayment !== null && underlyingPayment !== null ? wrapPayment - underlyingPayment : null;

  const netSpread =
    grossSpread !== null ? grossSpread - sum(servicing, other) : null;

  const annualSpread = netSpread !== null ? netSpread * 12 : null;

  const closing = num(d.closing_costs);
  const cashUpfront =
    down !== null && closing !== null ? down - closing : down !== null ? down : null;

  const underlyingRate = num(d.underlying_rate);
  const underlyingTerm = num(d.underlying_term_months);
  const underlyingBal = num(d.underlying_balance);
  const holding = num(d.wrap_term_months);
  const remainingUnderlying =
    underlyingBal !== null && underlyingRate !== null && underlyingTerm !== null && holding !== null
      ? remainingBalance(underlyingBal, underlyingRate, underlyingTerm, holding)
      : null;

  const remainingWrap =
    wrapPrincipal !== null && wrapRate !== null && amort !== null && holding !== null
      ? remainingBalance(wrapPrincipal, wrapRate, amort, holding)
      : null;

  const balloon = num(d.balloon_amount);
  const investorCashFlow = netSpread;
  const holdingCashFlow = netSpread !== null && holding !== null ? netSpread * holding : null;
  const grossSpreadLife = grossSpread !== null && holding !== null ? grossSpread * holding : null;

  const potentialProfit =
    holdingCashFlow !== null && remainingWrap !== null && remainingUnderlying !== null
      ? holdingCashFlow + (remainingWrap - remainingUnderlying) - sum(closing)
      : null;

  return {
    wrapPrincipal,
    wrapPayment,
    totalBuyerPayment,
    underlyingPayment,
    grossSpread,
    netSpread,
    annualSpread,
    cashUpfront,
    remainingUnderlying,
    remainingWrap,
    balloon,
    investorCashFlow,
    holdingCashFlow,
    grossSpreadLife,
    potentialProfit,
  };
}

export function WrapPage() {
  const [form, setForm] = useState<Draft>(empty);
  const [saved, setSaved] = useState<WrapAnalysis[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  const calc = useMemo(() => compute(form), [form]);

  useEffect(() => { void loadSaved(); }, []);

  async function loadSaved() {
    setLoading(true);
    const { data, error: err } = await supabase.from('wrap_analyses').select('*').order('updated_at', { ascending: false });
    setLoading(false);
    if (err) { setError(`Could not load saved analyses: ${err.message}`); return; }
    setSaved((data as WrapAnalysis[]) || []);
  }

  function update(key: keyof Draft, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function newAnalysis() {
    setForm(empty);
    setCurrentId(null);
    setInfo('');
    setShowSaved(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!form.property_address.trim()) {
      setError('Property address is required before saving.');
      return;
    }
    setLoading(true);
    const now = new Date().toISOString();
    const payload = {
      owner_id: OWNER_ID,
      property_address: form.property_address.trim(),
      country: form.country.trim(),
      state_province: form.state_province.trim(),
      city: form.city.trim(),
      area: form.area.trim(),
      estimated_value: num(form.estimated_value),
      underlying_balance: num(form.underlying_balance),
      underlying_monthly_payment: num(form.underlying_monthly_payment),
      underlying_rate: num(form.underlying_rate),
      underlying_term_months: num(form.underlying_term_months),
      wrap_sale_price: num(form.wrap_sale_price),
      buyer_down_payment: num(form.buyer_down_payment),
      wrap_principal: calc.wrapPrincipal,
      wrap_rate: num(form.wrap_rate),
      wrap_term_months: num(form.wrap_term_months),
      amortization_months: num(form.amortization_months),
      balloon_amount: num(form.balloon_amount),
      balloon_date: form.balloon_date,
      monthly_taxes: num(form.monthly_taxes),
      monthly_insurance: num(form.monthly_insurance),
      hoa_fees: num(form.hoa_fees),
      other_monthly: num(form.other_monthly),
      servicing_fees: num(form.servicing_fees),
      closing_costs: num(form.closing_costs),
      notes: form.notes.trim(),
      updated_at: now,
    };

    if (currentId) {
      const { error: err } = await supabase.from('wrap_analyses').update(payload).eq('id', currentId);
      setLoading(false);
      if (err) { setError(`Save failed: ${err.message}`); return; }
      setInfo('Analysis updated.');
    } else {
      const { data, error: err } = await supabase.from('wrap_analyses').insert({ ...payload, created_at: now }).select('id').maybeSingle();
      setLoading(false);
      if (err || !data) { setError(`Save failed: ${err?.message || 'No row returned'}`); return; }
      setCurrentId((data as { id: string }).id);
      setInfo('Analysis saved.');
    }
    void loadSaved();
  }

  async function openAnalysis(row: WrapAnalysis) {
    setForm({
      property_address: row.property_address,
      country: row.country,
      state_province: row.state_province,
      city: row.city,
      area: row.area,
      estimated_value: row.estimated_value != null ? String(row.estimated_value) : '',
      underlying_balance: row.underlying_balance != null ? String(row.underlying_balance) : '',
      underlying_monthly_payment: row.underlying_monthly_payment != null ? String(row.underlying_monthly_payment) : '',
      underlying_rate: row.underlying_rate != null ? String(row.underlying_rate) : '',
      underlying_term_months: row.underlying_term_months != null ? String(row.underlying_term_months) : '',
      wrap_sale_price: row.wrap_sale_price != null ? String(row.wrap_sale_price) : '',
      buyer_down_payment: row.buyer_down_payment != null ? String(row.buyer_down_payment) : '',
      wrap_rate: row.wrap_rate != null ? String(row.wrap_rate) : '',
      wrap_term_months: row.wrap_term_months != null ? String(row.wrap_term_months) : '',
      amortization_months: row.amortization_months != null ? String(row.amortization_months) : '',
      balloon_amount: row.balloon_amount != null ? String(row.balloon_amount) : '',
      balloon_date: row.balloon_date,
      monthly_taxes: row.monthly_taxes != null ? String(row.monthly_taxes) : '',
      monthly_insurance: row.monthly_insurance != null ? String(row.monthly_insurance) : '',
      hoa_fees: row.hoa_fees != null ? String(row.hoa_fees) : '',
      other_monthly: row.other_monthly != null ? String(row.other_monthly) : '',
      servicing_fees: row.servicing_fees != null ? String(row.servicing_fees) : '',
      closing_costs: row.closing_costs != null ? String(row.closing_costs) : '',
      notes: row.notes,
    });
    setCurrentId(row.id);
    setShowSaved(false);
    setInfo(`Opened "${row.property_address}".`);
  }

  async function deleteAnalysis(row: WrapAnalysis) {
    if (!confirm(`Delete this Wrap analysis for "${row.property_address}"?`)) return;
    setLoading(true);
    const { error: err } = await supabase.from('wrap_analyses').delete().eq('id', row.id);
    setLoading(false);
    if (err) { setError(`Delete failed: ${err.message}`); return; }
    if (currentId === row.id) newAnalysis();
    void loadSaved();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Wrap Mortgage Calculator</h1>
          <p>Analyze a proposed wraparound mortgage: payment spread, cash flow, and projected profit.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => setShowSaved((v) => !v)}><ClipboardList size={16} /> {saved.length} Saved</button>
          <button className="secondary-button" onClick={newAnalysis}><Plus size={16} /> New</button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={15} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {info && <div className="notice-bar"><CheckCircle2 size={14} /><b>{info}</b></div>}

      {showSaved && (
        <section className="panel saved-list-panel">
          <div className="panel-title"><div><ClipboardList size={18} /><h2>Saved Wrap Analyses</h2></div><button onClick={() => setShowSaved(false)}>Close</button></div>
          {saved.length === 0 ? <EmptyInline text="No saved analyses yet." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Property</th><th>Wrap principal</th><th>Net spread/mo</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {saved.map((row) => (
                    <tr key={row.id}>
                      <td><b>{row.property_address || 'Untitled'}</b></td>
                      <td>{row.wrap_principal != null ? money(row.wrap_principal) : '—'}</td>
                      <td>—</td>
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

      <form className="calc-layout" onSubmit={save}>
        <section className="panel calc-form-panel">
          <div className="panel-title"><div><ClipboardList size={18} /><h2>Property & Underlying Loan</h2></div></div>
          <div className="form-grid">
            <label className="full">Property address<input value={form.property_address} onChange={(e) => update('property_address', e.target.value)} placeholder="123 Main Street" /></label>
            <label>Country<input value={form.country} onChange={(e) => update('country', e.target.value)} placeholder="United States" /></label>
            <label>State / Province<input value={form.state_province} onChange={(e) => update('state_province', e.target.value)} placeholder="TX" /></label>
            <label>City<input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Houston" /></label>
            <label>Area / Neighborhood<input value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="Heights" /></label>
            <Currency label="Estimated property value" value={form.estimated_value} onChange={(v) => update('estimated_value', v)} placeholder="250000" />
            <Currency label="Underlying mortgage balance" value={form.underlying_balance} onChange={(v) => update('underlying_balance', v)} placeholder="120000" />
            <Currency label="Underlying monthly payment" value={form.underlying_monthly_payment} onChange={(v) => update('underlying_monthly_payment', v)} placeholder="850" />
            <label>Underlying interest rate (%)<input type="number" min="0" step="0.001" value={form.underlying_rate} onChange={(e) => update('underlying_rate', e.target.value)} placeholder="4.5" /></label>
            <label>Remaining underlying term (months)<input type="number" min="0" value={form.underlying_term_months} onChange={(e) => update('underlying_term_months', e.target.value)} placeholder="240" /></label>
          </div>

          <div className="panel-title sub"><div><ClipboardList size={18} /><h2>Wrap Loan Terms</h2></div></div>
          <div className="form-grid">
            <Currency label="Wrap sale price" value={form.wrap_sale_price} onChange={(v) => update('wrap_sale_price', v)} placeholder="280000" />
            <Currency label="Buyer's down payment" value={form.buyer_down_payment} onChange={(v) => update('buyer_down_payment', v)} placeholder="28000" />
            <label>Wrap interest rate (%)<input type="number" min="0" step="0.001" value={form.wrap_rate} onChange={(e) => update('wrap_rate', e.target.value)} placeholder="7.5" /></label>
            <label>Wrap loan term (months)<input type="number" min="0" value={form.wrap_term_months} onChange={(e) => update('wrap_term_months', e.target.value)} placeholder="360" /></label>
            <label>Amortization period (months)<input type="number" min="0" value={form.amortization_months} onChange={(e) => update('amortization_months', e.target.value)} placeholder="360" /></label>
            <Currency label="Balloon payment amount" value={form.balloon_amount} onChange={(v) => update('balloon_amount', v)} placeholder="0" />
            <label>Balloon due date<input type="date" value={form.balloon_date} onChange={(e) => update('balloon_date', e.target.value)} /></label>
          </div>

          <div className="panel-title sub"><div><ClipboardList size={18} /><h2>Monthly Expenses & Closing</h2></div></div>
          <div className="form-grid">
            <Currency label="Property taxes / mo" value={form.monthly_taxes} onChange={(v) => update('monthly_taxes', v)} placeholder="250" />
            <Currency label="Insurance / mo" value={form.monthly_insurance} onChange={(v) => update('monthly_insurance', v)} placeholder="120" />
            <Currency label="HOA / mo" value={form.hoa_fees} onChange={(v) => update('hoa_fees', v)} placeholder="0" />
            <Currency label="Other monthly expenses" value={form.other_monthly} onChange={(v) => update('other_monthly', v)} placeholder="0" />
            <Currency label="Loan servicing fees / mo" value={form.servicing_fees} onChange={(v) => update('servicing_fees', v)} placeholder="50" />
            <Currency label="Closing costs" value={form.closing_costs} onChange={(v) => update('closing_costs', v)} placeholder="4000" />
            <label className="full">Notes<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Buyer terms, exit plan, servicing arrangement…" /></label>
          </div>
        </section>

        <section className="panel calc-results-panel">
          <div className="panel-title"><div><CheckCircle2 size={18} /><h2>Results</h2></div></div>
          <div className="result-stack">
            <ResultRow label="Wrap mortgage principal" value={calc.wrapPrincipal !== null ? money(calc.wrapPrincipal) : '—'} />
            <ResultRow label="Monthly wrap P&I" value={calc.wrapPayment !== null ? moneyCents(calc.wrapPayment) : '—'} />
            <ResultRow label="Total buyer monthly payment" value={calc.totalBuyerPayment !== null ? moneyCents(calc.totalBuyerPayment) : '—'} />
            <ResultRow label="Underlying monthly payment" value={calc.underlyingPayment !== null ? moneyCents(calc.underlyingPayment) : '—'} />
            <ResultRow label="Gross monthly spread" value={calc.grossSpread !== null ? moneyCents(calc.grossSpread) : '—'} highlight />
            <ResultRow label="Net monthly spread" value={calc.netSpread !== null ? moneyCents(calc.netSpread) : '—'} highlight />
            <ResultRow label="Annual payment spread" value={calc.annualSpread !== null ? money(calc.annualSpread) : '—'} />
            <ResultRow label="Cash upfront after closing" value={calc.cashUpfront !== null ? money(calc.cashUpfront) : '—'} />
            <ResultRow label="Remaining underlying balance" value={calc.remainingUnderlying !== null ? money(calc.remainingUnderlying) : '—'} />
            <ResultRow label="Remaining wrap balance" value={calc.remainingWrap !== null ? money(calc.remainingWrap) : '—'} />
            <ResultRow label="Holding-period cash flow" value={calc.holdingCashFlow !== null ? money(calc.holdingCashFlow) : '—'} />
            <ResultRow label="Gross spread over holding period" value={calc.grossSpreadLife !== null ? money(calc.grossSpreadLife) : '—'} />
            <ResultRow label="Estimated potential profit" value={calc.potentialProfit !== null ? money(calc.potentialProfit) : '—'} highlight />
          </div>
          <div className="formula-note">
            <strong>Formulas</strong>
            <p>Wrap principal = wrap sale price − buyer down payment. Monthly wrap P&amp;I uses standard amortization with the wrap rate and amortization period. Gross spread = wrap payment − underlying payment. Net spread subtracts servicing and other monthly expenses. Principal repayment is not profit — only the net spread and the difference between remaining wrap and underlying balances at exit contribute to potential profit.</p>
            <p className="muted-line">Zero-interest loans are handled safely. Missing loan details show "—" instead of invented values.</p>
          </div>
          <div className="risk-disclosure">
            <ShieldAlert size={16} /> <strong>Risk disclosure</strong>
            <ul>
              <li>Verify underlying mortgage restrictions and due-on-sale provisions with the lender.</li>
              <li>Confirm buyer and seller obligations, loan servicing arrangements, and insurance requirements.</li>
              <li>Review applicable lending, disclosure, and consumer-protection laws with a qualified professional.</li>
              <li>These estimates do not establish that a transaction is legally valid or suitable.</li>
            </ul>
          </div>
          <button className="primary-button analyze-button" disabled={loading}><Save size={16} /> {currentId ? 'Update Analysis' : 'Save Analysis'}</button>
        </section>
      </form>
    </>
  );
}

function Currency({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label>{label}<div className="currency-input"><span>$</span><input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div></label>;
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`result-row ${highlight ? 'highlight' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="empty-state compact"><span>{text}</span></div>;
}
