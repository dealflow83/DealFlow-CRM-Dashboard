export type Page = 'Dashboard' | 'Leads' | 'AI Deal Analyzer' | 'Calendar' | 'Settings';
export type Stage = 'New' | 'Contacted' | 'Hot' | 'Cold' | 'Closed';
export type PropertyType = 'Single Family' | 'Multi Family' | 'Condo' | 'Land' | 'Commercial';
export type EventType = 'Lead Follow-up' | 'Property Appointment' | 'Lead Call' | 'Meeting' | 'Deal Deadline';

export type Lead = {
  id: string;
  owner_id: string;
  seller_name: string;
  phone: string;
  email: string;
  property_address: string;
  property_type: PropertyType;
  estimated_arv: number | null;
  estimated_repairs: number | null;
  asking_price: number | null;
  lead_source: string;
  stage: Stage;
  notes: string;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  next_follow_up_date: string | null;
  closed_profit: number;
};

export type LeadActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  note: string;
  occurred_at: string;
};

export type CalendarEvent = {
  id: string;
  owner_id: string;
  lead_id: string | null;
  title: string;
  event_type: EventType;
  event_date: string;
  start_time: string;
  notes: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type Analysis = { arv: string; repairs: string; fee: string; offer: string };

// ---- New feature types (Comps/ARV, Subto, Wrap, Cash Buyers) ----

export type Page =
  | 'Dashboard'
  | 'Leads'
  | 'AI Deal Analyzer'
  | 'Comps / ARV'
  | 'Subto Calculator'
  | 'Wrap Calculator'
  | 'Cash Buyers'
  | 'Calendar'
  | 'Settings';

export type PropertyCondition = 'Excellent' | 'Good' | 'Average' | 'Fair' | 'Poor' | 'Needs Repair';

export type ArvAnalysis = {
  id: string;
  owner_id: string;
  property_address: string;
  country: string;
  state_province: string;
  city: string;
  area: string;
  zip_code: string;
  property_type: string;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  lot_size: number | null;
  property_condition: string;
  estimated_repair_costs: number | null;
  estimated_arv: number | null;
  arv_low: number | null;
  arv_high: number | null;
  avg_price_sqft: number | null;
  median_sale_price: number | null;
  avg_sale_price: number | null;
  notes: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Comparable = {
  id: string;
  arv_analysis_id: string;
  address: string;
  sale_price: number | null;
  sale_date: string;
  square_footage: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  property_type: string;
  property_condition: string;
  distance: number | null;
  notes: string;
  excluded: boolean;
  created_at: string;
};

export type SubtoAnalysis = {
  id: string;
  owner_id: string;
  property_address: string;
  estimated_value: number | null;
  estimated_arv: number | null;
  mortgage_balance: number | null;
  monthly_pi: number | null;
  monthly_taxes: number | null;
  monthly_insurance: number | null;
  hoa_fees: number | null;
  interest_rate: number | null;
  remaining_term_months: number | null;
  monthly_rent: number | null;
  monthly_maintenance: number | null;
  vacancy_allowance: number | null;
  property_management: number | null;
  closing_costs: number | null;
  cash_to_seller: number | null;
  other_acquisition_costs: number | null;
  expected_resale_price: number | null;
  holding_period_months: number | null;
  notes: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type WrapAnalysis = {
  id: string;
  owner_id: string;
  property_address: string;
  country: string;
  state_province: string;
  city: string;
  area: string;
  estimated_value: number | null;
  underlying_balance: number | null;
  underlying_monthly_payment: number | null;
  underlying_rate: number | null;
  underlying_term_months: number | null;
  wrap_sale_price: number | null;
  buyer_down_payment: number | null;
  wrap_principal: number | null;
  wrap_rate: number | null;
  wrap_term_months: number | null;
  amortization_months: number | null;
  balloon_amount: number | null;
  balloon_date: string;
  monthly_taxes: number | null;
  monthly_insurance: number | null;
  hoa_fees: number | null;
  other_monthly: number | null;
  servicing_fees: number | null;
  closing_costs: number | null;
  notes: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BuyerRelationshipStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Verified'
  | 'Offer Requested'
  | 'Active Buyer'
  | 'Inactive';

export type CashBuyer = {
  id: string;
  owner_id: string;
  buyer_name: string;
  contact_person: string;
  business_email: string;
  business_phone: string;
  country: string;
  country_code: string;
  state_province: string;
  city: string;
  area: string;
  zip_code: string;
  preferred_markets: string;
  preferred_property_types: string;
  min_purchase_price: number | null;
  max_purchase_price: number | null;
  investment_strategy: string;
  proof_of_funds_status: string;
  buyer_source: string;
  date_added: string | null;
  last_contact_date: string | null;
  follow_up_date: string | null;
  notes: string;
  relationship_status: BuyerRelationshipStatus;
  is_verified: boolean;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
};

export type BuyerOutreach = {
  id: string;
  buyer_id: string;
  contact_type: string;
  contact_date: string | null;
  note: string;
  created_at: string;
};

export const PROPERTY_CONDITIONS: PropertyCondition[] = [
  'Excellent',
  'Good',
  'Average',
  'Fair',
  'Poor',
  'Needs Repair',
];

export const BUYER_RELATIONSHIP_STATUSES: BuyerRelationshipStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Verified',
  'Offer Requested',
  'Active Buyer',
  'Inactive',
];

export const INVESTMENT_STRATEGIES = [
  'Wholesale',
  'Fix & Flip',
  'Buy & Hold',
  'BRRRR',
  'Subject-To',
  'Wrap',
  'Land',
  'Multi-Family',
  'Commercial',
  'Other',
];

