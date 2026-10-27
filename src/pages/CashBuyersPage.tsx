import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { COUNTRIES, Country, countryByCode, searchCountries } from '@/lib/countries';
import { num } from '@/lib/finance';
import {
  BUYER_RELATIONSHIP_STATUSES,
  BuyerOutreach,
  BuyerRelationshipStatus,
  CashBuyer,
  INVESTMENT_STRATEGIES,
} from '@/types';
import { formatDate, money, today } from '@/lib/format';

const OWNER_ID = 'local-preview-user';
const propertyTypeOptions = ['Single Family', 'Multi Family', 'Condo', 'Land', 'Commercial'];

const emptyBuyer = {
  buyer_name: '',
  contact_person: '',
  business_email: '',
  business_phone: '',
  country: '',
  country_code: '',
  state_province: '',
  city: '',
  area: '',
  zip_code: '',
  preferred_markets: '',
  preferred_property_types: '',
  min_purchase_price: '',
  max_purchase_price: '',
  investment_strategy: 'Wholesale',
  proof_of_funds_status: 'None',
  buyer_source: 'Saved',
  date_added: today(),
  last_contact_date: '',
  follow_up_date: '',
  notes: '',
  relationship_status: 'New' as BuyerRelationshipStatus,
  is_verified: false,
};

type BuyerDraft = typeof emptyBuyer;

type SearchForm = {
  country_code: string;
  state_province: string;
  city: string;
  area: string;
  zip_code: string;
  property_type: string;
  min_price: string;
  max_price: string;
  investment_strategy: string;
  buyer_status: string;
  verification: string;
};

const emptySearch: SearchForm = {
  country_code: '',
  state_province: '',
  city: '',
  area: '',
  zip_code: '',
  property_type: '',
  min_price: '',
  max_price: '',
  investment_strategy: '',
  buyer_status: '',
  verification: '',
};

