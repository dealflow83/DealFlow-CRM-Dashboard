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
import { num, sum } from '@/lib/finance';
import { SubtoAnalysis } from '@/types';
import { money, moneyCents, pct } from '@/lib/format';

const OWNER_ID = 'local-preview-user';

const empty = {
  property_address: '',
  estimated_value: '',
  estimated_arv: '',
  mortgage_balance: '',
  monthly_pi: '',
  monthly_taxes: '',
  monthly_insurance: '',
  hoa_fees: '',
  interest_rate: '',
  remaining_term_months: '',
  monthly_rent: '',
  monthly_maintenance: '',
  vacancy_allowance: '',
  property_management: '',
  closing_costs: '',
  cash_to_seller: '',
  other_acquisition_costs: '',
  expected_resale_price: '',
  holding_period_months: '12',
  notes: '',
};

type Draft = typeof empty;

function compute(d: Draft) {
  const value = num(d.estimated_value);
  const mortgage = num(d.mortgage_balance);
  const equity = value !== null && mortgage !== null ? value - mortgage : null;

  const monthlyExpenses = sum(
    num(d.monthly_pi),
    num(d.monthly_taxes),
    num(d.monthly_insurance),
    num(d.hoa_fees),
    num(d.monthly_maintenance),
    num(d.vacancy_allowance),
    num(d.property_management),
  );

  const rent = num(d.monthly_rent);
  const monthlyCashFlow = rent !== null ? rent - monthlyExpenses : null;
  const annualCashFlow = monthlyCashFlow !== null ? monthlyCashFlow * 12 : null;

  const initialCash = sum(num(d.cash_to_seller), num(d.closing_costs), num(d.other_acquisition_costs));
  const cocReturn =
    annualCashFlow !== null && initialCash > 0 ? (annualCashFlow / initialCash) * 100 : null;

  const holding = num(d.holding_period_months);
  const holdingCashFlow = monthlyCashFlow !== null && holding !== null ? monthlyCashFlow * holding : null;
  const resale = num(d.expected_resale_price);
  const resaleProceeds =
    resale !== null && mortgage !== null ? resale - mortgage : resale !== null ? resale : null;

  const exitCosts = sum(num(d.closing_costs)); // simplified resale closing cost proxy
  const potentialProfit =
    holdingCashFlow !== null && resaleProceeds !== null
      ? holdingCashFlow + resaleProceeds - exitCosts - initialCash
      : null;

  return {
    equity,
    monthlyExpenses,
    monthlyCashFlow,
    annualCashFlow,
    initialCash,
    cocReturn,
    holdingCashFlow,
    resaleProceeds,
    exitCosts,
    potentialProfit,
  };
}

