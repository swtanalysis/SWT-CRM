/**
 * Client type
 */
export type Client = {
  id: string
  first_name: string
  last_name: string
  email_id: string
  mobile_no: string
  dob: string
  nationality: string
  created_at?: string
}

/**
 * Booking type
 */
export type Booking = {
  id: string
  client_id: string
  pnr: string
  airline: string
  departure_date: string
  arrival_date: string
  departure_city: string
  arrival_city: string
  status: string
  created_at?: string
}

/**
 * Visa type
 */
export type Visa = {
  id: string
  client_id: string
  country: string
  visa_type: string
  visa_number: string
  issue_date: string
  expiry_date: string
  notes: string
  created_at?: string
}

/**
 * Passport type
 */
export type Passport = {
  id: string
  client_id: string
  passport_number: string
  nationality: string
  issue_date: string
  expiry_date: string
  created_at?: string
}

/**
 * Policy type
 */
export type Policy = {
  id: string
  client_id: string
  policy_number: string
  insurer: string
  sum_insured: number
  start_date: string
  end_date: string
  premium_amount: number
  created_at?: string
}

/**
 * Document type (for future file management module)
 */
export type Document = {
  id: string
  client_id: string
  type: string
  file_url: string
  uploaded_at: string
}

/**
 * Reminder type (generic)
 */
export type Reminder = {
  type: string
  id: string
  client_id?: string
  name?: string
  pnr?: string
  visa_type?: string
  country?: string
  passport_number?: string
  expiry_date?: string
  departure_date?: string
  dob?: string
  days_left?: number
  birthday_this_month?: boolean
}