export function CashBuyersPage() {
  const [search, setSearch] = useState<SearchForm>(emptySearch);
  const [results, setResults] = useState<CashBuyer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [allBuyers, setAllBuyers] = useState<CashBuyer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CashBuyer | null>(null);
  const [viewing, setViewing] = useState<CashBuyer | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { void loadAll(); }, []);

  async function loadAll() {
    const { data, error: err } = await supabase
      .from('cash_buyers')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) { setError(`Could not load buyers: ${err.message}`); return; }
    setAllBuyers((data as CashBuyer[]) || []);
  }

  function updateSearch(key: keyof SearchForm, value: string) {
    setSearch((s) => ({ ...s, [key]: value }));
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    setSearchError('');
    setSearching(true);
    let query = supabase.from('cash_buyers').select('*');
    if (search.country_code) query = query.eq('country_code', search.country_code);
    if (search.state_province.trim()) query = query.ilike('state_province', search.state_province.trim());
    if (search.city.trim()) query = query.ilike('city', `%${search.city.trim()}%`);
    if (search.area.trim()) query = query.ilike('area', `%${search.area.trim()}%`);
    if (search.zip_code.trim()) query = query.ilike('zip_code', search.zip_code.trim());
    if (search.property_type) query = query.ilike('preferred_property_types', `%${search.property_type}%`);
    if (search.investment_strategy) query = query.eq('investment_strategy', search.investment_strategy);
    if (search.buyer_status) query = query.eq('relationship_status', search.buyer_status);
    if (search.verification === 'verified') query = query.eq('is_verified', true);
    if (search.verification === 'unverified') query = query.eq('is_verified', false);
    const minP = num(search.min_price);
    const maxP = num(search.max_price);
    if (minP !== null) query = query.gte('max_purchase_price', minP);
    if (maxP !== null) query = query.lte('min_purchase_price', maxP);
    query = query.order('created_at', { ascending: false });

    const { data, error: err } = await query;
    setSearching(false);
    if (err) { setSearchError(`Search failed: ${err.message}`); return; }
    setResults((data as CashBuyer[]) || []);
  }

  function resetSearch() {
    setSearch(emptySearch);
    setResults(null);
  }

  async function saveBuyer(draft: BuyerDraft, existing: CashBuyer | null) {
    setError('');
    setInfo('');
    const now = new Date().toISOString();
    const payload = {
      owner_id: OWNER_ID,
      buyer_name: draft.buyer_name.trim(),
      contact_person: draft.contact_person.trim(),
      business_email: draft.business_email.trim(),
      business_phone: draft.business_phone.trim(),
      country: draft.country,
      country_code: draft.country_code,
      state_province: draft.state_province.trim(),
      city: draft.city.trim(),
      area: draft.area.trim(),
      zip_code: draft.zip_code.trim(),
      preferred_markets: draft.preferred_markets.trim(),
      preferred_property_types: draft.preferred_property_types.trim(),
      min_purchase_price: num(draft.min_purchase_price),
      max_purchase_price: num(draft.max_purchase_price),
      investment_strategy: draft.investment_strategy,
      proof_of_funds_status: draft.proof_of_funds_status,
      buyer_source: draft.buyer_source,
      date_added: draft.date_added || null,
      last_contact_date: draft.last_contact_date || null,
      follow_up_date: draft.follow_up_date || null,
      notes: draft.notes.trim(),
      relationship_status: draft.relationship_status,
      is_verified: draft.is_verified,
      updated_at: now,
    };

    if (existing) {
      const { error: err } = await supabase.from('cash_buyers').update(payload).eq('id', existing.id);
      if (err) { setError(`Save failed: ${err.message}`); return; }
      setInfo('Buyer updated.');
    } else {
      const { error: err } = await supabase.from('cash_buyers').insert({ ...payload, created_at: now });
      if (err) { setError(`Save failed: ${err.message}`); return; }
      setInfo('Buyer added.');
    }
    setShowForm(false);
    setEditing(null);
    void loadAll();
    if (results !== null) void runSearch(new Event('submit') as unknown as FormEvent);
  }

  async function deleteBuyer(buyer: CashBuyer) {
    if (!confirm(`Delete buyer "${buyer.buyer_name || 'Untitled'}"? This also removes their outreach history.`)) return;
    const { error: err } = await supabase.from('cash_buyers').delete().eq('id', buyer.id);
    if (err) { setError(`Delete failed: ${err.message}`); return; }
    setInfo('Buyer deleted.');
    void loadAll();
    if (results !== null) setResults(results.filter((b) => b.id !== buyer.id));
  }

  function startNew() {
    setEditing(null);
    setShowForm(true);
  }

  function startEdit(buyer: CashBuyer) {
    setEditing(buyer);
    setShowForm(true);
    setViewing(null);
  }

  function openProfile(buyer: CashBuyer) {
    setViewing(buyer);
  }

  function exportCsv() {
    const rows = results ?? allBuyers;
    if (rows.length === 0) { setError('No buyers to export.'); return; }
    const headers = [
      'buyer_name', 'contact_person', 'business_email', 'business_phone',
      'country', 'state_province', 'city', 'area', 'zip_code',
      'preferred_markets', 'preferred_property_types', 'min_purchase_price',
      'max_purchase_price', 'investment_strategy', 'proof_of_funds_status',
      'is_verified', 'buyer_source', 'relationship_status',
      'date_added', 'last_contact_date', 'follow_up_date', 'notes',
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(',')];
    for (const b of rows) {
      lines.push(headers.map((h) => escape((b as unknown as Record<string, unknown>)[h])).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dealflow-cash-buyers-${today()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setInfo(`Exported ${rows.length} buyers.`);
  }

  async function importCsv(file: File) {
    setError('');
    setInfo('');
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { setError('CSV needs a header row and at least one data row.'); return; }
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
      rows.push(row);
    }
    const now = new Date().toISOString();
    const records = rows.map((r) => ({
      owner_id: OWNER_ID,
      buyer_name: r.buyer_name || r.name || '',
      contact_person: r.contact_person || '',
      business_email: r.business_email || r.email || '',
      business_phone: r.business_phone || r.phone || '',
      country: r.country || '',
      country_code: r.country_code || COUNTRIES.find((c) => c.name.toLowerCase() === (r.country || '').toLowerCase())?.code || '',
      state_province: r.state_province || '',
      city: r.city || '',
      area: r.area || r.neighborhood || '',
      zip_code: r.zip_code || r.postal_code || '',
      preferred_markets: r.preferred_markets || '',
      preferred_property_types: r.preferred_property_types || r.property_types || '',
      min_purchase_price: num(r.min_purchase_price),
      max_purchase_price: num(r.max_purchase_price),
      investment_strategy: r.investment_strategy || 'Wholesale',
      proof_of_funds_status: r.proof_of_funds_status || 'None',
      buyer_source: 'Imported',
      date_added: r.date_added || today(),
      last_contact_date: r.last_contact_date || null,
      follow_up_date: r.follow_up_date || null,
      notes: r.notes || '',
      relationship_status: (r.relationship_status as BuyerRelationshipStatus) || 'New',
      is_verified: /^(true|yes|1|verified)$/i.test(r.is_verified || ''),
      created_at: now,
      updated_at: now,
    })).filter((r) => r.buyer_name);

    if (records.length === 0) { setError('No valid buyer rows found (buyer_name required).'); return; }
    const { error: err } = await supabase.from('cash_buyers').insert(records);
    if (err) { setError(`Import failed: ${err.message}`); return; }
    setInfo(`Imported ${records.length} buyers.`);
    void loadAll();
  }

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void importCsv(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Cash Buyers</h1>
          <p>Find and manage your cash buyer network worldwide. Country autocomplete uses a built-in list; city and area are manual entry for now.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={() => fileInputRef.current?.click()}><Upload size={16} /> Import CSV</button>
          <button className="secondary-button" onClick={exportCsv}><Download size={16} /> Export</button>
          <button className="primary-button" onClick={startNew}><Plus size={17} /> Add Buyer</button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={onFileChosen} style={{ display: 'none' }} />
        </div>
      </div>

      {error && <div className="error-banner"><AlertTriangle size={15} />{error}<button onClick={() => setError('')}>Dismiss</button></div>}
      {info && <div className="notice-bar"><CheckCircle2 size={14} /><b>{info}</b></div>}

      <form className="panel buyer-search-panel" onSubmit={runSearch}>
        <div className="panel-title"><div><Search size={18} /><h2>Search Cash Buyers</h2></div></div>
        <p className="form-intro">Search runs against your saved buyer records in Supabase. No buyers are fabricated.</p>
        <div className="form-grid buyer-search-grid">
          <CountryAutocomplete
            value={search.country_code}
            onChange={(code) => {
              updateSearch('country_code', code);
              // Clear incompatible child selections when parent changes.
              updateSearch('city', '');
              updateSearch('area', '');
            }}
          />
          <label>State / Province<input value={search.state_province} onChange={(e) => updateSearch('state_province', e.target.value)} placeholder="TX" /></label>
          <label>City<input value={search.city} onChange={(e) => updateSearch('city', e.target.value)} placeholder="Houston" /></label>
          <label>Area / Neighborhood<input value={search.area} onChange={(e) => updateSearch('area', e.target.value)} placeholder="Heights" /></label>
          <label>ZIP / Postal<input value={search.zip_code} onChange={(e) => updateSearch('zip_code', e.target.value)} placeholder="77002" /></label>
          <label>Property type
            <select value={search.property_type} onChange={(e) => updateSearch('property_type', e.target.value)}>
              <option value="">Any</option>
              {propertyTypeOptions.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Min price<div className="currency-input"><span>$</span><input type="number" min="0" value={search.min_price} onChange={(e) => updateSearch('min_price', e.target.value)} placeholder="50000" /></div></label>
          <label>Max price<div className="currency-input"><span>$</span><input type="number" min="0" value={search.max_price} onChange={(e) => updateSearch('max_price', e.target.value)} placeholder="300000" /></div></label>
          <label>Investment strategy
            <select value={search.investment_strategy} onChange={(e) => updateSearch('investment_strategy', e.target.value)}>
              <option value="">Any</option>
              {INVESTMENT_STRATEGIES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Buyer status
            <select value={search.buyer_status} onChange={(e) => updateSearch('buyer_status', e.target.value)}>
              <option value="">Any</option>
              {BUYER_RELATIONSHIP_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Verification
            <select value={search.verification} onChange={(e) => updateSearch('verification', e.target.value)}>
              <option value="">Any</option>
              <option value="verified">Verified only</option>
              <option value="unverified">Unverified only</option>
            </select>
          </label>
        </div>
        <div className="search-actions">
          <button className="primary-button" disabled={searching}><Search size={16} /> {searching ? 'Searching…' : 'Search Cash Buyers'}</button>
          <button type="button" className="secondary-button" onClick={resetSearch}>Reset</button>
        </div>
        {searchError && <p className="form-error">{searchError}</p>}
      </form>

      <section className="panel buyer-results-panel">
        <div className="panel-title">
          <div><Users size={18} /><h2>{results === null ? `All Buyers (${allBuyers.length})` : `Search Results (${results.length})`}</h2></div>
        </div>
        {results !== null && results.length === 0 && (
          <div className="empty-state"><span>No cash buyers found for this location. Try expanding your search area or adding buyer contacts.</span></div>
        )}
        {results === null && allBuyers.length === 0 && (
          <div className="empty-state"><span>No buyers yet. Add a buyer or import a CSV to start building your network.</span></div>
        )}
        {(results ?? allBuyers).length > 0 && (
          <div className="buyer-grid">
            {(results ?? allBuyers).map((b) => (
              <article className="buyer-card" key={b.id}>
                <div className="buyer-card-head">
                  <strong onClick={() => openProfile(b)}>{b.buyer_name || 'Untitled'}</strong>
                  <span className={`verify-chip ${b.is_verified ? 'verified' : ''}`}>{b.is_verified ? 'Verified' : 'Unverified'}</span>
                </div>
                <p className="buyer-location">{[b.city, b.state_province, b.country].filter(Boolean).join(', ') || 'Location not set'}</p>
                <div className="buyer-meta">
                  {b.preferred_property_types && <span>{b.preferred_property_types}</span>}
                  {b.investment_strategy && <span>{b.investment_strategy}</span>}
                  {b.max_purchase_price !== null && <span>up to {money(b.max_purchase_price)}</span>}
                </div>
                <div className="buyer-card-footer">
                  <small>{b.last_contact_date ? `Last contact ${formatDate(b.last_contact_date)}` : 'No contact yet'}</small>
                  <span className={`status-pill ${b.relationship_status.toLowerCase().replace(/\s+/g, '')}`}>{b.relationship_status}</span>
                </div>
                <div className="buyer-card-actions">
                  <button onClick={() => openProfile(b)}><FileText size={14} /> Profile</button>
                  <button onClick={() => startEdit(b)}><Pencil size={14} /> Edit</button>
                  <button onClick={() => void deleteBuyer(b)}><Trash2 size={14} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <BuyerModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSave={(draft) => void saveBuyer(draft, editing)}
        />
      )}
      {viewing && (
        <BuyerProfileModal
          buyer={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => startEdit(viewing)}
        />
      )}
    </>
  );
}

function CountryAutocomplete({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = value ? countryByCode(value) : null;

  useEffect(() => {
    if (selected) setQuery(selected.name);
    else if (!open) setQuery('');
  }, [value, open, selected]);

  const suggestions = useMemo(() => searchCountries(query, 8), [query]);

  function pick(c: Country) {
    onChange(c.code);
    setQuery(c.name);
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
  }

  return (
    <label className="autocomplete-wrap">
      Country
      <div className="autocomplete-box">
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (selected) onChange(''); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Start typing a country…"
        />
        {selected && <button type="button" className="clear-btn" onClick={clear}><X size={14} /></button>}
        <ChevronDown size={14} className="caret" />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((c) => (
            <li key={c.code}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
                {c.name} <small>{c.code}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && suggestions.length === 0 && (
        <ul className="autocomplete-list"><li className="no-match">No matching countries</li></ul>
      )}
    </label>
  );
}

function BuyerModal({ initial, onClose, onSave }: { initial: CashBuyer | null; onClose: () => void; onSave: (draft: BuyerDraft) => void }) {
  const [form, setForm] = useState<BuyerDraft>(initial ? {
    buyer_name: initial.buyer_name,
    contact_person: initial.contact_person,
    business_email: initial.business_email,
    business_phone: initial.business_phone,
    country: initial.country,
    country_code: initial.country_code,
    state_province: initial.state_province,
    city: initial.city,
    area: initial.area,
    zip_code: initial.zip_code,
    preferred_markets: initial.preferred_markets,
    preferred_property_types: initial.preferred_property_types,
    min_purchase_price: initial.min_purchase_price != null ? String(initial.min_purchase_price) : '',
    max_purchase_price: initial.max_purchase_price != null ? String(initial.max_purchase_price) : '',
    investment_strategy: initial.investment_strategy,
    proof_of_funds_status: initial.proof_of_funds_status,
    buyer_source: initial.buyer_source,
    date_added: initial.date_added || today(),
    last_contact_date: initial.last_contact_date || '',
    follow_up_date: initial.follow_up_date || '',
    notes: initial.notes,
    relationship_status: initial.relationship_status,
    is_verified: initial.is_verified,
  } : emptyBuyer);
  const [error, setError] = useState('');

  function update<K extends keyof BuyerDraft>(key: K, value: BuyerDraft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.buyer_name.trim()) { setError('Buyer or company name is required.'); return; }
    if (form.max_purchase_price && num(form.max_purchase_price)! < 0) { setError('Prices cannot be negative.'); return; }
    onSave(form);
  }

  return (
    <div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>{initial ? 'Edit Buyer' : 'Add Buyer'}</h2><button onClick={onClose}><X size={18} /></button></div>
      <form onSubmit={submit} className="form-grid">
        <label className="full">Buyer or company name<input value={form.buyer_name} onChange={(e) => update('buyer_name', e.target.value)} placeholder="Lloyd Properties LLC" /></label>
        <label>Contact person<input value={form.contact_person} onChange={(e) => update('contact_person', e.target.value)} placeholder="Dan Lloyd" /></label>
        <label>Business email<input type="email" value={form.business_email} onChange={(e) => update('business_email', e.target.value)} placeholder="dan@example.com" /></label>
        <label>Business phone<input value={form.business_phone} onChange={(e) => update('business_phone', e.target.value)} placeholder="(555) 000-0000" /></label>
        <CountryAutocomplete value={form.country_code} onChange={(code) => {
          const c = countryByCode(code);
          update('country_code', code);
          update('country', c?.name || '');
          update('city', '');
          update('area', '');
        }} />
        <label>State / Province<input value={form.state_province} onChange={(e) => update('state_province', e.target.value)} placeholder="TX" /></label>
        <label>City<input value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Houston" /></label>
        <label>Area / Neighborhood<input value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="Heights" /></label>
        <label>ZIP / Postal<input value={form.zip_code} onChange={(e) => update('zip_code', e.target.value)} placeholder="77002" /></label>
        <label>Preferred markets<input value={form.preferred_markets} onChange={(e) => update('preferred_markets', e.target.value)} placeholder="Houston, Dallas" /></label>
        <label>Preferred property types<input value={form.preferred_property_types} onChange={(e) => update('preferred_property_types', e.target.value)} placeholder="Single Family, Multi Family" /></label>
        <label>Min purchase price<div className="currency-input"><span>$</span><input type="number" min="0" value={form.min_purchase_price} onChange={(e) => update('min_purchase_price', e.target.value)} placeholder="50000" /></div></label>
        <label>Max purchase price<div className="currency-input"><span>$</span><input type="number" min="0" value={form.max_purchase_price} onChange={(e) => update('max_purchase_price', e.target.value)} placeholder="300000" /></div></label>
        <label>Investment strategy
          <select value={form.investment_strategy} onChange={(e) => update('investment_strategy', e.target.value)}>
            {INVESTMENT_STRATEGIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Proof of funds
          <select value={form.proof_of_funds_status} onChange={(e) => update('proof_of_funds_status', e.target.value)}>
            <option>None</option><option>Provided</option><option>Verified</option>
          </select>
        </label>
        <label>Buyer source
          <select value={form.buyer_source} onChange={(e) => update('buyer_source', e.target.value)}>
            <option>Saved</option><option>Imported</option><option>External</option>
          </select>
        </label>
        <label>Relationship status
          <select value={form.relationship_status} onChange={(e) => update('relationship_status', e.target.value as BuyerRelationshipStatus)}>
            {BUYER_RELATIONSHIP_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Date added<input type="date" value={form.date_added} onChange={(e) => update('date_added', e.target.value)} /></label>
        <label>Last contact date<input type="date" value={form.last_contact_date} onChange={(e) => update('last_contact_date', e.target.value)} /></label>
        <label>Follow-up date<input type="date" value={form.follow_up_date} onChange={(e) => update('follow_up_date', e.target.value)} /></label>
        <label className="full checkbox-row">
          <input type="checkbox" checked={form.is_verified} onChange={(e) => update('is_verified', e.target.checked)} />
          Mark as verified (only with confirmed proof of funds)
        </label>
        <label className="full">Notes<textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Buying criteria, past deals, contact preferences…" /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button">{initial ? 'Update Buyer' : 'Add Buyer'}</button>
        </div>
      </form>
    </div></div>
  );
}

function BuyerProfileModal({ buyer, onClose, onEdit }: { buyer: CashBuyer; onClose: () => void; onEdit: () => void }) {
  const [outreach, setOutreach] = useState<BuyerOutreach[]>([]);
  const [loadingOutreach, setLoadingOutreach] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [newType, setNewType] = useState('Note');
  const [newDate, setNewDate] = useState(today());

  useEffect(() => { void loadOutreach(); }, [buyer.id]);

  async function loadOutreach() {
    setLoadingOutreach(true);
    const { data } = await supabase.from('buyer_outreach_history').select('*').eq('buyer_id', buyer.id).order('contact_date', { ascending: false });
    setOutreach((data as BuyerOutreach[]) || []);
    setLoadingOutreach(false);
  }

  async function addOutreach(event: FormEvent) {
    event.preventDefault();
    if (!newNote.trim()) return;
    const { error: err } = await supabase.from('buyer_outreach_history').insert({
      buyer_id: buyer.id,
      contact_type: newType,
      contact_date: newDate || null,
      note: newNote.trim(),
    });
    if (err) return;
    setNewNote('');
    void loadOutreach();
    await supabase.from('cash_buyers').update({ last_contact_date: newDate || today(), updated_at: new Date().toISOString() }).eq('id', buyer.id);
  }

  async function deleteOutreach(id: string) {
    await supabase.from('buyer_outreach_history').delete().eq('id', id);
    void loadOutreach();
  }

  return (
    <div className="modal-backdrop"><div className="modal">
      <div className="modal-header"><h2>{buyer.buyer_name || 'Untitled Buyer'}</h2><button onClick={onClose}><X size={18} /></button></div>
      <div className="profile-grid">
        <div className="profile-section">
          <h3>Contact</h3>
          <Row label="Contact person" value={buyer.contact_person} />
          <Row label="Email" value={buyer.business_email} />
          <Row label="Phone" value={buyer.business_phone} />
        </div>
        <div className="profile-section">
          <h3>Location</h3>
          <Row label="Country" value={buyer.country} />
          <Row label="State / Province" value={buyer.state_province} />
          <Row label="City" value={buyer.city} />
          <Row label="Area" value={buyer.area} />
          <Row label="ZIP" value={buyer.zip_code} />
        </div>
        <div className="profile-section">
          <h3>Investment Criteria</h3>
          <Row label="Preferred markets" value={buyer.preferred_markets} />
          <Row label="Property types" value={buyer.preferred_property_types} />
          <Row label="Price range" value={`${buyer.min_purchase_price != null ? money(buyer.min_purchase_price) : '—'} – ${buyer.max_purchase_price != null ? money(buyer.max_purchase_price) : '—'}`} />
          <Row label="Strategy" value={buyer.investment_strategy} />
        </div>
        <div className="profile-section">
          <h3>Status</h3>
          <Row label="Relationship" value={buyer.relationship_status} />
          <Row label="Proof of funds" value={buyer.proof_of_funds_status} />
          <Row label="Verified" value={buyer.is_verified ? 'Yes' : 'No'} />
          <Row label="Source" value={buyer.buyer_source} />
          <Row label="Date added" value={formatDate(buyer.date_added)} />
          <Row label="Last contact" value={formatDate(buyer.last_contact_date)} />
          <Row label="Follow-up" value={formatDate(buyer.follow_up_date)} />
        </div>
        {buyer.notes && <div className="profile-section full"><h3>Notes</h3><p>{buyer.notes}</p></div>}
      </div>

      <div className="outreach-section">
        <h3>Outreach History</h3>
        <form className="outreach-form" onSubmit={addOutreach}>
          <select value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option>Note</option><option>Call</option><option>Email</option><option>SMS</option><option>Meeting</option>
          </select>
          <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a contact note…" />
          <button className="primary-button" type="submit"><Plus size={14} /> Add</button>
        </form>
        {loadingOutreach && <p className="muted-line">Loading…</p>}
        {!loadingOutreach && outreach.length === 0 && <p className="muted-line">No outreach recorded yet.</p>}
        {outreach.length > 0 && (
          <ul className="outreach-list">
            {outreach.map((o) => (
              <li key={o.id}>
                <div><span className="outreach-type">{o.contact_type}</span><small>{formatDate(o.contact_date)}</small></div>
                <p>{o.note}</p>
                <button onClick={() => void deleteOutreach(o.id)}><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="modal-actions">
        <button className="secondary-button" onClick={onClose}>Close</button>
        <button className="primary-button" onClick={onEdit}><Pencil size={15} /> Edit Buyer</button>
      </div>
    </div></div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="profile-row"><span>{label}</span><strong>{value || '—'}</strong></div>;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}
