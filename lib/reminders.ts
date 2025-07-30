import { supabase } from './supabaseClient'

/**
 * Calculate days difference from today
 */
const daysBetween = (dateStr: string) => {
  const today = new Date()
  const date = new Date(dateStr)
  const diffTime = date.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Fetch visa expiry reminders
 */
export const fetchVisaReminders = async () => {
  const { data, error } = await supabase.from('visas').select('id, client_id, country, visa_type, expiry_date')
  if (error) {
    console.error(error)
    return []
  }

  const upcomingVisas = data.filter(v => {
    const daysLeft = daysBetween(v.expiry_date)
    return daysLeft >= 0 && daysLeft <= 30
  }).map(v => ({
    type: 'Visa Expiry',
    id: v.id,
    client_id: v.client_id,
    country: v.country,
    visa_type: v.visa_type,
    expiry_date: v.expiry_date,
    days_left: daysBetween(v.expiry_date)
  }))

  return upcomingVisas
}

/**
 * Fetch passport expiry reminders
 */
export const fetchPassportReminders = async () => {
  const { data, error } = await supabase.from('passport').select('id, client_id, passport_number, expiry_date')
  if (error) {
    console.error(error)
    return []
  }

  const upcomingPassports = data.filter(p => {
    const daysLeft = daysBetween(p.expiry_date)
    return daysLeft >= 0 && daysLeft <= 60
  }).map(p => ({
    type: 'Passport Expiry',
    id: p.id,
    client_id: p.client_id,
    passport_number: p.passport_number,
    expiry_date: p.expiry_date,
    days_left: daysBetween(p.expiry_date)
  }))

  return upcomingPassports
}

/**
 * Fetch PNR reminders for upcoming bookings
 */
export const fetchPNRReminders = async () => {
  const { data, error } = await supabase.from('bookings').select('id, client_id, pnr, departure_date')
  if (error) {
    console.error(error)
    return []
  }

  const upcomingPNRs = data.filter(b => {
    const daysLeft = daysBetween(b.departure_date)
    return daysLeft >= 0 && daysLeft <= 7
  }).map(b => ({
    type: 'PNR Confirmation',
    id: b.id,
    client_id: b.client_id,
    pnr: b.pnr,
    departure_date: b.departure_date,
    days_left: daysBetween(b.departure_date)
  }))

  return upcomingPNRs
}

/**
 * Fetch birthday reminders for this month
 */
export const fetchBirthdayReminders = async () => {
  const { data, error } = await supabase.from('clients').select('id, first_name, last_name, dob')
  if (error) {
    console.error(error)
    return []
  }

  const today = new Date()
  const birthdays = data.filter(c => {
    const dob = new Date(c.dob)
    return dob.getMonth() === today.getMonth()
  }).map(c => ({
    type: 'Birthday',
    id: c.id,
    name: `${c.first_name} ${c.last_name}`,
    dob: c.dob,
    birthday_this_month: true,
    days_left: undefined // Add days_left for type consistency
  }))

  return birthdays
}

/**
 * Fetch all reminders
 */
export const fetchAllReminders = async () => {
  const [visaReminders, passportReminders, pnrReminders, birthdayReminders] = await Promise.all([
    fetchVisaReminders(),
    fetchPassportReminders(),
    fetchPNRReminders(),
    fetchBirthdayReminders()
  ])

  return [
    ...visaReminders,
    ...passportReminders,
    ...pnrReminders,
    ...birthdayReminders
  ].sort((a, b) => {
    if (a.days_left !== undefined && b.days_left !== undefined) {
      return a.days_left - b.days_left
    }
    return 0
  })
}