export function SubtoPage() {
  const [form, setForm] = useState<Draft>(empty);
  const [saved, setSaved] = useState<SubtoAnalysis[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  const calc = useMemo(() => compute(form), [form]);

  useEffect(() => {
    void loadSaved();
  }, []);

  async function loadSaved() {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('subto_analyses')
      .select('*')
      .order('updated_at', { ascending: false });
    setLoading(false);
    if (err) {
      setError(`Could not load saved analyses: ${err.message}`);
      return;
    }
    setSaved((data as SubtoAnalysis[]) || []);
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
      estimated_value: num(form.estimated_value),
      estimated_arv: num(form.estimated_arv),
      mortgage_balance: num(form.mortgage_balance),
      monthly_pi: num(form.monthly_pi),
      monthly_taxes: num(form.monthly_taxes),
      monthly_insurance: num(form.monthly_insurance),
      hoa_fees: num(form.hoa_fees),
      interest_rate: num(form.interest_rate),
      remaining_term_months: num(form.remaining_term_months),
      monthly_rent: num(form.monthly_rent),
      monthly_maintenance: num(form.monthly_maintenance),
      vacancy_allowance: num(form.vacancy_allowance),
      property_management: num(form.property_management),
      closing_costs: num(form.closing_costs),
      cash_to_seller: num(form.cash_to_seller),
      other_acquisition_costs: num(form.other_acquisition_costs),
      expected_resale_price: num(form.expected_resale_price),
      holding_period_months: num(form.holding_period_months),
      notes: form.notes.trim(),
      updated_at: now,
    };

    if (currentId) {
      const { error: err } = await supabase.from('subto_analyses').update(payload).eq('id', currentId);
      setLoading(false);
      if (err) {
        setError(`Save failed: ${err.message}`);
        return;
      }
      setInfo('Analysis updated.');
    } else {
      const { data, error: err } = await supabase
        .from('subto_analyses')
        .insert({ ...payload, created_at: now })
        .select('id')
        .maybeSingle();
      setLoading(false);
      if (err || !data) {
        setError(`Save failed: ${err?.message || 'No row returned'}`);
        return;
      }
      setCurrentId((data as { id: string }).id);
      setInfo('Analysis saved.');
    }
    void loadSaved();
  }

  async function openAnalysis(row: SubtoAnalysis) {
    setForm({
      property_address: row.property_address,
      estimated_value: row.estimated_value != null ? String(row.estimated_value) : '',
      estimated_arv: row.estimated_arv != null ? String(row.estimated_arv) : '',
      mortgage_balance: row.mortgage_balance != null ? String(row.mortgage_balance) : '',
      monthly_pi: row.monthly_pi != null ? String(row.monthly_pi) : '',
      monthly_taxes: row.monthly_taxes != null ? String(row.monthly_taxes) : '',
      monthly_insurance: row.monthly_insurance != null ? String(row.monthly_insurance) : '',
      hoa_fees: row.hoa_fees != null ? String(row.hoa_fees) : '',
      interest_rate: row.interest_rate != null ? String(row.interest_rate) : '',
      remaining_term_months: row.remaining_term_months != null ? String(row.remaining_term_months) : '',
      monthly_rent: row.monthly_rent != null ? String(row.monthly_rent) : '',
      monthly_maintenance: row.monthly_maintenance != null ? String(row.monthly_maintenance) : '',
      vacancy_allowance: row.vacancy_allowance != null ? String(row.vacancy_allowance) : '',
      property_management: row.property_management != null ? String(row.property_management) : '',
      closing_costs: row.closing_costs != null ? String(row.closing_costs) : '',
      cash_to_seller: row.cash_to_seller != null ? String(row.cash_to_seller) : '',
      other_acquisition_costs: row.other_acquisition_costs != null ? String(row.other_acquisition_costs) : '',
      expected_resale_price: row.expected_resale_price != null ? String(row.expected_resale_price) : '',
      holding_period_months: row.holding_period_months != null ? String(row.holding_period_months) : '',
      notes: row.notes,
    });
    setCurrentId(row.id);
    setShowSaved(false);
    setInfo(`Opened "${row.property_address}".`);
  }

  async function deleteAnalysis(row: SubtoAnalysis) {
    if (!confirm(`Delete this Subto analysis for "${row.property_address}"?`)) return;
    setLoading(true);
    const { error: err } = await supabase.from('subto_analyses').delete().eq('id', row.id);
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
          <h1>Subject-To (Subto) Calculator</h1>
          <p>Analyze a potential subject-to transaction: equity, cash flow, and cash-on-cash return.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => setShowSaved((v) => !v)}>
            <ClipboardList size={16} /> {saved.length} Saved
          </button>
          <button className="secondary-button" onClick={newAnalysis}><Plus size={16} /> New</button>
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={15} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {info && <div className="notice-bar"><CheckCircle2 size={14} /><b>{info}</b></div>}

      {showSaved && (
        <section className="panel saved-list-panel">
          <div className="panel-title"><div><ClipboardList size={18} /><h2>Saved Subto Analyses</h2></div><button onClick={() => setShowSaved(false)}>Close</button></div>
          {saved.length === 0 ? <EmptyInline text="No saved analyses yet." /> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Property</th><th>Equity</th><th>Monthly CF</th><th>CoC</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {saved.map((row) => (
                    <tr key={row.id}>
                      <td><b>{row.property_address || 'Untitled'}</b></td>
                      <td>{row.estimated_value != null && row.mortgage_balance != null ? money(row.estimated_value - row.mortgage_balance) : '—'}</td>
                      <td>—</td>
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
          <div className="panel-title"><div><ClipboardList size={18} /><h2>Property & Loan Inputs</h2></div></div>
          <div className="form-grid">
            <label className="full">Property address<input value={form.property_address} onChange={(e) => update('property_address', e.target.value)} placeholder="123 Main Street" /></label>
            <Currency label="Estimated property value" value={form.estimated_value} onChange={(v) => update('estimated_value', v)} placeholder="200000" />
            <Currency label="Estimated ARV" value={form.estimated_arv} onChange={(v) => update('estimated_arv', v)} placeholder="220000" />
            <Currency label="Existing mortgage balance" value={form.mortgage_balance} onChange={(v) => update('mortgage_balance', v)} placeholder="120000" />
            <Currency label="Monthly P&I payment" value={form.monthly_pi} onChange={(v) => update('monthly_pi', v)} placeholder="850" />
            <Currency label="Monthly property taxes" value={form.monthly_taxes} onChange={(v) => update('monthly_taxes', v)} placeholder="250" />
            <Currency label="Monthly insurance" value={form.monthly_insurance} onChange={(v) => update('monthly_insurance', v)} placeholder="120" />
            <Currency label="HOA fees" value={form.hoa_fees} onChange={(v) => update('hoa_fees', v)} placeholder="0" />
            <label>Interest rate (%)<input type="number" min="0" step="0.001" value={form.interest_rate} onChange={(e) => update('interest_rate', e.target.value)} placeholder="4.5" /></label>
            <label>Remaining term (months)<input type="number" min="0" value={form.remaining_term_months} onChange={(e) => update('remaining_term_months', e.target.value)} placeholder="240" /></label>
          </div>

          <div className="panel-title sub"><div><ClipboardList size={18} /><h2>Rental & Operating</h2></div></div>
          <div className="form-grid">
            <Currency label="Monthly rental income" value={form.monthly_rent} onChange={(v) => update('monthly_rent', v)} placeholder="1800" />
            <Currency label="Monthly maintenance" value={form.monthly_maintenance} onChange={(v) => update('monthly_maintenance', v)} placeholder="100" />
            <Currency label="Vacancy allowance" value={form.vacancy_allowance} onChange={(v) => update('vacancy_allowance', v)} placeholder="144" />
            <Currency label="Property management" value={form.property_management} onChange={(v) => update('property_management', v)} placeholder="180" />
          </div>

          <div className="panel-title sub"><div><ClipboardList size={18} /><h2>Acquisition & Exit</h2></div></div>
          <div className="form-grid">
            <Currency label="Closing costs" value={form.closing_costs} onChange={(v) => update('closing_costs', v)} placeholder="3000" />
            <Currency label="Cash required by seller" value={form.cash_to_seller} onChange={(v) => update('cash_to_seller', v)} placeholder="5000" />
            <Currency label="Other acquisition costs" value={form.other_acquisition_costs} onChange={(v) => update('other_acquisition_costs', v)} placeholder="0" />
            <Currency label="Expected resale price" value={form.expected_resale_price} onChange={(v) => update('expected_resale_price', v)} placeholder="220000" />
            <label>Expected holding period (months)<input type="number" min="0" value={form.holding_period_months} onChange={(e) => update('holding_period_months', e.target.value)} placeholder="12" /></label>
            <label className="full">Notes<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Loan details, seller motivation, exit plan…" /></label>
          </div>
        </section>

        <section className="panel calc-results-panel">
          <div className="panel-title"><div><CheckCircle2 size={18} /><h2>Results</h2></div></div>
          <div className="result-stack">
            <ResultRow label="Estimated equity at acquisition" value={calc.equity !== null ? money(calc.equity) : '—'} />
            <ResultRow label="Total monthly expenses" value={moneyCents(calc.monthlyExpenses)} />
            <ResultRow label="Estimated monthly cash flow" value={calc.monthlyCashFlow !== null ? moneyCents(calc.monthlyCashFlow) : '—'} highlight />
            <ResultRow label="Estimated annual cash flow" value={calc.annualCashFlow !== null ? money(calc.annualCashFlow) : '—'} />
            <ResultRow label="Initial cash required" value={money(calc.initialCash)} />
            <ResultRow label="Cash-on-cash return" value={calc.cocReturn !== null ? pct(calc.cocReturn) : '—'} />
            <ResultRow label="Holding-period cash flow" value={calc.holdingCashFlow !== null ? money(calc.holdingCashFlow) : '—'} />
            <ResultRow label="Estimated resale proceeds" value={calc.resaleProceeds !== null ? money(calc.resaleProceeds) : '—'} />
            <ResultRow label="Estimated potential profit" value={calc.potentialProfit !== null ? money(calc.potentialProfit) : '—'} highlight />
          </div>
          {calc.initialCash <= 0 && calc.annualCashFlow !== null && (
            <div className="warn-list"><span><AlertTriangle size={13} />Initial cash invested is zero or negative, so a meaningful cash-on-cash percentage cannot be calculated.</span></div>
          )}
          <div className="formula-note">
            <strong>Formulas</strong>
            <p>Equity = property value − mortgage balance. Monthly cash flow = rent − (P&amp;I + taxes + insurance + HOA + maintenance + vacancy + management). Cash-on-cash = annual cash flow ÷ initial cash invested × 100.</p>
            <p className="muted-line">Estimates only. Missing loan details are not invented — leave a field blank and the related output shows "—".</p>
          </div>
          <div className="risk-disclosure">
            <ShieldAlert size={16} /> <strong>Risk disclosure</strong>
            <ul>
              <li>Verify existing loan terms, due-on-sale provisions, and mortgage transfer restrictions with the lender.</li>
              <li>Confirm insurance requirements and seller authorization before closing.</li>
              <li>Review title, closing requirements, applicable laws, regulations, and tax implications with a qualified professional.</li>
              <li>A subject-to transaction is not automatically permitted by the lender.</li>
            </ul>
          </div>
          <button className="primary-button analyze-button" disabled={loading}><Save size={16} /> {currentId ? 'Update Analysis' : 'Save Analysis'}</button>
        </section>
      </form>
    </>
  );
}

function Currency({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label>{label}<div className="currency-input"><span>$</span><input type="number" min="0" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div></label>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`result-row ${highlight ? 'highlight' : ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function EmptyInline({ text }: { text: string }) {
  return <div className="empty-state compact"><span>{text}</span></div>;
}
