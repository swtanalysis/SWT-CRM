/**
 * Client type
 */
export type Client = {
  id: string
  first_name: string
  middle_name?: string
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
  // Legacy single-flight fields (may be unused for multi‑segment bookings but kept for backward compatibility)
  airline?: string
  departure_date?: string
  arrival_date?: string
  departure_city?: string
  arrival_city?: string
  // New / extended fields used across UI
  booking_type?: string
  destination?: string
  check_in?: string
  check_out?: string
  vendor?: string
  reference?: string
  seat_preference?: string
  meal_preference?: string
  special_requirement?: string
  amount?: number
  segments?: TripSegment[]
  status: string
  created_at?: string
}

export type TripSegment = {
  origin: string
  destination: string
  departure_date: string
  airline?: string
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
  end_date?: string
  departure_date?: string
  dob?: string
  days_left?: number
  birthday_this_month?: boolean
}

/**
 * Itinerary related types
 */
export type ItineraryActivity = {
  id?: string
  time?: string // HH:mm
  type?: string // e.g. Flight, Hotel, Tour, Transfer, Meal, Note
  description?: string
  location?: string
  cost?: number
  currency?: string
}

export type ItineraryDay = {
  date: string // YYYY-MM-DD
  notes?: string
  activities: ItineraryActivity[]
}

export type Itinerary = {
  id: string
  client_id: string | null
  title: string
  start_date: string
  end_date: string
  travelers: number
  currency: string
  total_cost?: number
  days: ItineraryDay[]
  status?: string // Draft / Confirmed / Archived
  created_at?: string
}