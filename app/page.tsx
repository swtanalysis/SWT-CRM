// Ensure this page is rendered purely on the client to avoid SSR hydration mismatches for time-based charts
'use client'

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { UserDailyMetrics, UserActivity } from '../lib/types';
import type { Client, Booking, Visa, Passport, Policy, Reminder, UserReminder } from '../lib/types'
import { createClient, Session } from '@supabase/supabase-js'
import {
    Box, CssBaseline, AppBar, Toolbar, Typography, Container, Paper, CircularProgress,
    IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Fade, InputAdornment,
    Select, MenuItem, FormControl, InputLabel, Stack, Link,
    Accordion, AccordionSummary, AccordionDetails, Avatar, Chip, Tabs, Tab, Snackbar,
    Checkbox, FormControlLabel,
        Collapse,
        Badge,
        Autocomplete,
        ToggleButtonGroup, ToggleButton
} from '@mui/material'
import { Grid } from '@mui/material';
import ListSubheader from '@mui/material/ListSubheader';
import dynamic from 'next/dynamic';
import {
    Dashboard as DashboardIcon, People as PeopleIcon, Flight as FlightIcon, VpnKey as VpnKeyIcon,
    CreditCard as CreditCardIcon, Policy as PolicyIcon, Delete as DeleteIcon, Add as AddIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon, Menu as MenuIcon, Notifications as NotificationsIcon, Cake as CakeIcon,
    Search as SearchIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon,
    Logout as LogoutIcon, UploadFile as UploadFileIcon, Description as DescriptionIcon,
    ExpandMore as ExpandMoreIcon, AccountBox as AccountBoxIcon, Download as DownloadIcon, Share as ShareIcon,
    Analytics as AnalyticsIcon, Notes as NotesIcon, Star as StarIcon, Email as EmailIcon, Phone as PhoneIcon,
    Visibility as VisibilityIcon, ExpandLess as ExpandLessIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
    Person as PersonIcon, Undo as UndoIcon, Info as InfoIcon, ContentCopy as ContentCopyIcon, Close as MuiCloseIcon
} from '@mui/icons-material'
import NextLink from 'next/link'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import dayjs from 'dayjs'
import { DISPLAY_DATE, DISPLAY_DATE_TIME } from '../lib/dateFormats'
import { formatCurrency, CURRENCY } from '../lib/currency'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import jsPDF from 'jspdf'
// Removed html2canvas usage for structured PDF exports
import { Divider } from '@mui/material';

dayjs.extend(relativeTime)

// Date formats now imported from lib/dateFormats

// --- CONSTANTS & SHARED CONFIG ---
const drawerWidth = 240;
const rightDrawerWidth = 320;
const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#00C49F', '#AF19FF', '#FF6666'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Lazy load heavy itinerary builder to reduce initial bundle
const ItinerariesView = dynamic(() => import('../components/ItinerariesView'), { ssr: false });


// --- MAIN DASHBOARD PAGE ---

const TableView = React.memo(({ 
    data, 
    view, 
    getFieldsForView, 
    sortColumn, 
    sortDirection, 
    onSort, 
    searchTerm, 
    onSearchTermChange, 
    onOpenModal, 
    onDeleteItem, 
    onOpenDocModal,
    clients,
    bookings,
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    onClearDates
}: { 
    data: any[], 
    view: string, 
    getFieldsForView: (view: string) => any,
    sortColumn: string | null,
    sortDirection: 'asc' | 'desc',
    onSort: (column: string) => void,
    searchTerm: string,
    onSearchTermChange: (term: string) => void,
    onOpenModal: (mode: 'add' | 'edit', item?: any) => void,
    onDeleteItem: (id: string, view: string) => void,
    onOpenDocModal: (client: Client) => void,
    clients: Client[],
    bookings: Booking[],
    dateFrom: dayjs.Dayjs | null,
    dateTo: dayjs.Dayjs | null,
    onDateFromChange: (d: dayjs.Dayjs | null) => void,
    onDateToChange: (d: dayjs.Dayjs | null) => void,
    onClearDates: () => void
}) => (
    <Fade in={true}>
    <Paper sx={{ p: 2, mt: 2, elevation: 3, borderRadius: 2 }}>
            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={2} flexWrap="wrap" gap={2}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>{view}</Typography>
                <TextField 
                    label="Search All Columns" 
                    variant="outlined" 
                    size="small" 
                    value={searchTerm} 
                    onChange={e => onSearchTermChange(e.target.value)}
                    InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} 
                    sx={{minWidth: '240px'}} 
                />
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <DatePicker format={DISPLAY_DATE} label="From" value={dateFrom} onChange={onDateFromChange} slotProps={{ textField: { size:'small' } }} />
                        <DatePicker format={DISPLAY_DATE} label="To" value={dateTo} onChange={onDateToChange} slotProps={{ textField: { size:'small' } }} />
                        {(dateFrom || dateTo) && <Button size="small" onClick={onClearDates}>Clear</Button>}
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => onOpenModal('add')}>Add {view.slice(0, -1)}</Button>
                    </Stack>
                </LocalizationProvider>
      </Box>
      <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
        <Table stickyHeader aria-label={`${view} table`}>
          <TableHead>
            <TableRow>
              {Object.keys(getFieldsForView(view)).map(key => (
                <TableCell key={key} sortDirection={sortColumn === key ? sortDirection : false} sx={{ fontWeight: 'bold', backgroundColor: 'action.hover' }}>
                    <Tooltip title={`Sort by ${key.replace(/_/g, ' ')}`} enterDelay={300}>
                        <Typography onClick={() => onSort(key)} sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 'inherit' }}>
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            {sortColumn === key && (sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />)}
                        </Typography>
                    </Tooltip>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 'bold', backgroundColor: 'action.hover' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map(item => (
              <TableRow hover key={item.id}>
                                {Object.keys(getFieldsForView(view)).map(key => {
                                    const val = (item as any)[key];
                                    let content: React.ReactNode = null;

                                    if (key.includes('date') && val) {
                                        content = dayjs(val).format(DISPLAY_DATE);
                                    } else if (key === 'client_id') {
                                        const c = clients.find(c => c.id === val);
                                        content = c ? [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') : 'N/A';
                                    } else if (key === 'booking_id') {
                                        content = bookings.find(b => b.id === val)?.pnr || 'N/A';
                                    } else if (view === 'Bookings' && key === 'segments') {
                                        const segs = Array.isArray(val) ? val : [];
                                        if (segs.length === 0) content = '—';
                                        else {
                                            const origin = segs[0]?.origin || '';
                                            const dest = segs[segs.length - 1]?.destination || '';
                                            content = (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <Chip size="small" label={`${segs.length} leg${segs.length > 1 ? 's' : ''}`} />
                                                    <Typography variant="body2">{origin && dest ? `${origin} → ${dest}` : ''}</Typography>
                                                </Stack>
                                            );
                                        }
                                    } else if (val !== null && typeof val === 'object') {
                                        // Fallback: avoid rendering objects; show a summary string
                                        content = Array.isArray(val) ? (val.length ? `${val.length} items` : '—') : '—';
                                    } else {
                                        content = val ?? '—';
                                    }

                                    return (
                                        <TableCell key={key}>{content}</TableCell>
                                    );
                                })}
                <TableCell>
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => onOpenModal('edit', item)}><EditIcon color="info" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" onClick={() => onDeleteItem(item.id, view)}><DeleteIcon color="error" /></IconButton></Tooltip>
                  {view === 'Clients' && <Tooltip title="Documents"><IconButton size="small" onClick={() => onOpenDocModal(item)}><DescriptionIcon color="primary" /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (
                <TableRow><TableCell colSpan={Object.keys(getFieldsForView(view)).length + 1} align="center">No data available.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
    </Fade>
));
TableView.displayName = 'TableView';

export default function DashboardPage() {
    // Stable reference timestamp to avoid server/client divergence for month labels etc.
    const nowRef = useRef(dayjs());
  // --- STATE MANAGEMENT ---
  const [session, setSession] = useState<Session | null>(null);
  // Track last successful fetch to prevent unnecessary refetches on focus/visibility
  const lastFetchRef = useRef<number>(0);
  const sessionRef = useRef<Session | null>(null);
    const [clients, setClients] = useState<Client[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [visas, setVisas] = useState<Visa[]>([])
  const [passports, setPassports] = useState<Passport[]>([])
    const [policies, setPolicies] = useState<Policy[]>([])
    // User-specific metrics state
    const [userDailyMetrics, setUserDailyMetrics] = useState<UserDailyMetrics[]>([]);
    const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
    const [userMetricMode, setUserMetricMode] = useState<'all' | 'me'>('all');
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeView, setActiveView] = useState('Dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  const [openModal, setOpenModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedItem, setSelectedItem] = useState<Client | Booking | Visa | Passport | Policy | null>(null)
    // Search text used inside client select dropdown (modal forms)
        // Removed clientSelectSearch (Autocomplete handles filtering)
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({}); 
    // Date range filter (applies to date-like columns)
    const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
    const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, view: string} | null>(null);

  // Document Upload Modal State
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedClientForDocs, setSelectedClientForDocs] = useState<Client | null>(null);
  
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string}>({open: false, message: ''});
    // User Reminders state (Phase 1)
    const [userReminders, setUserReminders] = useState<UserReminder[]>([]);
    const [reminderModalOpen, setReminderModalOpen] = useState(false);
    const [editingReminder, setEditingReminder] = useState<UserReminder | null>(null);
    // Ephemeral buffer for UserReminderModal to survive Fast Refresh while open
    const reminderBufferRef = useRef<{ mode: 'add'|'edit'; id?: string|null; data: React.MutableRefObject<{ title?: string; details?: string; dueAt?: string|null; remindAt?: string|null; priority?: number } | undefined> | { title?: string; details?: string; dueAt?: string|null; remindAt?: string|null; priority?: number } } | null>(null);
    const latestReminderRef = useRef<{ title?: string; details?: string; dueAt?: string|null; remindAt?: string|null; priority?: number }>({});
    useEffect(()=>{
        if (reminderModalOpen) {
            reminderBufferRef.current = {
                mode: editingReminder ? 'edit' : 'add',
                id: editingReminder?.id ?? null,
                // Store the ref to always have latest values after a refresh
                data: latestReminderRef
            };
        } else {
            reminderBufferRef.current = null;
            latestReminderRef.current = {};
        }
    }, [reminderModalOpen, editingReminder]);
    // Duplicate client pre-insert handling
    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [pendingClientCreate, setPendingClientCreate] = useState<{ payload: any; matches: Client[] } | null>(null);
  // NEW: collapsible sidebars state
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [showReminders, setShowReminders] = useState(true);
  const actualLeftWidth = leftCollapsed ? 64 : drawerWidth;
    // Hydration safety: defer dynamic/time-based rendering until client mounted
    const [mounted, setMounted] = useState(false);
    useEffect(()=> { setMounted(true); }, []);

    // --- USER ACTIVITY LOGGING ---
    const logActivity = async (action: string, entity: string, entityId?: string, meta?: any) => {
        try {
            const userId = session?.user?.id;
            if (!userId) return;
            await supabase.from('user_activity').insert({ user_id: userId, action, entity_type: entity, entity_id: entityId, meta });
        } catch (e) {
            // Silent fail; optionally add console debug
            // console.debug('Activity log failed', e);
        }
    };
  // --- AUTHENTICATION ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      sessionRef.current = session;
    if (session?.user) ensureProfile(session.user);
    })

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Only update session if it actually changed (avoid unnecessary rerenders/refetches)
      const prev = sessionRef.current;
      const prevUserId = prev?.user?.id;
      const nextUserId = nextSession?.user?.id;
      if (prevUserId !== nextUserId) {
        setSession(nextSession);
        sessionRef.current = nextSession;
        if (nextSession?.user) ensureProfile(nextSession.user);
      }
    })

    return () => {
      if (subscription) subscription.unsubscribe()
    }
    }, [])

    // Fetch per-user metrics & activity (30d window)
    useEffect(() => {
        const loadUserMetrics = async () => {
            if (!session?.user?.id) return;
            const since = dayjs().subtract(30,'day').format('YYYY-MM-DD');
            // user daily metrics (pre-aggregated if available)
            const { data: udm } = await supabase.from('user_metrics_daily').select('*').eq('user_id', session.user.id).gte('date', since).order('date');
            if (udm) setUserDailyMetrics(udm as any);
            // raw activity for fallback / extended metrics
            const { data: acts } = await supabase.from('user_activity').select('*').eq('user_id', session.user.id).gte('created_at', since).order('created_at', { ascending:false }).limit(500);
            if (acts) setUserActivity(acts as any);
        };
        loadUserMetrics();
    }, [session]);

  // --- DEBOUNCING SEARCH INPUT ---
  useEffect(() => {
    const handler = setTimeout(() => {
        setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => {
        clearTimeout(handler);
    };
  }, [searchTerm]);


  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    if (!session) return; // Don't fetch if not logged in
    setLoading(true)
    setError(null)
    try {
      const [
        clientsRes, bookingsRes, visasRes, passportsRes, policiesRes, notesRes
      ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('bookings').select('*'),
        supabase.from('visas').select('*'),
        supabase.from('passports').select('*'),
        supabase.from('policies').select('*'),
        supabase.from('client_notes').select('*'),
      ]);

      if (clientsRes.error) throw new Error(`Clients: ${clientsRes.error.message}`);
      if (bookingsRes.error) throw new Error(`Bookings: ${bookingsRes.error.message}`);
      if (visasRes.error) throw new Error(`Visas: ${visasRes.error.message}`);
      if (passportsRes.error) throw new Error(`Passports: ${passportsRes.error.message}`);
      if (policiesRes.error) throw new Error(`Policies: ${policiesRes.error.message}`);
      if (notesRes.error) throw new Error(`Client Notes: ${notesRes.error.message}`);

      setClients((clientsRes.data as Client[]) || []);
      setBookings((bookingsRes.data as Booking[]) || []);
      setVisas((visasRes.data as Visa[]) || []);
      setPassports((passportsRes.data as Passport[]) || []);
      setPolicies((policiesRes.data as Policy[]) || []);
      setClientNotes((notesRes.data as ClientNote[]) || []);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      lastFetchRef.current = Date.now();
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchData()
  }, [fetchData])

    // Fetch user reminders with polling
    useEffect(()=> {
        if (!session?.user?.id) return;
        let timer: any;
        const load = async () => {
            const { data } = await supabase.from('user_reminders').select('*').eq('user_id', session.user.id).order('due_at', { ascending: true });
            if (data) setUserReminders(data as UserReminder[]);
        };
        load();
        timer = setInterval(load, 60000);
        return ()=> clearInterval(timer);
    }, [session]);

    // Persist user/global metric mode preference
    useEffect(() => {
        try {
            const saved = localStorage.getItem('dashboard_metric_mode');
            if (saved === 'me' || saved === 'all') setUserMetricMode(saved);
        } catch {}
    }, []);
    useEffect(() => {
        try { localStorage.setItem('dashboard_metric_mode', userMetricMode); } catch {}
    }, [userMetricMode]);

  // Refetch on focus/visibility only when data is stale and no modal is open
  useEffect(() => {
    const maybeRefetch = () => {
      if (document.visibilityState !== 'visible') return;
      if (openModal) return; // don't refetch while editing/adding
      const STALE_MS = 2 * 60 * 1000; // 2 minutes
      if (Date.now() - (lastFetchRef.current || 0) > STALE_MS) {
        fetchData();
      }
    };
    window.addEventListener('focus', maybeRefetch);
    document.addEventListener('visibilitychange', maybeRefetch);
    return () => {
      window.removeEventListener('focus', maybeRefetch);
      document.removeEventListener('visibilitychange', maybeRefetch);
    };
  }, [fetchData, openModal]);

  // --- REMINDER GENERATION ---
    const reminders = useMemo<Reminder[]>(() => {
        // Use startOf('day') so diff in 'day' units is calendar-based (prevents tomorrow showing as today)
        const today = dayjs().startOf('day');
    const allReminders: Reminder[] = [];
        const getClientName = (clientId: string) => {
            const c = clients.find(c => c.id === clientId);
            return c ? [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' ') : 'Unknown';
        };

    clients.forEach(client => {
                const dob = dayjs(client.dob).startOf('day');
        if (!dob.isValid()) return;
        let birthdayThisYear = dob.year(today.year());
                if (birthdayThisYear.isBefore(today, 'day')) birthdayThisYear = birthdayThisYear.add(1, 'year');
                const daysLeft = birthdayThisYear.startOf('day').diff(today, 'day');
        if (daysLeft >= 0 && daysLeft <= 7) {
            allReminders.push({ type: 'Birthday', id: client.id, name: [client.first_name, client.middle_name, client.last_name].filter(Boolean).join(' '), dob: client.dob, days_left: daysLeft, client_id: client.id });
        }
    });

        const checkExpiry = (items: (Passport[] | Visa[] | Policy[]), type: string, threshold: number) => {
        items.forEach((item: any) => {
            const expiryDateField = item.expiry_date || item.end_date;
            if (!expiryDateField) return;

                        const expiryDate = dayjs(expiryDateField).startOf('day');
            if (!expiryDate.isValid()) return;
            const daysLeft = expiryDate.diff(today, 'day');
            if (daysLeft >= 0 && daysLeft <= threshold) { 
                                 allReminders.push({ 
                                     type, 
                                     id: item.id, 
                                     client_id: item.client_id, 
                                     name: getClientName(item.client_id), 
                                     expiry_date: expiryDate.format('YYYY-MM-DD'), 
                                     days_left: daysLeft,
                                     // Add visa country so UI can show it
                                     ...(type === 'Visa' && item.country ? { country: item.country } : {})
                                 });
            }
        });
    };
    checkExpiry(passports, 'Passport', 365);
    checkExpiry(visas, 'Visa', 180 );
    checkExpiry(policies, 'Policy', 180);

    bookings.forEach(booking => {
                const departureDate = dayjs(booking.departure_date).startOf('day');
        if (!departureDate.isValid()) return;
        const daysLeft = departureDate.diff(today, 'day');
        if (daysLeft >= 0 && daysLeft <= 365) {
            allReminders.push({ type: 'Booking', id: booking.id, client_id: booking.client_id, name: getClientName(booking.client_id), pnr: booking.pnr, departure_date: booking.departure_date, days_left: daysLeft });
        }
    });
    
    return allReminders.sort((a,b) => (a.days_left ?? 999) - (b.days_left ?? 999));
  }, [clients, bookings, visas, passports, policies]);

  // --- CRUD OPERATIONS ---
  const handleAddItem = async (itemData: unknown) => {
        const tableName = activeView.toLowerCase();
        // Pre-insert duplicate check only for clients
        if (tableName === 'clients') {
            const candidate: any = itemData || {};
            const email = (candidate.email_id||'').trim();
            const phone = (candidate.mobile_no||'').trim();
            const first = (candidate.first_name||'').trim();
            const last = (candidate.last_name||'').trim();
            const dob = (candidate.dob||'').trim();
            // Only run if we have at least one identifier
            if (email || phone || (first && last && dob)) {
                const orClauses: string[] = [];
                const params: Record<string, any> = {};
                // Build OR filters using Supabase's filter syntax via multiple .or groups
                // We'll assemble a single OR string
                if (email) orClauses.push(`email_id.eq.${email}`);
                if (phone) orClauses.push(`mobile_no.eq.${phone}`);
                if (first && last && dob) {
                    // We'll do a case-insensitive match by pulling all possible matches and filtering client side
                }
                let query = supabase.from('clients').select('*');
                if (orClauses.length) {
                    query = query.or(orClauses.join(','));
                }
                const { data: dupData, error: dupErr } = await query.limit(50);
                if (!dupErr) {
                    let matches = dupData || [];
                    if (first && last && dob) {
                        const firstLc = first.toLowerCase();
                        const lastLc = last.toLowerCase();
                        matches = matches.filter(c => (
                            (c.email_id && email && c.email_id === email) ||
                            (c.mobile_no && phone && c.mobile_no === phone) ||
                            ((c.first_name||'').toLowerCase() === firstLc && (c.last_name||'').toLowerCase() === lastLc && c.dob === dob)
                        ));
                    }
                    // If we have any matches that are not the same as new unsaved (no id yet)
                    if (Array.isArray(matches) && matches.length) {
                        setPendingClientCreate({ payload: candidate, matches });
                        setShowDuplicateDialog(true);
                        return; // pause actual insert
                    }
                }
            }
        }
        const { error, data } = await supabase.from(tableName).insert([itemData]).select();
        if (error) setError(`Error adding item: ${error.message}`);
        else { 
                const inserted = Array.isArray(data) ? data[0] : null;
                logActivity('create', tableName, inserted?.id, { values: itemData });
                fetchData(); handleCloseModal(); setSnackbar({open: true, message: `${activeView.slice(0, -1)} added successfully!`}); 
        }
  };

    const ensureProfile = async (user: { id: string; email?: string | null }) => {
        try {
            // Attempt to fetch existing profile
            const { data, error } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
            if (error) return; // silent
            if (!data) {
                await supabase.from('profiles').insert({
                    id: user.id,
                    first_name: user.email ? user.email.split('@')[0] : null,
                    display_name: user.email || 'User',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    locale: (navigator.language || 'en-US'),
                    currency: 'USD',
                    theme: 'light'
                });
                logActivity('bootstrap','profiles', user.id);
            }
        } catch {}
    };

  const handleUpdateItem = async (itemData: unknown) => {
    let tableName = activeView.toLowerCase();
    // Special handling for Client Insight's edit button, as it passes 'Clients' view
    if (activeView === 'Client Insight') {
        tableName = 'clients';
    }

        if (typeof itemData === 'object' && itemData !== null && 'id' in itemData) {
            const { id, ...updateData } = itemData as {id: string};
            const { error } = await supabase.from(tableName).update(updateData).eq('id', id);
            if (error) setError(`Error updating item: ${error.message}`);
            else { 
                logActivity('update', tableName, id, { changes: updateData });
                fetchData(); handleCloseModal(); setSnackbar({open: true, message: `${tableName.slice(0, -1)} updated successfully!`}); 
            }
    }
  };

  const handleDeleteItem = (id: string, view: string) => {
    setItemToDelete({id, view});
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    const tableName = itemToDelete.view.toLowerCase();
        const { error } = await supabase.from(tableName).delete().eq('id', itemToDelete.id);
        if (error) setError(`Error deleting item: ${error.message}`);
        else { 
            logActivity('delete', tableName, itemToDelete.id);
            fetchData(); setSnackbar({open: true, message: `${itemToDelete.view.slice(0, -1)} deleted successfully!`}); 
        }
    setConfirmOpen(false);
    setItemToDelete(null);
  };

  // --- MODAL & DRAWER HANDLERS ---
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleOpenModal = (mode: 'add' | 'edit', item: unknown = null, overrideView: string | null = null) => {
    setModalMode(mode);
    setSelectedItem(item as any);
    // If an overrideView is provided (e.g., from Client Insight to edit a client)
    if (overrideView) {
        setActiveView(overrideView);
    }
    setOpenModal(true);
        // Persist minimal open state so we can auto-reopen after Fast Refresh in dev
        try {
                if (typeof window !== 'undefined') {
                        const viewToUse = overrideView || activeView;
                        (window as any).__MODAL_STATE__ = { open: true, view: viewToUse, mode, selId: (item as any)?.id ?? null };
                }
        } catch {}
  };
  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedItem(null);
    // Potentially reset activeView if it was overridden for the modal, or keep it as is
    // For now, keep it as is, as the user might want to remain in Client Insight.
        try { if (typeof window !== 'undefined') (window as any).__MODAL_STATE__ = { open: false }; } catch {}
  };
    // Ephemeral in-memory persistence to prevent data loss on Fast Refresh while modal is open
    const modalBufferRef = useRef<{ view: string; mode: 'add'|'edit'; data: React.MutableRefObject<any> | any } | null>(null);
    const latestFormDataRef = useRef<any>({});
    useEffect(()=> {
        if (openModal) {
            // Store the ref itself so we always read freshest form data after a refresh
            modalBufferRef.current = { view: activeView, mode: modalMode, data: latestFormDataRef };
        } else {
            modalBufferRef.current = null;
        }
    }, [openModal, activeView, modalMode]);
  const handleOpenDocModal = (client: Client) => {
    setSelectedClientForDocs(client);
    setDocModalOpen(true);
  }
  const handleCloseDocModal = () => {
    setDocModalOpen(false);
    setSelectedClientForDocs(null);
  }

  const handleReminderClick = (reminder: Reminder) => {
    if (reminder.type === 'Birthday' || reminder.type === 'Passport' || reminder.type === 'Visa' || reminder.type === 'Policy' || reminder.type === 'Booking') {
        if (reminder.client_id) {
            const client = clients.find(c => c.id === reminder.client_id);
            if (client) {
                setActiveView('Clients'); // Switch to clients view when editing a client from reminder
                handleOpenModal('edit', client);
            }
        }
    }
  };

    // Auto-reopen the main FormModal after a Fast Refresh (dev only) using window-scoped modal state
    const didAutoReopenRef = useRef(false);
    useEffect(() => {
        if (didAutoReopenRef.current) return;
        if (typeof window === 'undefined') return;
        const modalState = (window as any).__MODAL_STATE__;
        if (!modalState || !modalState.open) return;
        // Wait until initial data load completes for reliable item lookup
        if (loading) return;
        try {
                const view: string = modalState.view;
                const mode: 'add'|'edit' = modalState.mode;
                const selId: string | null = modalState.selId ?? null;
                let item: any = null;
                if (mode === 'edit' && selId) {
                        if (view === 'Clients') item = clients.find(c => (c as any).id === selId) || null;
                        else if (view === 'Bookings') item = bookings.find(b => (b as any).id === selId) || null;
                        else if (view === 'Visas') item = visas.find(v => (v as any).id === selId) || null;
                        else if (view === 'Passports') item = passports.find(p => (p as any).id === selId) || null;
                        else if (view === 'Policies') item = policies.find(p => (p as any).id === selId) || null;
                }
                setActiveView(view);
                handleOpenModal(mode, item, view);
                didAutoReopenRef.current = true;
        } catch {
                // ignore
        }
    }, [loading, clients, bookings, visas, passports, policies]);


  // --- UI CONFIGURATION & FILTERING ---
  const getFieldsForView = (view: string) => {
    switch (view) {
        case 'Clients': return { first_name: '', middle_name: '', last_name: '', email_id: '', mobile_no: '', dob: '', nationality: ''};
    case 'Bookings': return { client_id: '', pnr: '', booking_type: '', destination: '', check_in: '', check_out: '', vendor: '', reference: '', confirmation_no: '', seat_preference: '', meal_preference: '', special_requirement: '', amount: 0, status: 'Confirmed', segments: [] };
    case 'Visas': return { client_id: '', country: '', visa_type: '', visa_number: '', issue_date: '', expiry_date: '', amount: 0, notes: '' };
    case 'Passports': return { client_id: '', passport_number: '', issue_date: '', expiry_date: '', amount: 0};
        case 'Policies': return { client_id: '', policy_number: '', insurer: '', sum_insured: 0, start_date: '', end_date: '', premium_amount: 0 };
        default: return {};
    }
  };

  const handleSort = (column: string) => {
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortColumn(column);
    setSortDirection(newDirection);
  };

  const handleFilterChange = (column: string, value: string) => {
    setFilters(prev => ({ ...prev, [column]: value }));
  };
  
    const filteredData = useMemo(() => {
        const includesText = (val: any, term: string): boolean => {
            if (val == null) return false;
            const t = term.toLowerCase();
            const type = typeof val;
            if (type === 'string' || type === 'number' || type === 'boolean') {
                return String(val).toLowerCase().includes(t);
            }
            if (Array.isArray(val)) {
                return val.some(v => includesText(v, t));
            }
            if (type === 'object') {
                return Object.values(val).some(v => includesText(v, t));
            }
            return false;
        };
    let data: (Client | Booking | Visa | Passport | Policy)[] = [];
    switch (activeView) {
        case 'Clients': data = clients; break;
        case 'Bookings': data = bookings; break;
        case 'Visas': data = visas; break;
        case 'Passports': data = passports; break;
        case 'Policies': data = policies; break;
    }

    let filtered = data;

        if (debouncedSearchTerm) {
                const lowercasedFilter = debouncedSearchTerm.toLowerCase();
                const matchesLinked = (item: any, term: string) => {
                    // Augment search by looking up related client fields when only client_id is stored
                    let extra = '';
                    if (activeView === 'Bookings' || activeView === 'Visas' || activeView === 'Passports' || activeView === 'Policies') {
                        const client = clients.find(c => c.id === item.client_id);
                        if (client) {
                            extra = [client.first_name, client.last_name, client.email_id, client.mobile_no, client.nationality]
                                .filter(Boolean)
                                .join(' ')
                                .toLowerCase();
                        }
                    }
                    return extra ? extra.includes(term) : false;
                };
                filtered = filtered.filter(item => includesText(item, lowercasedFilter) || matchesLinked(item, lowercasedFilter));
        }

        filtered = filtered.filter(item => Object.entries(filters).every(([key, val]) => !val || String((item as any)[key]).toLowerCase().includes(val.toLowerCase())));

        // Date filtering: find candidate date fields per entity
        const dateKeysPerView: Record<string,string[]> = {
            Clients: ['created_at','dob'],
            Bookings: ['check_in','check_out','created_at','departure_date'],
            Visas: ['issue_date','expiry_date','created_at'],
            Passports: ['issue_date','expiry_date','created_at'],
            Policies: ['start_date','end_date','created_at']
        };
        const dk = dateKeysPerView[activeView] || [];
        if (dateFrom || dateTo) {
            filtered = filtered.filter(item => {
                const anyItem: any = item;
                return dk.some(k => {
                    const raw = anyItem[k];
                    if (!raw) return false;
                    const d = dayjs(raw);
                    if (!d.isValid()) return false;
                    if (dateFrom && d.isBefore(dateFrom,'day')) return false;
                    if (dateTo && d.isAfter(dateTo,'day')) return false;
                    return true;
                });
            });
        }

    if (sortColumn) {
        // Create a shallow copy before sorting to avoid mutating the original state
        filtered = [...filtered].sort((a, b) => {
            let aVal = (a as any)[sortColumn];
            let bVal = (b as any)[sortColumn];

            // Handle null or undefined values
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // Case-insensitive compare for strings
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return filtered;
  }, [debouncedSearchTerm, activeView, clients, bookings, visas, passports, policies, sortColumn, sortDirection, filters]);

    const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, view: 'Dashboard' },
    { text: 'Client Insight', icon: <AccountBoxIcon />, view: 'Client Insight' },
    { text: 'Clients', icon: <PeopleIcon />, view: 'Clients' },
    { text: 'Bookings', icon: <FlightIcon />, view: 'Bookings' },
    { text: 'Visas', icon: <VpnKeyIcon />, view: 'Visas'},
    { text: 'Passports', icon: <CreditCardIcon />, view: 'Passports' },
    { text: 'Policies', icon: <PolicyIcon />, view: 'Policies'},
    { text: 'Itineraries', icon: <NotesIcon />, view: 'Itineraries' },
    { text: 'Tasks', icon: <NotificationsIcon />, view: 'Tasks' },
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ bgcolor: 'primary.main', color: 'white', justifyContent: leftCollapsed ? 'center' : 'space-between', px: 1 }}>
        {!leftCollapsed && <Typography variant="h6" noWrap>SWTravels</Typography>}
        <IconButton size="small" onClick={() => setLeftCollapsed(c=>!c)} sx={{ color: 'inherit' }} aria-label="toggle navigation width">
          {leftCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Toolbar>
      <List sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
        <Box>
            {menuItems.map(item => (
                <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                    <ListItemButton selected={activeView === item.view} onClick={() => { setActiveView(item.view); setMobileOpen(false); }} sx={{ minHeight: 48, justifyContent: leftCollapsed ? 'center' : 'flex-start', px: 2 }}>
                      <ListItemIcon sx={{ minWidth: 0, mr: leftCollapsed ? 0 : 2, justifyContent: 'center' }}>{item.icon}</ListItemIcon>
                      {!leftCollapsed && <ListItemText primary={item.text} />}
                    </ListItemButton>
                </ListItem>
            ))}
        </Box>
        <ListItem disablePadding sx={{ mt: 'auto', display: 'block' }}>
          <ListItemButton onClick={() => supabase.auth.signOut()} sx={{ minHeight: 48, justifyContent: leftCollapsed ? 'center' : 'flex-start', px: 2 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: leftCollapsed ? 0 : 2, justifyContent: 'center' }}><LogoutIcon /></ListItemIcon>
            {!leftCollapsed && <ListItemText primary="Logout" />}
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  // --- RENDER FUNCTIONS ---
  const renderContent = () => {
    if (loading) return <Grid container justifyContent="center" sx={{mt: 4}}><CircularProgress /></Grid>;
    if (error) return <Alert severity="error">{error}</Alert>;

    switch (activeView) {
                case 'Dashboard': return <DashboardView 
                    stats={{clients: clients.length, bookings: bookings.length}}
                    clientData={clients} bookingData={bookings} policyData={policies} visaData={visas} passportData={passports} globalReminders={reminders}
                    userDailyMetrics={userDailyMetrics} userActivity={userActivity} userMetricMode={userMetricMode} onMetricModeChange={setUserMetricMode}
                />;
    case 'Client Insight': return <ClientInsightView allClients={clients} allBookings={bookings} allVisas={visas} allPassports={passports} allPolicies={policies} allNotes={clientNotes} globalReminders={reminders} onUpdate={fetchData} onShowSnackbar={setSnackbar} onOpenModal={handleOpenModal} onDeleteItem={handleDeleteItem} />;
    case 'Itineraries': return <ItinerariesView clients={clients} />;
        case 'Clients': 
        case 'Bookings':
        case 'Visas':
        case 'Passports':
                case 'Policies':
            return <TableView 
                data={filteredData} 
                view={activeView}
                getFieldsForView={getFieldsForView}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={handleSort}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                onOpenModal={handleOpenModal}
                onDeleteItem={handleDeleteItem}
                onOpenDocModal={handleOpenDocModal}
                clients={clients}
                bookings={bookings}
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                onClearDates={()=>{ setDateFrom(null); setDateTo(null); }}
            />;
                        case 'Tasks':
                                                return <UserRemindersView 
                                                    reminders={userReminders} 
                                                    onCreate={()=>{ setEditingReminder(null); setReminderModalOpen(true); }}
                                                    onEdit={(r: UserReminder)=> { setEditingReminder(r); setReminderModalOpen(true); }}
                                                    onStatusChange={async (r: UserReminder, status: UserReminder['status'])=> { await supabase.from('user_reminders').update({ status, updated_at: new Date().toISOString() }).eq('id', r.id); setUserReminders(list => list.map(x => x.id===r.id? { ...x, status }: x)); }}
                                                    onDelete={(id: string)=> setUserReminders(list => list.filter(r => r.id !== id))}
                                                />;
        default: return <Typography>Select a view</Typography>;
    }
  };

    const DashboardView = ({ stats, clientData, bookingData, policyData, visaData, passportData, globalReminders, userDailyMetrics, userActivity, userMetricMode, onMetricModeChange }: { stats: any, clientData: Client[], bookingData: Booking[], policyData: Policy[], visaData: Visa[], passportData: Passport[], globalReminders: Reminder[], userDailyMetrics: UserDailyMetrics[], userActivity: UserActivity[], userMetricMode: 'all' | 'me', onMetricModeChange: (m:'all'|'me')=>void }) => {
    const [opportunityTab, setOpportunityTab] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setOpportunityTab(newValue);
    };

    // Derive user-created entity id sets from activity log (fallback approach when tables lack explicit created_by columns)
    const userCreated = useMemo(() => {
        const sets = { clients: new Set<string>(), bookings: new Set<string>(), visas: new Set<string>(), passports: new Set<string>(), policies: new Set<string>() };
        userActivity.forEach(a => {
            if (a.action === 'create' && a.entity_type && a.entity_id) {
                const t = a.entity_type.toLowerCase();
                if (t === 'clients') sets.clients.add(String(a.entity_id));
                else if (t === 'bookings') sets.bookings.add(String(a.entity_id));
                else if (t === 'visas') sets.visas.add(String(a.entity_id));
                else if (t === 'passports') sets.passports.add(String(a.entity_id));
                else if (t === 'policies') sets.policies.add(String(a.entity_id));
            }
        });
        return sets;
    }, [userActivity]);
    const isUser = userMetricMode === 'me';
    const scopedClients = useMemo(() => isUser ? clientData.filter(c => userCreated.clients.has(c.id)) : clientData, [isUser, clientData, userCreated]);
    const scopedBookings = useMemo(() => isUser ? bookingData.filter(b => userCreated.bookings.has(b.id)) : bookingData, [isUser, bookingData, userCreated]);
    const scopedVisas = useMemo(() => isUser ? visaData.filter(v => userCreated.visas.has(v.id)) : visaData, [isUser, visaData, userCreated]);
    const scopedPassports = useMemo(() => isUser ? passportData.filter(p => userCreated.passports.has(p.id)) : passportData, [isUser, passportData, userCreated]);
    const scopedPolicies = useMemo(() => isUser ? policyData.filter(p => userCreated.policies.has(p.id)) : policyData, [isUser, policyData, userCreated]);
    const nationalityData = useMemo(() => {
        const agg = scopedClients.reduce((acc: Record<string, { label: string; count: number }>, c: Client) => {
            const raw = c.nationality || 'Unknown';
            const key = raw.toLowerCase();
            if (!acc[key]) acc[key] = { label: raw, count: 0 };
            acc[key].count++;
            return acc;
        }, {});
        return Object.values(agg).map(({ label, count }) => ({ name: label, value: count }));
    }, [scopedClients]);

    const bookingsByMonthData = useMemo(() => {
        // Use stable ref timestamp so SSR vs CSR doesn't mismatch (hydration safety)
        const base = nowRef.current;
        const counts = Array(12).fill(0).map((_, i) => ({ name: base.month(i).format('MMM'), bookings: 0 }));
        scopedBookings.forEach((b: Booking) => { const m = dayjs(b.check_in).month(); if(m>=0) counts[m].bookings++; });
        return counts;
    }, [scopedBookings]);
    
    const topClientsByRevenue = useMemo(() => {
        // Aggregate revenue across bookings, policies (premium), visas & passports (new amount fields)
        const spend: Record<string, number> = {};
        scopedBookings.forEach(b => { if (b.amount) spend[b.client_id] = (spend[b.client_id] || 0) + b.amount; });
        scopedPolicies.forEach(p => { if (p.premium_amount) spend[p.client_id] = (spend[p.client_id] || 0) + p.premium_amount; });
        scopedVisas.forEach(v => { const anyV: any = v as any; if (anyV.amount) spend[v.client_id] = (spend[v.client_id] || 0) + Number(anyV.amount)||0; });
        scopedPassports.forEach(p => { const anyP: any = p as any; if (anyP.amount) spend[p.client_id] = (spend[p.client_id] || 0) + Number(anyP.amount)||0; });
        return Object.entries(spend)
            .sort((a,b)=> b[1]-a[1])
            .slice(0,5)
            .map(([clientId,total])=> ({ name: scopedClients.find(c=>c.id===clientId)?.first_name || 'Unknown', revenue: total }));
    }, [scopedBookings, scopedPolicies, scopedVisas, scopedPassports, scopedClients]);

    const bookingStatusData = useMemo(() => {
        const statusCounts = scopedBookings.reduce((acc: Record<string, { label: string; count: number }>, booking: Booking) => {
            const raw = booking.status || 'Pending';
            const key = raw.toLowerCase();
            if (!acc[key]) acc[key] = { label: raw, count: 0 };
            acc[key].count++;
            return acc;
        }, {});
        return Object.values(statusCounts).map(({ label, count }) => ({ name: label, value: count }));
    }, [scopedBookings]);

    const crossSellOpportunities = useMemo(() => {
        const allClientIds = new Set(scopedClients.map(c => c.id));
        const clientsWithBookings = new Set(scopedBookings.map(b => b.client_id));
        const clientsWithPolicies = new Set(scopedPolicies.map(p => p.client_id));
        const clientsWithVisas = new Set(scopedVisas.map(v => v.client_id));
        const clientsWithPassports = new Set(scopedPassports.map(p => p.client_id));
        const today = dayjs();

        const opportunities: Record<string, string[]> = {
            'Needs Insurance Policy': [...clientsWithBookings].filter(id => !clientsWithPolicies.has(id)),
            'May Need Visa': [...clientsWithBookings].filter(id => !clientsWithVisas.has(id)),
            'Needs Passport on File': [...allClientIds].filter(id => !clientsWithPassports.has(id)),
            'Needs First Booking': [...allClientIds].filter(id => !clientsWithBookings.has(id)),
        };

        // Potential Re-engagement: Clients who haven't booked in the last year
        const oneYearAgo = today.subtract(1, 'year');
    const recentBookers = new Set(scopedBookings.filter(b => dayjs(b.created_at).isAfter(oneYearAgo)).map(b => b.client_id));
        opportunities['Potential Re-engagement'] = [...clientsWithBookings].filter(id => !recentBookers.has(id));

        // Clients with expiring passports (next 6 months)
        const sixMonthsFromNow = today.add(6, 'months');
    const expiringPassportClientIds = new Set(scopedPassports.filter(p => {
            const expiry = dayjs(p.expiry_date);
            return expiry.isAfter(today) && expiry.isBefore(sixMonthsFromNow);
        }).map(p => p.client_id));
        opportunities['Passport Renewal Opportunity'] = [...expiringPassportClientIds];

        return Object.entries(opportunities).map(([type, clientIds]) => ({
            type,
            clients: clientIds.map(id => scopedClients.find(c => c.id === id)).filter((c): c is Client => Boolean(c)).slice(0, 10)
        }));
    }, [scopedClients, scopedBookings, scopedPolicies, scopedVisas, scopedPassports]);

    const vendorPerformanceData = useMemo(() => {
        const vendorRevenue = scopedBookings.reduce((acc: Record<string, { label: string; total: number }>, booking: Booking) => {
            if (booking.vendor && booking.amount) {
                const key = booking.vendor.toLowerCase();
                if (!acc[key]) acc[key] = { label: booking.vendor, total: 0 };
                acc[key].total += booking.amount;
            }
            return acc;
        }, {});

        return Object.values(vendorRevenue)
            .sort((a, b) => b.total - a.total)
            .slice(0, 7)
            .map(({ label, total }) => ({ name: label, 'Revenue': total }));
    }, [scopedBookings]);
    
    const clientAgeData = useMemo(() => {
        const ageGroups: Record<string, number> = { '18-30': 0, '31-45': 0, '46-60': 0, '61+': 0, 'Unknown': 0 };
        scopedClients.forEach((c: Client) => {
            if (!c.dob) {
                ageGroups.Unknown++;
                return;
            }
            const age = dayjs().diff(c.dob, 'year');
            if (age <= 30) ageGroups['18-30']++;
            else if (age <= 45) ageGroups['31-45']++;
            else if (age <= 60) ageGroups['46-60']++;
            else ageGroups['61+']++;
        });
        return Object.entries(ageGroups).map(([name, value]) => ({ name, 'Number of Clients': value }));
    }, [scopedClients]);

    const popularDestinations = useMemo(() => {
        const destinationCounts = scopedBookings.reduce((acc: Record<string, { label: string; count: number }>, booking: Booking) => {
            const raw = booking.destination || 'N/A';
            const key = raw.toLowerCase();
            if (!acc[key]) acc[key] = { label: raw, count: 0 };
            acc[key].count++;
            return acc;
        }, {});

        return Object.values(destinationCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 7)
            .map(({ label, count }) => ({ name: label, 'Bookings': count }));
    }, [scopedBookings]);

    const bookingTypeData = useMemo(() => {
        const typeCounts = scopedBookings.reduce((acc: Record<string, { label: string; count: number }>, booking: Booking) => {
            const raw = booking.booking_type || 'Other';
            const key = raw.toLowerCase();
            if (!acc[key]) acc[key] = { label: raw, count: 0 };
            acc[key].count++;
            return acc;
        }, {});
        return Object.values(typeCounts).map(({ label, count }) => ({ name: label, value: count }));
    }, [scopedBookings]);
    
    const avgTripDuration = useMemo(() => {
        const validTrips = scopedBookings.filter((b: Booking) => b.check_in && b.check_out);
        if (validTrips.length === 0) return 0;
        const totalDays = validTrips.reduce((sum: number, b: Booking) => {
            const duration = dayjs(b.check_out).diff(dayjs(b.check_in), 'day');
            return sum + (duration > 0 ? duration : 0);
        }, 0);
        return Math.round(totalDays / validTrips.length);
    }, [scopedBookings]);

    const expiringRemindersCount = useMemo(() => {
        return globalReminders.filter((r: Reminder) => r.type !== 'Birthday' && r.days_left! <= 30 && r.days_left! >=0).length;
    }, [globalReminders]);
    
        // Aggregate user-specific KPIs (30d)
        const userKpis = useMemo(() => {
            // Always derive from current scoped datasets so deletions are reflected.
            const cutoff = dayjs().subtract(30,'day');
            const inWindow = (rows:any[]) => rows.filter(r => r.created_at ? dayjs(r.created_at).isAfter(cutoff) : true);
            const bookingsArr = inWindow(scopedBookings);
            const policiesArr = inWindow(scopedPolicies);
            const bookings = bookingsArr.length;
            const policies = policiesArr.length;
            const bookingRevenue = bookingsArr.reduce((s,b)=> s + (b.amount||0),0);
            const policyRevenue = policiesArr.reduce((s,p)=> s + (p.premium_amount||0),0);
            return { bookings, revenue: bookingRevenue + policyRevenue, policies, policyRevenue };
        }, [scopedBookings, scopedPolicies]);

        const globalKpis = useMemo(()=> {
            const bookingRevenue = bookingData.reduce((s,b)=> s + (b.amount||0),0);
            const policyRevenue = policyData.reduce((s,p)=> s + (p.premium_amount||0),0);
            const visaRevenue = visaData.reduce((s,v)=> s + (Number((v as any).amount)||0),0);
            const passportRevenue = passportData.reduce((s,p)=> s + (Number((p as any).amount)||0),0);
            return {
                bookings: bookingData.length,
                revenue: bookingRevenue + policyRevenue + visaRevenue + passportRevenue,
                policies: policyData.length,
                visas: visaData.length,
                passports: passportData.length,
                clients: clientData.length,
            };
        }, [bookingData, policyData, visaData, passportData, clientData]);

    const activeKpis = isUser ? userKpis : globalKpis as unknown as typeof userKpis;
        return (
        <Fade in={true}>
        <Grid container spacing={3}>
            {/* Key Metrics */}
            <Grid item xs={12}>
                                <Grid container spacing={3} alignItems="stretch">
                                        {/* Toggle moved to AppBar for better visibility */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                                                        <Typography variant="h6" color="text.secondary" gutterBottom>{isUser? 'My Bookings (30d)':'Total Clients'}</Typography>
                                                        <Typography variant="h4" color="primary.main" sx={{fontWeight: 'bold'}}>{isUser ? activeKpis.bookings : stats.clients}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                                                        <Typography variant="h6" color="text.secondary" gutterBottom>{isUser? 'My Policies (30d)':'Avg. Trip Duration'}</Typography>
                                                        <Typography variant="h4" color="info.main" sx={{fontWeight: 'bold'}}>{isUser ? activeKpis.policies : `${avgTripDuration} Days`}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                                                        <Typography variant="h6" color="text.secondary" gutterBottom>{isUser? 'My Revenue (30d)':'Bookings'}</Typography>
                                                        <Typography variant="h4" color="secondary.main" sx={{fontWeight: 'bold'}}>{isUser ? (activeKpis.revenue||0).toFixed(0) : stats.bookings}</Typography>
                        </Paper>
                    </Grid>
                    
                    {/* Added department KPIs */}
                                        {/* Department/Product KPIs with per-user variants */}
                                        
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius:2, height:'100%'}}>
                                                <Typography variant="h6" color="text.secondary" gutterBottom>{isUser ? 'My Visas (30d)' : 'Visas'}</Typography>
                                                <Typography variant="h4" color="success.main" sx={{fontWeight:'bold'}}>{isUser ? scopedVisas.length : visaData.length}</Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius:2, height:'100%'}}>
                                                <Typography variant="h6" color="text.secondary" gutterBottom>{isUser ? 'My Passports (30d)' : 'Passports'}</Typography>
                                                <Typography variant="h4" color="info.main" sx={{fontWeight:'bold'}}>{isUser ? scopedPassports.length : passportData.length}</Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={3}>
                                            <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius:2, height:'100%'}}>
                                            <Typography variant="h6" color="text.secondary" gutterBottom>{isUser ? 'My Clients (30d)' : 'Policies'}</Typography>
                                            <Typography variant="h4" color="primary.dark" sx={{fontWeight:'bold'}}>{isUser ? scopedClients.length : policyData.length}</Typography>
                                            </Paper>
                                        </Grid>
                                        {isUser && (
                                            <Grid item xs={12}>
                                                <Typography variant="caption" color="text.secondary">Showing metrics for your activity over last 30 days. Switch back to "All Data" to view organization-wide KPIs.</Typography>
                                            </Grid>
                                        )}
                </Grid>
            </Grid>
            
            {/* Charts Section */}
            
            <Grid item xs={12}>
                <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Cross-Sell Opportunities</Typography>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={opportunityTab} onChange={handleTabChange} aria-label="opportunity tabs">
                            {crossSellOpportunities.map((op, index) => (
                                <Tab label={`${op.type} (${op.clients.length})`} key={index} />
                            ))}
                        </Tabs>
                    </Box>
                    {crossSellOpportunities.map((opportunity, index) => (
                        <TabPanel value={opportunityTab} index={index} key={index}>
                            <TableContainer sx={{ mt: 1, maxHeight: 300 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{fontWeight: 'bold', bgcolor: 'action.hover'}}>Client Name</TableCell>
                                            <TableCell sx={{fontWeight: 'bold', bgcolor: 'action.hover'}}>Email</TableCell>
                                            <TableCell sx={{fontWeight: 'bold', bgcolor: 'action.hover'}}>Phone</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {opportunity.clients.length > 0 ? (
                                            opportunity.clients.map((client) => (
                                                <TableRow hover key={client.id}>
                                                    <TableCell>{[client.first_name, client.middle_name, client.last_name].filter(Boolean).join(' ')}</TableCell>
                                                    <TableCell>{client.email_id}</TableCell>
                                                    <TableCell>{client.mobile_no}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} align="center">No clients in this category.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </TabPanel>
                    ))}
                </Paper>
            </Grid>
            <Grid item xs={12}>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Paper elevation={3} sx={{p:3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column'}}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Bookings Over Time</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%"><LineChart data={bookingsByMonthData} margin={{top: 5, right: 30, left: 20, bottom: 5}}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><RechartsTooltip /><Legend /><Line type="monotone" dataKey="bookings" stroke="#8884d8" activeDot={{ r: 8 }} strokeWidth={2} /></LineChart></ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper elevation={3} sx={{ p: 3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Client Nationality Distribution</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={nationalityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : ''}%`} labelLine={false}>{nationalityData.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}</Pie><RechartsTooltip /><Legend wrapperStyle={{fontSize: '0.8rem'}} /></PieChart></ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper elevation={3} sx={{p:3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column'}}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Popular Destinations</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={popularDestinations} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={60} interval={0} style={{fontSize: '0.75rem'}} />
                                        <YAxis allowDecimals={false} label={{ value: 'Bookings', angle: -90, position: 'insideLeft' }} />
                                        <RechartsTooltip />
                                        <Legend />
                                        <Bar dataKey="Bookings" fill="#00C49F" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper elevation={3} sx={{ p: 3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Booking Status</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={bookingStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} fill="#FF8042" label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : ''}%`} labelLine={false}>{bookingStatusData.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS.slice(2)[i % COLORS.slice(2).length]} />)}</Pie><RechartsTooltip /><Legend wrapperStyle={{fontSize: '0.8rem'}} /></PieChart></ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper elevation={3} sx={{p:3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Top 5 Clients (by Revenue)</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topClientsByRevenue} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis allowDecimals={false} label={{ value: `Revenue (${CURRENCY})`, angle: -90, position: 'insideLeft' }} />
                                        <RechartsTooltip formatter={(value) => formatCurrency(Number(value),0)} />
                                        <Legend />
                                        <Bar dataKey="revenue" fill="#AF19FF" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper elevation={3} sx={{ p: 3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Vendor Performance (by Revenue)</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={vendorPerformanceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={60} interval={0} style={{fontSize: '0.75rem'}} />
                                        <YAxis allowDecimals={false} label={{ value: `Revenue (${CURRENCY})`, angle: -90, position: 'insideLeft' }} />
                                        <RechartsTooltip formatter={(value: number) => formatCurrency(Number(value),0)} />
                                        <Legend />
                                        <Bar dataKey="Revenue" fill="#FF6666" radius={[4, 4, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Grid>
        </Grid>
        </Fade>
    );
  };

  function TabPanel(props: { children?: React.ReactNode; index: number; value: number; }) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}
  
  const FormModal = () => {
    const [formData, setFormData] = useState<any>({});
        // Maintain a ref mirror so parent effect can snapshot
        useEffect(()=> { latestFormDataRef.current = formData; }, [formData]);
        // Also mirror into a window-scoped ephemeral buffer to survive full Fast Refresh remounts
        useEffect(() => {
            if (typeof window !== 'undefined' && openModal) {
                try {
                    (window as any).__FORM_BUFFER__ = { view: activeView, mode: modalMode, data: formData };
                } catch {}
            }
        }, [formData, activeView, modalMode, openModal]);
    const [airportQuery, setAirportQuery] = useState('');
    const [airportOptions, setAirportOptions] = useState<Array<{ code: string; name: string; city?: string; country?: string; type: string }>>([]);
    const airportAbortRef = useRef<AbortController | null>(null);
    const [initialized, setInitialized] = useState(false);
    // Draft persistence removed: no storageKey / dirty tracking
        // Debug mount/unmount to diagnose unexpected remounts (Policies form issue)
        useEffect(()=> {
            console.debug('[FormModal] mount', { activeView, modalMode });
            return () => console.debug('[FormModal] unmount', { activeView, modalMode });
        }, [activeView, modalMode]);

    useEffect(() => {
            if (!openModal) return;
            // 1) Try in-memory buffer first (covers add & edit)
            if (modalBufferRef.current && modalBufferRef.current.view === activeView && modalBufferRef.current.mode === modalMode && modalBufferRef.current.data) {
                const raw = modalBufferRef.current.data as any;
                const snapshot = raw && typeof raw === 'object' && 'current' in raw ? raw.current : raw;
                if (snapshot && Object.keys(snapshot).length) {
                    setFormData(JSON.parse(JSON.stringify(snapshot)));
                    setInitialized(true);
                    return;
                }
            }
            // 2) Fallback: window-scoped buffer (survives Fast Refresh in dev)
            try {
                if (typeof window !== 'undefined') {
                    const wb = (window as any).__FORM_BUFFER__;
                    if (wb && wb.view === activeView && wb.mode === modalMode && wb.data && Object.keys(wb.data).length) {
                        setFormData(JSON.parse(JSON.stringify(wb.data)));
                        setInitialized(true);
                        return;
                    }
                }
            } catch {}
            // 3) If editing and we have a selected item, use it
            if (modalMode === 'edit' && selectedItem) {
                setFormData(JSON.parse(JSON.stringify(selectedItem)));
                setInitialized(true);
                return;
            }
            // 4) Otherwise initialize with defaults
            const defaults = activeView === 'Client Insight' ? getFieldsForView('Clients') : getFieldsForView(activeView);
            setFormData(defaults);
            setInitialized(true);
        }, [openModal, modalMode, selectedItem, activeView]);

    // Draft persistence & dirty tracking removed

            // Beforeunload warning removed

        // Debounced airport search
        useEffect(() => {
            const term = airportQuery.trim();
            if (!term || term.length < 2) { setAirportOptions([]); return; }
            const id = setTimeout(async () => {
                try {
                    airportAbortRef.current?.abort();
                    const ctrl = new AbortController();
                    airportAbortRef.current = ctrl;
                    const res = await fetch(`/api/airports?q=${encodeURIComponent(term)}`, { signal: ctrl.signal, cache: 'no-store' });
                    if (!res.ok) return;
                    const data = await res.json();
                    setAirportOptions(Array.isArray(data) ? data : []);
                } catch {}
            }, 250);
            return () => clearTimeout(id);
        }, [airportQuery]);

    // (Removed) Previously we cleared sessionStorage on unmount; this caused data loss on fast refresh.
    // We'll now retain sessionStorage until explicit cancel/submit, and also flush on unmount.

    const formKeys = useMemo(() => Object.keys(formData).filter(k => !['id','created_at'].includes(k)), [formData]);

    // --- Generic Form Draft Persistence ---
    // Draft key logic removed
    // Clear draft on successful submit handled inside handleSubmit

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type, checked } = e.target as HTMLInputElement;
      setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleDateChange = (name: string, date: dayjs.Dayjs | null) => {
      setFormData((prev: any) => ({ ...prev, [name]: date ? date.format('YYYY-MM-DD') : null }));
    };

        const handleSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            // Removed draft cleanup
      const viewForDefs = activeView === 'Client Insight' ? 'Clients' : activeView;
            const defs: any = getFieldsForView(viewForDefs);
            const payload: any = {};
            // Only include keys that exist in schema defaults for this view
            Object.keys(defs).forEach(k => {
                let val = formData[k];
                if (val === '' || typeof val === 'undefined') val = null;
                if (typeof defs[k] === 'number') {
                    if (val === null) payload[k] = null; else {
                        const n = typeof val === 'number' ? val : parseFloat(String(val));
                        payload[k] = Number.isFinite(n) ? n : null;
                    }
                } else {
                    payload[k] = val;
                }
            });
      if (modalMode === 'edit' && 'id' in formData) payload.id = formData.id;
      if (modalMode === 'add') handleAddItem(payload); else handleUpdateItem(payload);
    };

    const clientsForSelect = useMemo(() => [...clients].filter(Boolean).sort((a:any,b:any)=> (a.first_name||'').localeCompare(b.first_name||'')), [clients]);
    const bookingsForSelect = useMemo(() => formData.client_id ? bookings.filter(b => b.client_id === formData.client_id) : bookings, [bookings, formData.client_id]);

        return (
            <Dialog open={openModal} onClose={handleCloseModal} maxWidth={activeView === 'Bookings' ? 'md' : 'sm'} fullWidth keepMounted>
        <DialogTitle>{modalMode === 'add' ? 'Add New' : 'Edit'} {(activeView === 'Client Insight' ? 'Client' : activeView.slice(0, -1))}</DialogTitle>
    <form onSubmit={handleSubmit} autoComplete="off">
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DialogContent dividers>
                            <Grid container spacing={2} sx={{ pt:1 }}>
                                {formKeys.map(key => {
                                    const label = key.replace(/_/g,' ').replace(/\b\w/g, l=>l.toUpperCase());
                                    const isLong = key.includes('notes') || key.includes('special_requirement');
                                    const gridCols = key === 'segments' ? 12 : (isLong ? 12 : 6);
                                    return (
                                        <Grid item xs={12} sm={gridCols} key={key}>
                                            {/* Multi-city segments editor for Bookings */}
                                                                    {key === 'segments' && activeView === 'Bookings' && (
                                                                        <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.default' }}>
                                                                            <Stack spacing={1}>
                                                                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                                                                    <Box>
                                                                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Trip Segments</Typography>
                                                                                        <Typography variant="body2" color="text.secondary">Add each leg of the journey (IATA codes suggested)</Typography>
                                                                                    </Box>
                                                                                    <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => {
                                                                                        const next = Array.isArray(formData.segments) ? [...formData.segments] : [];
                                                                                        next.push({ origin: '', destination: '', departure_date: '', airline: '' });
                                                                                        setFormData((p:any)=>({ ...p, segments: next }));
                                                                                    }}>Add Segment</Button>
                                                                                </Stack>

                                                                                {(() => {
                                                                                    const airports = [
                                                                                        { code: 'BOM', name: 'Mumbai' },
                                                                                        { code: 'DEL', name: 'Delhi' },
                                                                                        { code: 'BLR', name: 'Bengaluru' },
                                                                                        { code: 'HYD', name: 'Hyderabad' },
                                                                                        { code: 'MAA', name: 'Chennai' },
                                                                                        { code: 'PNQ', name: 'Pune' },
                                                                                        { code: 'GOI', name: 'Goa' },
                                                                                        { code: 'DXB', name: 'Dubai' },
                                                                                        { code: 'LHR', name: 'London Heathrow' },
                                                                                        { code: 'JFK', name: 'New York JFK' },
                                                                                    ];
                                                                                    const opt = (code?: string) => airports.find(a => a.code === (code || '').toUpperCase()) || null;
                                                                                    return (
                                                                                        <Stack spacing={1.5}>
                                                                                            {(Array.isArray(formData.segments) ? formData.segments : []).map((seg: TripSegment, idx: number) => (
                                                                                                <Paper key={idx} elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                                                                                                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                                                                                                        <Chip size="small" label={`Segment ${idx + 1}`} />
                                                                                                        <Tooltip title="Delete Segment">
                                                                                                            <IconButton color="error" onClick={() => {
                                                                                                                const next = [...(formData.segments || [])];
                                                                                                                next.splice(idx, 1);
                                                                                                                setFormData((p:any) => ({ ...p, segments: next }));
                                                                                                            }}>
                                                                                                                <DeleteIcon />
                                                                                                            </IconButton>
                                                                                                        </Tooltip>
                                                                                                    </Stack>
                                                                                                    <Grid container spacing={2}>
                                                                                                                                                                                        <Grid item xs={12} md={3}>
                                                                                                                                                                                            <Autocomplete size="small"
                                                                                                                                                                                                freeSolo
                                                                                                                                                                                                options={airportOptions.map(o => `${o.code} — ${o.name}${o.city ? `, ${o.city}` : ''}${o.country ? `, ${o.country}` : ''}`)}
                                                                                                                                                                                                filterOptions={(x)=>x}
                                                                                                                                                                                                value={seg.origin || ''}
                                                                                                                                                                                                onChange={(e, val)=>{
                                                                                                                                                                                                    const code = typeof val === 'string' ? val.trim().slice(0,3).toUpperCase() : '';
                                                                                                                                                                                                    const next = [...(formData.segments||[])];
                                                                                                                                                                                                    next[idx] = { ...next[idx], origin: code };
                                                                                                                                                                                                    setFormData((p:any)=>({ ...p, segments: next }));
                                                                                                                                                                                                }}
                                                                                                                                                                                                onInputChange={(e, val)=> setAirportQuery(val)}
                                                                                                                                                                                                renderInput={(params)=> <TextField {...params} label="Origin (IATA)" fullWidth placeholder="Type city or airport" />}
                                                                                                                                                                                            />
                                                                                                                                                                                        </Grid>
                                                                                                                                                                                        <Grid item xs={12} md={3}>
                                                                                                                                                                                            <Autocomplete size="small"
                                                                                                                                                                                                freeSolo
                                                                                                                                                                                                options={airportOptions.map(o => `${o.code} — ${o.name}${o.city ? `, ${o.city}` : ''}${o.country ? `, ${o.country}` : ''}`)}
                                                                                                                                                                                                filterOptions={(x)=>x}
                                                                                                                                                                                                value={seg.destination || ''}
                                                                                                                                                                                                onChange={(e, val)=>{
                                                                                                                                                                                                    const code = typeof val === 'string' ? val.trim().slice(0,3).toUpperCase() : '';
                                                                                                                                                                                                    const next = [...(formData.segments||[])];
                                                                                                                                                                                                    next[idx] = { ...next[idx], destination: code };
                                                                                                                                                                                                    setFormData((p:any)=>({ ...p, segments: next }));
                                                                                                                                                                                                }}
                                                                                                                                                                                                onInputChange={(e, val)=> setAirportQuery(val)}
                                                                                                                                                                                                renderInput={(params)=> <TextField {...params} label="Destination (IATA)" fullWidth placeholder="Type city or airport" />}
                                                                                                                                                                                            />
                                                                                                                                                                                        </Grid>
                                                                                                        <Grid item xs={12} md={3}>
                                                                                                               <DatePicker format={DISPLAY_DATE} label="Departure Date" value={seg.departure_date ? dayjs(seg.departure_date) : null}
                                                                                                                onChange={(d)=>{
                                                                                                                    const next = [...(formData.segments||[])];
                                                                                                                    next[idx] = { ...next[idx], departure_date: d ? d.format('YYYY-MM-DD') : '' };
                                                                                                                    setFormData((p:any)=>({ ...p, segments: next }));
                                                                                                                }}
                                                                                                                slotProps={{ textField: { size:'small', fullWidth: true } }}
                                                                                                            />
                                                                                                        </Grid>
                                                                                                        <Grid item xs={12} md={3}>
                                                                                                            <TextField size="small" fullWidth label="Airline" value={seg.airline || ''}
                                                                                                                onChange={(e)=>{
                                                                                                                    const next = [...(formData.segments||[])];
                                                                                                                    next[idx] = { ...next[idx], airline: e.target.value };
                                                                                                                    setFormData((p:any)=>({ ...p, segments: next }));
                                                                                                                }}
                                                                                                            />
                                                                                                        </Grid>
                                                                                                    </Grid>
                                                                                                </Paper>
                                                                                            ))}
                                                                                        </Stack>
                                                                                    );
                                                                                })()}
                                                                            </Stack>
                                                                        </Box>
                                                                    )}
                                            {key === 'client_id' && (
                                                <Autocomplete
                                                    size="small"
                                                    fullWidth
                                                    options={clients}
                                                    getOptionLabel={(c)=> [c.first_name,c.middle_name,c.last_name].filter(Boolean).join(' ')}
                                                    isOptionEqualToValue={(a,b)=> a.id===b.id}
                                                    value={clients.find(c=> c.id === formData.client_id) || null}
                                                                                                        onChange={(e,val)=> setFormData((p:any)=> ({ ...p, client_id: val? val.id : '' }))}
                                                    renderInput={(params)=><TextField {...params} label="Client" />}
                                                />
                                            )}
                                            {/* Booking field removed from Policy form */}
                      {(key.includes('date') || ['dob','check_in','check_out','start_date','end_date','departure_date','issue_date','expiry_date'].includes(key)) && !key.endsWith('_id') && (
                        <DatePicker format={DISPLAY_DATE} label={label} value={formData[key] ? dayjs(formData[key]) : null} onChange={(d)=>handleDateChange(key,d)} slotProps={{ textField: { fullWidth:true, size:'small' } }} />
                      )}
                      {key === 'status' && (
                        <FormControl fullWidth size="small">
                          <InputLabel>Status</InputLabel>
                          <Select name="status" label="Status" value={formData.status || ''} onChange={(e)=> setFormData((p:any)=>({...p, status: e.target.value}))}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            <MenuItem value="Confirmed">Confirmed</MenuItem>
                            <MenuItem value="Pending">Pending</MenuItem>
                            <MenuItem value="Cancelled">Cancelled</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                      {!(key === 'client_id' || key === 'booking_id' || key === 'status' || key === 'segments' || key.includes('date') || ['dob','check_in','check_out','start_date','end_date','departure_date','issue_date','expiry_date'].includes(key)) && (
                        <TextField name={key} label={label} size="small" fullWidth value={formData[key] ?? ''} onChange={handleFormChange} multiline={isLong} rows={isLong ? 3 : 1} type={typeof (getFieldsForView(activeView === 'Client Insight' ? 'Clients' : activeView) as any)[key] === 'number' ? 'number' : 'text'} />
                      )}
                    </Grid>
                  );
                })}
              </Grid>
            </DialogContent>
          </LocalizationProvider>
          <DialogActions>
            <Button onClick={handleCloseModal}>Cancel</Button>
            <Button type="submit" variant="contained">{modalMode === 'add' ? 'Add' : 'Update'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    );
  }

  const ConfirmationDialog = () => (
    <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs">
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent><Typography>Are you sure you want to delete this item? This action cannot be undone.</Typography></DialogContent>
        <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={executeDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
    </Dialog>
  );

    const DuplicateClientDialog = () => {
        if (!pendingClientCreate) return null;
        const { matches, payload } = pendingClientCreate;
        const forceCreate = async () => {
            setShowDuplicateDialog(false);
            const tableName = 'clients';
            const { error, data } = await supabase.from(tableName).insert([payload]).select();
            if (error) setError(`Error adding item: ${error.message}`);
            else {
                const inserted = Array.isArray(data) ? data[0] : null;
                logActivity('create', tableName, inserted?.id, { values: payload, duplicate_override: true });
                fetchData(); handleCloseModal(); setSnackbar({ open: true, message: 'Client added (duplicate override).' });
            }
            setPendingClientCreate(null);
        };
        return (
            <Dialog open={showDuplicateDialog} onClose={()=>{ setShowDuplicateDialog(false); setPendingClientCreate(null); }} maxWidth="sm" fullWidth>
                <DialogTitle>Possible Duplicate Client</DialogTitle>
                <DialogContent dividers>
                    <Alert severity="warning" sx={{ mb:2 }}>We found existing clients matching the details you entered. Select one to use instead of creating a new record, or force create anyway.</Alert>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 240 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Phone</TableCell>
                                    <TableCell>DOB</TableCell>
                                    <TableCell align="right">Action</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {matches.map(m => (
                                    <TableRow key={m.id} hover>
                                        <TableCell>{[m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')}</TableCell>
                                        <TableCell>{m.email_id}</TableCell>
                                        <TableCell>{m.mobile_no}</TableCell>
                                        <TableCell>{m.dob ? dayjs(m.dob).format(DISPLAY_DATE) : ''}</TableCell>
                                        <TableCell align="right">
                                            <Button size="small" variant="outlined" onClick={()=>{ setShowDuplicateDialog(false); setPendingClientCreate(null); handleCloseModal(); setSnackbar({ open:true, message: 'Using existing client.'}); }}>
                                                Use
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Box sx={{ mt:2 }}>
                        <Typography variant="body2" color="text.secondary">New client you attempted to add:</Typography>
                        <Typography variant="body2" sx={{ fontStyle:'italic' }}>
                            {[payload.first_name, payload.middle_name, payload.last_name].filter(Boolean).join(' ')} • {payload.email_id || 'No Email'} • {payload.mobile_no || 'No Phone'}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={()=>{ setShowDuplicateDialog(false); setPendingClientCreate(null); }}>Cancel</Button>
                    <Button onClick={forceCreate} color="warning" variant="contained">Create Anyway</Button>
                </DialogActions>
            </Dialog>
        );
    };

  const DocumentUploadModal = ({ onShowSnackbar }: { onShowSnackbar: (state: {open: boolean, message: string}) => void }) => {
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [uploading, setUploading] = useState(false);
    const [docError, setDocError] = useState<string | null>(null);

    const fetchDocuments = useCallback(async () => {
        if (!selectedClientForDocs) return;
        setDocError(null);
        const { data, error } = await supabase.from('client_documents').select('*').eq('client_id', selectedClientForDocs.id).order('created_at', { ascending: false });
        if (error) setDocError(error.message);
        else setDocuments(data || []);
    }, [selectedClientForDocs]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !selectedClientForDocs) return;
        const file = event.target.files[0];
        const filePath = `${selectedClientForDocs.id}/${Date.now()}_${file.name}`;
        
        setUploading(true);
        setDocError(null);

        const { error: uploadError } = await supabase.storage.from('client-documents').upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

        if (uploadError) {
            setDocError(`Upload failed: ${uploadError.message}`);
        } else {
            const { error: dbError } = await supabase.from('client_documents').insert({
                client_id: selectedClientForDocs.id,
                file_name: file.name,
                file_path: filePath,
            });
            if (dbError) setDocError(`Failed to save document record: ${dbError.message}`);
            else { fetchDocuments(); logActivity('upload','client_documents', selectedClientForDocs.id, { file: file.name }); }
        }
        setUploading(false);
    };

    const handleDownloadDoc = (doc: ClientDocument) => {
        if (!doc.file_path) return;
        const { data } = supabase.storage.from('client-documents').getPublicUrl(doc.file_path);
        if (data.publicUrl) {
            window.open(data.publicUrl, '_blank');
        } else {
            onShowSnackbar({ open: true, message: 'Error getting download link.' });
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        const doc = documents.find(d => d.id === docId);
        const fileName = doc?.file_name || '';
        if (!doc) return;
        if (!window.confirm(`Are you sure you want to delete "${fileName}"?`)) return;

        setDocError(null);
        const { error: storageError } = await supabase.storage.from('client-documents').remove([doc.file_path]);
        if (storageError) {
            setDocError(`Failed to delete file from storage: ${storageError.message}`);
            return;
        }
    const { error: dbError } = await supabase.from('client_documents').delete().eq('id', doc.id);
    if (dbError) setDocError(`Failed to delete document record: ${dbError.message}`);
    else { fetchDocuments(); logActivity('delete','client_documents', doc.id, { file: fileName }); }
    }

  const handleViewOrDownload = async (doc: ClientDocument) => {
    setDocError(null);
    try {
        // Use createSignedUrl for private buckets. This creates a temporary, secure URL.
        const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(doc.file_path, 60); // URL is valid for 60 seconds
        
        if (error) {
            setDocError(`Failed to get document URL: ${error.message}`);
            return;
        } else {  
            window.open(data.signedUrl, '_blank');
        }
    } catch (err: any) {
        setDocError(`An unexpected error occurred: ${err.message}`);
    }
};

    return (
        <Dialog open={docModalOpen} onClose={handleCloseDocModal} maxWidth="md" fullWidth>
            <DialogTitle>Documents for {[selectedClientForDocs?.first_name, selectedClientForDocs?.middle_name, selectedClientForDocs?.last_name].filter(Boolean).join(' ')}</DialogTitle>
            <DialogContent dividers>
                {docError && <Alert severity="error" sx={{mb: 2}}>{docError}</Alert>}
                <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                    <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={uploading}>
                        Upload File
                        <input type="file" hidden onChange={handleUpload} />
                    </Button>
                    {uploading && <CircularProgress size={24} />}
                </Stack>
                <List sx={{mt: 2, border: '1px solid #e0e0e0', borderRadius: 1, maxHeight: 300, overflowY: 'auto'}}>
                    {documents.length > 0 ? (
                        documents.map(doc => (
                            <ListItem key={doc.id} secondaryAction={
                                <>
                                    <Tooltip title="View/Download">
                                        <IconButton edge="end" aria-label="view-download" onClick={() => handleViewOrDownload(doc)} sx={{mr: 1}}>
                                            <DescriptionIcon color="primary" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteDoc(doc.id)}>
                                            <DeleteIcon color="error" />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            }>
                                <ListItemIcon><DescriptionIcon /></ListItemIcon>
                                <ListItemText primary={doc.file_name} secondary={`Uploaded: ${dayjs(doc.created_at).format(DISPLAY_DATE_TIME)}`} />
                            </ListItem>
                        ))
                    ) : (
                        <ListItem><ListItemText sx={{ textAlign: 'center', py: 2 }} primary="No documents uploaded for this client." /></ListItem>
                    )}
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseDocModal}>Close</Button>
            </DialogActions>
        </Dialog>
    )
  }

    const RightDrawer = ({ reminders, userReminders, onReminderClick, onTaskEdit }: { reminders: Reminder[]; userReminders: UserReminder[]; onReminderClick: (reminder: Reminder) => void; onTaskEdit: (r: UserReminder) => void; }) => {
    const getReminderIcon = (type: string) => ({ Birthday: <CakeIcon color="secondary" />, Passport: <CreditCardIcon color="error" />, Visa: <VpnKeyIcon color="error" />, Policy: <PolicyIcon color="error" />, Booking: <FlightIcon color="info" /> }[type] || <NotificationsIcon />);
    const getReminderMessage = (r: Reminder) => {
        let message = `${r.type} for ${r.name}`;
                if (r.type.includes('Passport') || r.type.includes('Visa') || r.type.includes('Policy')) {
                        message += ` expiring on ${dayjs(r.expiry_date || r.end_date).format(DISPLAY_DATE)}`;
                        if (r.type === 'Visa' && (r as any).country) {
                            message += ` • Country: ${(r as any).country}`;
                        }
        } else if (r.type === 'Booking') {
            message += ` check-in on ${dayjs(r.departure_date).format(DISPLAY_DATE)}`;
        } else if (r.type === 'Birthday') {
            message += ` on ${dayjs(r.dob).format('DD/MM')}`;
        }
        if (r.days_left !== undefined && r.days_left >= 0) {
            message += ` (${r.days_left === 0 ? 'Today' : `in ${r.days_left} days`}).`;
        } else if (r.days_left !== undefined && r.days_left < 0) {
            message += ` (Expired ${Math.abs(r.days_left)} days ago).`;
        }
        return message;
    };

    const categorizedReminders = useMemo(() => {
      return reminders.reduce((acc, reminder) => {
        acc[reminder.type] = [...(acc[reminder.type] || []), reminder];
        return acc;
      }, {} as Record<string, Reminder[]>);
    }, [reminders]);

    return (
      <Drawer
        variant="permanent"
        anchor="right"
        sx={{
          width: rightDrawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: rightDrawerWidth, boxSizing: 'border-box', pt: '64px', overflowY: 'auto', borderLeft: '1px solid rgba(0,0,0,0.12)' },
          display: { xs: 'none', md: 'block' }
        }}
      >
        <Toolbar sx={{ position: 'absolute', top: 0, right: 0 }} />
        <Box sx={{ p: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Reminders</Typography>
            <NotificationsIcon color="primary" />
          </Box>
                    {Object.keys(categorizedReminders).length > 0 ? (
            Object.entries(categorizedReminders).map(([category, items]) => (
              <Accordion key={category} defaultExpanded={true} elevation={1} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{category} ({items.length})</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 1 }}>
                  {items.map((r, i) => (
                    <Alert key={i} severity={r.days_left! <= 7 && r.days_left! >= 0 ? "error" : r.days_left! < 0 ? "error" : "warning"} icon={getReminderIcon(r.type)} sx={{ mb: 1, cursor: 'pointer', '&:last-child': { mb: 0 } }} onClick={() => onReminderClick(r)}>
                      {getReminderMessage(r)}
                    </Alert>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))
          ) : (
            <Alert severity="success" sx={{mt: 2}}>No upcoming reminders!</Alert>
          )}
                    {/* User personal tasks (open only) */}
                    {userReminders && userReminders.filter(r=> r.status !== 'done' && r.status !== 'cancelled').length > 0 && (
                        <Accordion defaultExpanded elevation={1} sx={{ mt: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}> 
                                <Typography variant="subtitle2" sx={{ fontWeight:'bold' }}>My Tasks ({userReminders.filter(r=> r.status !== 'done' && r.status !== 'cancelled').length})</Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 1 }}>
                                {userReminders.filter(r=> r.status !== 'done' && r.status !== 'cancelled').slice(0,15).map(t => {
                                    const due = t.due_at ? dayjs(t.due_at) : null;
                                    const overdue = due && due.isBefore(dayjs(), 'minute');
                                    return (
                                        <Alert key={t.id} severity={overdue ? 'error':'info'} icon={<CheckCircleIcon fontSize="small" color={overdue? 'error':'success'} />} sx={{ mb:1, cursor:'pointer', '&:last-child':{mb:0} }} onClick={()=> onTaskEdit(t)}>
                                            <Typography variant="body2" component="span" sx={{ fontWeight:600 }}>{t.title}</Typography>{' '}
                                            <Typography variant="caption" component="span">{due ? `• ${overdue? 'Overdue':'Due'} ${due.format(DISPLAY_DATE_TIME)}` : ''}</Typography>
                                        </Alert>
                                    );
                                })}
                            </AccordionDetails>
                        </Accordion>
                    )}
        </Box>
      </Drawer>
    );
  };



    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            {!session ? (
                <AuthComponent setSession={setSession} />
            ) : (
                <Box sx={{ display: 'flex' }}>
                    <CssBaseline />
                    <AppBar position="fixed"
                        sx={{
                            zIndex: (theme) => theme.zIndex.drawer + 1,
                            transition: (theme) => theme.transitions.create(['width','margin'], { duration: theme.transitions.duration.shortest })
                        }}>
                        <Toolbar>
                            <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}><MenuIcon /></IconButton>
                            <Typography variant="h6" noWrap component="div" sx={{flexGrow: 1}}>{activeView}</Typography>
                            {activeView === 'Dashboard' && (
                                <ToggleButtonGroup
                                    exclusive
                                    size="small"
                                    color="secondary"
                                    value={userMetricMode}
                                    onChange={(_e, val) => val && setUserMetricMode(val)}
                                    sx={{ mr: 2, bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 }}
                                >
                                    <ToggleButton value="all" sx={{ color: 'white', '&.Mui-selected': { bgcolor: 'secondary.main', color: 'white' } }}>All Data</ToggleButton>
                                    <ToggleButton value="me" sx={{ color: 'white', '&.Mui-selected': { bgcolor: 'secondary.main', color: 'white' } }}>My Data</ToggleButton>
                                </ToggleButtonGroup>
                            )}
                            <Tooltip title="Profile">
                                <IconButton color="inherit" component={NextLink} href="/profile" sx={{ mr: 1 }}>
                                    <PersonIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title={showReminders ? 'Hide Reminders' : 'Show Reminders'}>
                                <IconButton color="inherit" onClick={() => setShowReminders(o=>!o)}>
                                    <Badge badgeContent={reminders.length} color="error">
                                        <NotificationsIcon />
                                    </Badge>
                                </IconButton>
                            </Tooltip>
                        </Toolbar>
                    </AppBar>
                    <Box component="nav" sx={{ width: { sm: actualLeftWidth }, flexShrink: { sm: 0 } }}>
                        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }}
                            sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}>{drawer}</Drawer>
                        <Drawer variant="permanent" open
                            sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: actualLeftWidth, borderRight: '1px solid rgba(0,0,0,0.12)', overflowX: 'hidden', transition: (theme)=>theme.transitions.create('width',{ duration: theme.transitions.duration.shortest }) } }}>
                                {drawer}
                        </Drawer>
                    </Box>
                                        <Box component="main" 
                                                suppressHydrationWarning
                                                sx={{ 
                                                                flexGrow: 1, 
                                                                p: 3, 
                                                                bgcolor: '#f4f6f8', 
                                                                minHeight: '100vh'
                                                }}>
                                                <Toolbar />
                                                {mounted ? (
                                                    <Container maxWidth="xl" sx={{ pt: 2, pb: 2 }}>
                                                            {renderContent()}
                                                    </Container>
                                                ) : (
                                                    <Container maxWidth="xl" sx={{ pt: 6, display:'flex', justifyContent:'center' }}>
                                                        <CircularProgress />
                                                    </Container>
                                                )}
                                        </Box>
                    {showReminders && <RightDrawer reminders={reminders} userReminders={userReminders} onReminderClick={handleReminderClick} onTaskEdit={(r)=> { setEditingReminder(r); setReminderModalOpen(true); }} />}
                    {openModal && <FormModal />}
                    {docModalOpen && <DocumentUploadModal onShowSnackbar={setSnackbar} />}
                    <ConfirmationDialog />
                    <DuplicateClientDialog />
                    {/* Task / Reminder Modal */}
                    <UserReminderModal 
                        open={reminderModalOpen} 
                        onClose={()=> { setReminderModalOpen(false); setEditingReminder(null); }} 
                        existing={editingReminder} 
                        userId={session?.user.id || ''} 
                        bufferRef={reminderBufferRef}
                        latestRef={latestReminderRef}
                        onSaved={(r)=> { 
                            setReminderModalOpen(false); 
                            setEditingReminder(null); 
                            setUserReminders(list => { 
                                const idx = list.findIndex(x=>x.id===r.id); 
                                return idx>=0 ? list.map(x=> x.id===r.id ? r : x) : [r, ...list]; 
                            }); 
                        }} 
                    />
                    <Snackbar
                        open={snackbar.open}
                        autoHideDuration={6000}
                        onClose={() => setSnackbar({ ...snackbar, open: false })}
                        message={snackbar.message}
                    />
                </Box>
            )}
        </LocalizationProvider>
    );
}

// (ItinerariesView moved to components/ItinerariesView.tsx and dynamically imported)

// --- REUSABLE INSIGHT TABLE COMPONENT ---
const InsightTable = ({ data, columns }: { data: any[], columns: { key: string, label: string, render?: (val: any) => React.ReactNode }[] }) => {
    if (!data || data.length === 0) {
        return <Typography sx={{textAlign: 'center', p: 2, color: 'text.secondary'}}>No data available.</Typography>;
       }
    return (
        <TableContainer component={Paper} elevation={0} sx={{border: '1px solid #eee'}}>
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {columns.map(col => <TableCell key={col.key} sx={{fontWeight: 'bold', bgcolor: 'action.hover'}}>{col.label}</TableCell>)}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map(item => (
                        <TableRow hover key={item.id}>
                            {columns.map(col => (
                                <TableCell key={col.key}>
                                    {col.render ? col.render(item[col.key]) : item[col.key]}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

// --- AUXILIARY TYPES (local) ---
interface ClientNote { id: string; client_id: string; note: string; user?: string; created_at?: string; }
interface ClientDocument { id: string; client_id: string; file_name: string; file_path: string; created_at?: string; }
interface TripSegment { origin: string; destination: string; departure_date: string; airline?: string; }

// --- SIMPLE AUTH COMPONENT ---
const AuthComponent = ({ setSession }: { setSession: (s: Session | null) => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) setError(error.message); else setSession(data.session);
        setLoading(false);
    };

    return (
        <Container maxWidth="xs" sx={{ mt: 12 }}>
            <Paper sx={{ p: 4, borderRadius: 2 }}>
                <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>Sign In</Typography>
                <form onSubmit={handleLogin}>
                    <Stack spacing={2}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField label="Email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required fullWidth />
                        <TextField label="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required fullWidth />
                        <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</Button>
                    </Stack>
                </form>
            </Paper>
        </Container>
    );
};

// --- CLIENT DOCUMENTS VIEW (FOR INSIGHT PAGE) ---
const ClientDocumentsView = ({ client, onUpdate, onShowSnackbar }: { client: Client, onUpdate: () => void, onShowSnackbar: (state: {open: boolean, message: string}) => void }) => {
    const [documents, setDocuments] = useState<ClientDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const fetchDocuments = useCallback(async () => {
        if (!client) return;
        setLoading(true);
        const { data, error } = await supabase.from('client_documents').select('*').eq('client_id', client.id).order('created_at', { ascending: false });
        if (error) onShowSnackbar({ open: true, message: `Error fetching documents: ${error.message}` });
        else setDocuments(data || []);
        setLoading(false);
    }, [client, onShowSnackbar]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0 || !client) return;
        const file = event.target.files[0];
        const filePath = `${client.id}/${Date.now()}_${file.name}`;
        
        setUploading(true);
        onShowSnackbar({ open: true, message: 'Uploading document...' });
        const { error: uploadError } = await supabase.storage.from('client-documents').upload(filePath, file);

        if (uploadError) {
            onShowSnackbar({ open: true, message: `Upload failed: ${uploadError.message}` });
        } else {
            const { error: dbError } = await supabase.from('client_documents').insert({ client_id: client.id, file_name: file.name, file_path: filePath });
            if (dbError) onShowSnackbar({ open: true, message: `Failed to save document record: ${dbError.message}` });
            else { onShowSnackbar({ open: true, message: 'Document uploaded!' }); fetchDocuments(); }
        }
        setUploading(false);
    };

    const handleDownloadDoc = (doc: ClientDocument) => {
        if (!doc.file_path) return;
        const { data } = supabase.storage.from('client-documents').getPublicUrl(doc.file_path);
        if (data.publicUrl) {
            window.open(data.publicUrl, '_blank');
        } else {
            onShowSnackbar({ open: true, message: 'Error getting download link.' });
        }
    };

    const handleDeleteDoc = async (docId: string) => {
        const doc = documents.find(d => d.id === docId);
        if (!doc) return;
        if (!window.confirm(`Are you sure you want to delete "${doc.file_name}"?`)) return;

        const { error: storageError } = await supabase.storage.from('client-documents').remove([doc.file_path]);
        if (storageError) {
            onShowSnackbar({ open: true, message: `Failed to delete file from storage: ${storageError.message}` });
            return;
        }
        const { error: dbError } = await supabase.from('client_documents').delete().eq('id', doc.id);
        if (dbError) onShowSnackbar({ open: true, message: `Failed to delete document record: ${dbError.message}` });
        else {
            onShowSnackbar({ open: true, message: 'Document deleted successfully!' });
            fetchDocuments();
        }
    }

  const handleViewOrDownload = async (doc: ClientDocument) => {
    try {
        // Use createSignedUrl for private buckets. This creates a temporary, secure URL.
        const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(doc.file_path, 60); // URL is valid for 60 seconds
        
        if (error) {
            onShowSnackbar({ open: true, message: `Failed to get document URL: ${error.message}` });
            return;
        } else {  
            window.open(data.signedUrl, '_blank');
        }
    } catch (err: any) {
        onShowSnackbar({ open: true, message: `An unexpected error occurred: ${err.message}` });
    }
};

    if (loading) return <CircularProgress />;

    return (
        <Box>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Button variant="contained" component="label" startIcon={<UploadFileIcon />} disabled={uploading}>
                    Upload File
                    <input type="file" hidden onChange={handleUpload} />
                </Button>
                {uploading && <CircularProgress size={24} />}
            </Stack>
            <List>
                {documents.length > 0 ? documents.map(doc => (
                    <ListItem key={doc.id} divider secondaryAction={
                        <>
                            <Tooltip title="View/Download"><IconButton onClick={() => handleDownloadDoc(doc)}><VisibilityIcon color="primary" /></IconButton></Tooltip>
                            <Tooltip title="Delete"><IconButton onClick={() => handleDeleteDoc(doc.id)}><DeleteIcon color="error" /></IconButton></Tooltip>
                        </>
                    }>
                        <ListItemIcon><DescriptionIcon /></ListItemIcon>
                        <ListItemText primary={doc.file_name} secondary={`Uploaded: ${dayjs(doc.created_at).format(DISPLAY_DATE)}`} />
                    </ListItem>
                )) : <ListItem><ListItemText primary="No documents found." sx={{color: 'text.secondary'}} /></ListItem>}
            </List>
        </Box>
    );
}

// --- CLIENT INSIGHT VIEW ---
const ClientInsightView = ({ allClients, allBookings, allVisas, allPassports, allPolicies, allNotes, globalReminders, onUpdate, onShowSnackbar, onOpenModal, onDeleteItem }: {
    allClients: Client[], allBookings: Booking[], allVisas: Visa[], allPassports: Passport[], allPolicies: Policy[], allNotes: ClientNote[], globalReminders: Reminder[],
    onUpdate: () => void, onShowSnackbar: (state: { open: boolean, message: string}) => void,
    onOpenModal: (mode: 'add' | 'edit', item: unknown, overrideView?: string) => void,
    onDeleteItem: (id: string, view: string) => void
}) => {
    // Local activity logger (cannot access DashboardPage scoped helper)
    const logActivity = async (action: string, entity: string, entityId?: string, meta?: any) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) return;
            await supabase.from('user_activity').insert({ user_id: userId, action, entity_type: entity, entity_id: entityId, meta });
        } catch {}
    };
    const [insightSearchTerm, setInsightSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientData, setClientData] = useState<any>({ bookings: [], visas: [], passports: [], policies: [], notes: [], reminders: [] });
    const [tabValue, setTabValue] = useState(0);
    const [newNote, setNewNote] = useState('');
    const [searchResults, setSearchResults] = useState<Client[]>([]);
    const [showDetails, setShowDetails] = useState(false); // toggle for detailed fields

    const handleSearch = () => {
        const raw = insightSearchTerm.trim();
        if (!raw) {
            setSelectedClient(null);
            setSearchResults([]);
            return;
        }
        const term = raw.toLowerCase();
        const tokens = term.split(/\s+/).filter(Boolean); // multi-word support

        const matches = (c: Client) => {
            const first = (c.first_name || '').toLowerCase();
            const middle = (c.middle_name || '').toLowerCase();
            const last = (c.last_name || '').toLowerCase();
            const email = (c.email_id || '').toLowerCase();
            const phone = (c.mobile_no || '').toLowerCase();
            const nationality = (c.nationality || '').toLowerCase();
            const fullName = [first, middle, last].filter(Boolean).join(' ').trim();
            const haystacks = [first, middle, last, fullName, email, phone, nationality];
            // Every token must appear in at least one haystack (AND across tokens / OR across fields)
            return tokens.every(t => haystacks.some(h => h.includes(t)));
        };

        const results = allClients.filter(matches);
        setSearchResults(results);
        setSelectedClient(results.length === 1 ? results[0] : null);
    };

    useEffect(() => {
        if (selectedClient) {
            setClientData({
                bookings: allBookings.filter(b => b.client_id === selectedClient.id),
                visas: allVisas.filter(v => v.client_id === selectedClient.id),
                passports: allPassports.filter(p => p.client_id === selectedClient.id),
                policies: allPolicies.filter(po => po.client_id === selectedClient.id),
                notes: allNotes.filter(n => n.client_id === selectedClient.id),
                reminders: globalReminders.filter(r => r.client_id === selectedClient.id)
            });
        } else {
            setClientData({ bookings: [], visas: [], passports: [], policies: [], notes: [], reminders: [] });
        }
    }, [selectedClient, allBookings, allVisas, allPassports, allPolicies, allNotes, globalReminders]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !selectedClient) return;
        const { error } = await supabase.from('client_notes').insert({
            client_id: selectedClient.id,
            note: newNote,
            user: 'Admin' // Replace with actual user later
        });
        if (error) {
            onShowSnackbar({ open: true, message: `Error adding note: ${error.message}` });
        } else {
            onShowSnackbar({ open: true, message: 'Note added successfully!' });
            setNewNote('');
            onUpdate(); // Re-fetch all data
            logActivity('create','client_notes', selectedClient.id, { note: newNote.slice(0,120) });
        }
    };
    
    const handleDeleteNote = async (noteId: string) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;
        const { error } = await supabase.from('client_notes').delete().eq('id', noteId);
        if (error) {
            onShowSnackbar({ open: true, message: `Error deleting note: ${error.message}` });
        } else {
            onShowSnackbar({ open: true, message: 'Note deleted successfully!' });
            onUpdate(); // Re-fetch all data
            logActivity('delete','client_notes', noteId);
        }
    };

    const [isNoteEditModalOpen, setIsNoteEditModalOpen] = useState(false);
    const [noteToEdit, setNoteToEdit] = useState<ClientNote | null>(null);
    const latestEditedNoteRef = useRef<{ content?: string }>({});

    const handleOpenNoteEditModal = (note: ClientNote) => {
        setNoteToEdit(note);
        setIsNoteEditModalOpen(true);
    };

    const handleCloseNoteEditModal = () => {
        setIsNoteEditModalOpen(false);
        setNoteToEdit(null);
    };

    const handleUpdateNote = async (noteId: string, updatedNoteContent: string) => {
        const { error } = await supabase.from('client_notes').update({ note: updatedNoteContent }).eq('id', noteId);
        if (error) {
            onShowSnackbar({ open: true, message: `Error updating note: ${error.message}` });
        } else {
            onShowSnackbar({ open: true, message: 'Note updated successfully!' });
            handleCloseNoteEditModal();
            onUpdate(); // Re-fetch all data
            logActivity('update','client_notes', noteId);
        }
    };

    const handleDownloadPdf = () => {
        if (!selectedClient) return;
        try {
            onShowSnackbar({ open:true, message:'Building PDF...' });
            const pdf = new jsPDF('p','mm','a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 12;
            const primary = '#2bcba8';
            const primaryDark = '#178f77';
            const header = () => {
                pdf.setFillColor(43,203,168); pdf.rect(0,0,pageWidth,18,'F');
                pdf.setFont('helvetica','bold'); pdf.setFontSize(14); pdf.setTextColor('#04352c');
                pdf.text('Client Insight', margin, 12);
            };
            const footer = (page: number) => { pdf.setFontSize(9); pdf.setTextColor(primaryDark); pdf.text(`Page ${page}`, pageWidth - margin - 20, pageHeight - 6); pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), margin, pageHeight - 6); };
            let page = 1; header(); footer(page);
            let y = 26;
            const ensureSpace = (needed = 20) => { if (y > pageHeight - needed) { pdf.addPage(); header(); footer(++page); y = 26; } };
            const section = (title: string) => { ensureSpace(); pdf.setFillColor(217,246,239); pdf.roundedRect(margin, y-4, pageWidth - margin*2, 8, 2,2,'F'); pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(primaryDark); pdf.text(title, margin+2, y+1); y += 7; pdf.setFont('helvetica','normal'); pdf.setFontSize(10); pdf.setTextColor('#094f43'); };
            const line = (t: string) => { const parts = pdf.splitTextToSize(t, pageWidth - margin*2) as string[]; parts.forEach(pt => { ensureSpace(15); pdf.text(pt, margin, y); y += 4; }); };
            // Basic info
            section('Client');
            line(`Name: ${selectedClient.first_name||''} ${selectedClient.last_name||''}`);
            const scAny: any = selectedClient as any;
            if (scAny.email) line(`Email: ${scAny.email}`);
            if (scAny.phone) line(`Phone: ${scAny.phone}`);
            if ((selectedClient as any).date_of_birth) line(`DOB: ${dayjs((selectedClient as any).date_of_birth).isValid() ? dayjs((selectedClient as any).date_of_birth).format(DISPLAY_DATE) : (selectedClient as any).date_of_birth}`);
            // Summary analytics
            const bookings = clientData.bookings||[]; const policies = clientData.policies||[]; const visas = clientData.visas||[]; const passports = clientData.passports||[];
            const visaSpend = visas.reduce((s: number,v:any)=> s + (Number(v.amount)||0),0);
            const passportSpend = passports.reduce((s: number,v:any)=> s + (Number(v.amount)||0),0);
            const totalSpend = bookings.reduce((s:number,b:any)=> s + (Number(b.amount)||0),0) + policies.reduce((s:number,p:any)=> s + (Number(p.premium_amount)||0),0) + visaSpend + passportSpend;
            const numTrips = bookings.length; const avgSpend = numTrips ? totalSpend / numTrips : 0;
            section('Summary');
            line(`Total Spend: Rs ${totalSpend.toFixed(2)}`);
            line(`Trips: ${numTrips}`);
            line(`Average Spend / Trip: Rs ${avgSpend.toFixed(2)}`);
            // Bookings detail
            if (bookings.length) {
                section(`Bookings (${bookings.length})`);
                bookings.forEach((b:any, idx:number) => { ensureSpace(); line(`${idx+1}. ${b.reference||'Ref'} | ${b.destination||'Destination'} | ${b.amount ? 'Rs '+Number(b.amount).toFixed(2):'0.00'} | ${b.start_date ? dayjs(b.start_date).format(DISPLAY_DATE):''}`); });
            }
            if (visas.length) {
                section(`Visas (${visas.length})`); visas.forEach((v:any,i:number)=> line(`${i+1}. ${v.country||'Country'} | Rs ${Number(v.amount||0).toFixed(2)} | ${v.status||''}`));
            }
            if (passports.length) {
                section(`Passports (${passports.length})`); passports.forEach((p:any,i:number)=> line(`${i+1}. ${p.passport_number||'Passport'} | Rs ${Number(p.amount||0).toFixed(2)} | ${p.status||''}`));
            }
            if (policies.length) {
                section(`Policies (${policies.length})`); policies.forEach((p:any,i:number)=> line(`${i+1}. ${p.policy_number||'Policy'} | Rs ${Number(p.premium_amount||0).toFixed(2)} | ${p.status||''}`));
            }
            // Notes
            if ((clientData.notes||[]).length) {
                section(`Notes (${clientData.notes.length})`);
                clientData.notes.slice(0,40).forEach((n:any,i:number)=> line(`${i+1}. ${dayjs(n.created_at).format(DISPLAY_DATE_TIME)} - ${n.note?.slice(0,140)}`));
            }
            pdf.save(`client-insight-${selectedClient.first_name||''}-${selectedClient.last_name||''}.pdf`);
            onShowSnackbar({ open:true, message:'PDF downloaded' });
        } catch (err:any) {
            onShowSnackbar({ open:true, message:`PDF failed: ${err.message||err}` });
        }
    };

    const analytics = useMemo(() => {
        if (!selectedClient) return { totalSpend: 0, numTrips: 0, avgSpend: 0, destinations: [] };
        const bookings = clientData.bookings;
        const policies = clientData.policies;
        const visas = clientData.visas;
        const passports = clientData.passports;
        const visaSpend = visas.reduce((s: number, v: any)=> s + (Number(v.amount)||0),0);
        const passportSpend = passports.reduce((s: number, p: any)=> s + (Number(p.amount)||0),0);
        const totalSpend = bookings.reduce((sum: any, b: { amount: any; }) => sum + (b.amount || 0), 0) + policies.reduce((sum: any, p: { premium_amount: any; }) => sum + (p.premium_amount || 0), 0) + visaSpend + passportSpend;
        const numTrips = bookings.length;
        const avgSpend = numTrips > 0 ? totalSpend / numTrips : 0;
        const destinationCounts = bookings.reduce((acc: { [x: string]: any; }, b: { destination: string | number; }) => {
            if(b.destination) acc[b.destination] = (acc[b.destination] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        const popularDestination = Object.keys(destinationCounts).length > 0 
            ? Object.keys(destinationCounts).reduce((a, b) => destinationCounts[a] > destinationCounts[b] ? a : b)
            : 'N/A';

        return {
            totalSpend,
            numTrips,
            avgSpend,
            popularDestination,
        };
    }, [selectedClient, clientData]);
    
    const getReminderIcon = (type: string) => ({ Birthday: <CakeIcon color="secondary" />, Passport: <CreditCardIcon color="error" />, Visa: <VpnKeyIcon color="error" />, Policy: <PolicyIcon color="error" />, Booking: <FlightIcon color="info" /> }[type] || <NotificationsIcon />);

    const bookingCols = [ {key: 'pnr', label: 'PNR'}, {key: 'destination', label: 'Destination'}, {key: 'check_in', label: 'Check-in', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, {key: 'check_out', label: 'Check-out', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, {key: 'amount', label: 'Amount', render: (val: number) => formatCurrency(val) }, {key: 'status', label: 'Status'}, ];
    const visaCols = [ {key: 'country', label: 'Country'}, {key: 'visa_type', label: 'Type'}, {key: 'visa_number', label: 'Number'}, {key: 'amount', label: 'Amount', render: (val: number)=> formatCurrency(val) }, {key: 'issue_date', label: 'Issue Date', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, {key: 'expiry_date', label: 'Expiry Date', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, ];
    const passportCols = [ {key: 'passport_number', label: 'Number'}, {key: 'amount', label: 'Amount', render: (val: number)=> formatCurrency(val) }, {key: 'issue_date', label: 'Issue Date', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, {key: 'expiry_date', label: 'Expiry Date', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, ];
    const policyCols = [ {key: 'policy_number', label: 'Number'}, {key: 'insurer', label: 'Insurer'}, {key: 'sum_insured', label: 'Sum Insured', render: (val: number) => formatCurrency(val)}, {key: 'premium_amount', label: 'Premium', render: (val: number) => formatCurrency(val)}, {key: 'start_date', label: 'Start', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, {key: 'end_date', label: 'End', render: (val: string) => dayjs(val).format(DISPLAY_DATE)}, ];

    // Department detail dialog state
    const [deptDialogOpen, setDeptDialogOpen] = useState(false);
    const [deptType, setDeptType] = useState<'Bookings' | 'Visas' | 'Passports' | 'Policies' | null>(null);
    const openDeptDialog = (type: 'Bookings' | 'Visas' | 'Passports' | 'Policies') => { setDeptType(type); setDeptDialogOpen(true); };
    const closeDeptDialog = () => { setDeptDialogOpen(false); setDeptType(null); };
    const deptConfig = useMemo(()=> ({
        'Bookings': { data: clientData.bookings, columns: bookingCols, view: 'Bookings' },
        'Visas': { data: clientData.visas, columns: visaCols, view: 'Visas' },
        'Passports': { data: clientData.passports, columns: passportCols, view: 'Passports' },
        'Policies': { data: clientData.policies, columns: policyCols, view: 'Policies' },
    } as const), [clientData, bookingCols, visaCols, passportCols, policyCols]);

    // Detailed record view state
    const [recordDetailOpen, setRecordDetailOpen] = useState(false);
    const [recordDetail, setRecordDetail] = useState<any | null>(null);
    const openRecordDetail = (row: any) => { setRecordDetail(row); setRecordDetailOpen(true); };
    const closeRecordDetail = () => { setRecordDetailOpen(false); setRecordDetail(null); };
    const copyRecordJson = () => { if(recordDetail){ navigator.clipboard.writeText(JSON.stringify(recordDetail, null, 2)); onShowSnackbar({ open:true, message: 'Copied record JSON'}); } };
    const formatFieldValue = (key: string, val: any) => {
        if (val == null || val === '') return '—';
        if (typeof val === 'number') return key.toLowerCase().includes('amount') ? formatCurrency(val) : val;
        if (typeof val === 'string') {
            if (/date|_at|issued|expiry|start|end|check_in|check_out/i.test(key) && dayjs(val).isValid()) {
                return dayjs(val).format(DISPLAY_DATE_TIME);
            }
            return val;
        }
        if (Array.isArray(val)) return `${val.length} item(s)`;
        if (typeof val === 'object') return '[object]';
        return String(val);
    };

    return (
        <Fade in={true}>
            <Box>
                <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: 2, boxShadow: 1 }}>
                    <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center', borderRadius: 2 }}>
                        <TextField
                            label="Search Client by Name, Email, or Phone"
                            variant="outlined"
                            fullWidth
                            value={insightSearchTerm}
                            onChange={e => setInsightSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }}
                        />
                        <Button variant="contained" onClick={handleSearch} startIcon={<SearchIcon />} sx={{height: '56px'}}>Search</Button>
                    </Paper>
                </Box>

                {searchResults.length > 0 && (
                        <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>{searchResults.length} result{searchResults.length > 1 ? 's' : ''}</Typography>
                            <List sx={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #eee', borderRadius: 1 }}>
                                {searchResults.map((c) => (
                                    <ListItem key={c.id} disablePadding divider selected={selectedClient?.id === c.id}>
                                        <ListItemButton onClick={() => setSelectedClient(c)}>
                                            <ListItemIcon><Avatar>{(c.first_name && c.first_name[0]) || '?'}</Avatar></ListItemIcon>
                                            <ListItemText primary={[c.first_name,c.middle_name,c.last_name].filter(Boolean).join(' ')} secondary={`${c.email_id} • ${c.mobile_no}`} />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                        
                    )}

                    {!selectedClient && searchResults.length === 0 && (
                        <Paper sx={{p: 4, textAlign: 'center', borderRadius: 2}}>
                            <AccountBoxIcon sx={{fontSize: 60, color: 'text.secondary', mb: 2}} />
                            <Typography variant="h6" color="text.secondary">Search for a client to see their insights.</Typography>
                        </Paper>
                    )}

                    {selectedClient && (
                        <Box id="insight-content">
                            <Grid container spacing={3}>
                                {/* Client Summary Card */}
                                <Grid item xs={12}>
                                    <Paper elevation={3} sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3, borderRadius: 2 }}>
                                        <Avatar sx={{ width: 90, height: 90, bgcolor: 'primary.main', fontSize: '2.5rem' }}>{(selectedClient?.first_name||selectedClient?.last_name||'?')[0]}</Avatar>
                                        <Box flexGrow={1}>
                                            <Typography variant="h4" component="div" sx={{fontWeight: 'bold', mb: 0.5}}>
                                                {[selectedClient?.first_name, selectedClient?.middle_name, selectedClient?.last_name].filter(Boolean).join(' ')}
                                            </Typography>
                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                                                <Chip icon={<EmailIcon fontSize="small" />} label={selectedClient?.email_id ?? ''} size="small" />
                                                <Chip icon={<PhoneIcon fontSize="small" />} label={selectedClient?.mobile_no ?? ''} size="small" />
                                                <Chip icon={<CakeIcon fontSize="small" />} label={`DOB: ${selectedClient?.dob && dayjs(selectedClient?.dob).isValid() ? dayjs(selectedClient?.dob).format(DISPLAY_DATE) : 'N/A'}`} size="small" />
                                                <Chip label={`Nationality: ${selectedClient?.nationality ?? 'N/A'}`} size="small" />
                                            </Stack>
                                            {/* --- Added Detailed Client Info Grid --- */}
                                            <Box sx={{ mt: 2 }}>
                                              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                                <Button size="small" variant="outlined" onClick={() => setShowDetails(s=>!s)} startIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}>{showDetails ? 'Hide Details' : 'Show Details'}</Button>
                                              </Stack>
                                              <Collapse in={showDetails} timeout="auto" unmountOnExit>
                                                <Grid container spacing={1}>
                                                  {(() => {
                                                    if (!selectedClient) return null;
                                                    const client = selectedClient!; // safe after the early return
                                                    const age = dayjs(client.dob).isValid() ? dayjs().diff(client.dob, 'year') : 'N/A';
                                                    const details: { label: string; value: any }[] = [
                                                      { label: 'First Name', value: client.first_name },
                                                      ...(client.middle_name ? [{ label: 'Middle Name', value: client.middle_name }] : []),
                                                      { label: 'Last Name', value: client.last_name },
                                                      { label: 'Email', value: client.email_id },
                                                      { label: 'Phone', value: client.mobile_no },
                                                      { label: 'DOB', value: dayjs(client.dob).isValid() ? dayjs(client.dob).format(DISPLAY_DATE) : 'N/A' },
                                                      { label: 'Age', value: age },
                                                      { label: 'Nationality', value: client.nationality },
                                                      { label: 'Total Bookings', value: clientData.bookings.length },
                                                      { label: 'Total Visas', value: clientData.visas.length },
                                                      { label: 'Total Passports', value: clientData.passports.length },
                                                      { label: 'Total Policies', value: clientData.policies.length },
                                                      { label: 'Total Spend', value: formatCurrency(analytics.totalSpend) },
                                                      { label: 'Avg Spend / Trip', value: formatCurrency(analytics.avgSpend) },
                                                      { label: 'Popular Destination', value: analytics.popularDestination },
                                                    ];
                                                    return details.map(d => (
                                                      <Grid item xs={12} sm={6} md={4} key={d.label}>
                                                        <Paper variant="outlined" sx={{ p: 1, borderRadius: 1, bgcolor: 'background.default' }}>
                                                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>{d.label}</Typography>
                                                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.value ?? '—'}</Typography>
                                                        </Paper>
                                                      </Grid>
                                                    ))
                                                  })()}
                                                </Grid>
                                              </Collapse>
                                            </Box>
                                            {/* --- end toggle section --- */}
                                        </Box>
                                        <Stack direction="row" spacing={1} sx={{alignSelf: 'flex-start'}}>
                                            <Tooltip title="Edit Client Details">
                                                <Button variant="outlined" startIcon={<EditIcon />} onClick={() => onOpenModal('edit', selectedClient, 'Clients')}>Edit</Button>
                                            </Tooltip>
                                            <Tooltip title="Delete Client">
                                                <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => onDeleteItem(selectedClient.id, 'Clients')}>Delete</Button>
                                            </Tooltip>
                                            <Tooltip title="Download Client Report (PDF)">
                                                <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadPdf}>PDF Report</Button>
                                            </Tooltip>
                                        </Stack>
                                    </Paper>
                                </Grid>
                                
                                {/* Analytics Section */}
                                <Grid item xs={12} md={6}>
                                    <Paper elevation={3} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Client Analytics</Typography>
                                        <Stack spacing={2} sx={{ mt: 2 }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body1">Total Bookings:</Typography>
                                                <Typography variant="h6" color="primary.main">{analytics.numTrips}</Typography>
                                            </Box>
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body1">Total Spend:</Typography>
                                                <Typography variant="h6" color="primary.main">{formatCurrency(analytics.totalSpend)}</Typography>
                                            </Box>
                                            <Box display="flex" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body1">Average Spend per Trip:</Typography>
                                                <Typography variant="h6" color="primary.main">{formatCurrency(analytics.avgSpend)}</Typography>
                                            </Box>
                                        </Stack>
                                        {/* Department summary clickable boxes */}
                                        <Box sx={{ mt:3 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight:'bold', mb:1 }}>Departments</Typography>
                                            <Grid container spacing={1}>
                                                {([
                                                    { key:'Bookings', count: clientData.bookings.length, color:'primary.main' },
                                                    { key:'Visas', count: clientData.visas.length, color:'warning.main' },
                                                    { key:'Passports', count: clientData.passports.length, color:'info.main' },
                                                    { key:'Policies', count: clientData.policies.length, color:'success.main' },
                                                ] as { key: 'Bookings' | 'Visas' | 'Passports' | 'Policies'; count:number; color:string }[]).map(d => (
                                                    <Grid item xs={6} sm={6} md={6} key={d.key}>
                                                        <Paper role="button" aria-label={`View ${d.key} details`} tabIndex={0} onClick={()=> openDeptDialog(d.key)} onKeyDown={(e)=> { if(e.key==='Enter') openDeptDialog(d.key); }} elevation={1} sx={{ p:1.2, borderRadius:1, cursor:'pointer', '&:hover': { boxShadow: 3 } }}>
                                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight:500 }}>{d.key}</Typography>
                                                            <Typography variant="subtitle1" sx={{ fontWeight:700, color: d.color }}>{d.count}</Typography>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </Box>
                                        <Box sx={{mt: 3, height: 200}}>
                                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>Top Destinations</Typography>
                                            <ResponsiveContainer width="100%" height="90%">
                                                <BarChart data={analytics.destinations} layout="vertical" margin={{ left: 50, right: 10 }}>
                                                    <YAxis type="category" dataKey="name" width={80} style={{fontSize: '0.8rem'}} />
                                                    <XAxis type="number" allowDecimals={false} />
                                                    <RechartsTooltip />
                                                    <Bar dataKey="Trips" fill="#82ca9d" radius={[4, 4, 0, 0]} barSize={20} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </Box>
                                    </Paper>
                                </Grid>

                                {/* Reminders Section */}
                                <Grid item xs={12} md={6}>
                                    <Paper elevation={3} sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Client Reminders</Typography>
                                        <List>
                                            {clientData.reminders.length > 0 ? (
                                                clientData.reminders.map((r: Reminder, index: number) => (
                                                    <ListItem key={index} divider sx={{ alignItems: 'flex-start' }}>
                                                        <ListItemIcon sx={{ minWidth: '40px', mt: 0.5 }}>{getReminderIcon(r.type)}</ListItemIcon>
                                                        <ListItemText
                                                            primary={<Typography variant="body1" sx={{fontWeight: 'medium'}}>{r.type} for {r.name}</Typography>}
                                                            secondary={
                                                                <>
                                                                    {r.type.includes('Passport') || r.type.includes('Visa') || r.type.includes('Policy') ? 
                                                                        `Expires: ${dayjs(r.expiry_date || r.end_date).format(DISPLAY_DATE)}${r.type === 'Visa' && (r as any).country ? ` • Country: ${(r as any).country}` : ''}` : ''}
                                                                    {r.type === 'Booking' ? `Departure: ${dayjs(r.departure_date).format(DISPLAY_DATE)}` : ''}
                                                                    {r.type === 'Birthday' ? `Birthday: ${dayjs(r.dob).format('DD/MM')}` : ''}
                                                                    {r.days_left !== undefined && r.days_left >= 0 && 
                                                                        <Typography component="span" variant="body2" sx={{ display: 'block' }} color={r.days_left <= 7 ? "error.main" : "warning.main"}>
                                                                            {r.days_left === 0 ? 'Due Today' : `In ${r.days_left} days`}
                                                                        </Typography>
                                                                    }
                                                                    {r.days_left !== undefined && r.days_left < 0 && 
                                                                        <Typography component="span" variant="body2" sx={{ display: 'block' }} color="error.main" >
                                                                            Expired {Math.abs(r.days_left)} days ago
                                                                        </Typography>
                                                                    }
                                                                </>
                                                            }
                                                        />
                                                    </ListItem>
                                                ))
                                            ) : (
                                                <ListItem><ListItemText primary="No specific reminders for this client." sx={{color: 'text.secondary'}} /></ListItem>
                                            )}
                                        </List>
                                    </Paper>
                                </Grid>


                                {/* Main Details Tabs */}
                                <Grid item xs={12}>
                                    <Paper elevation={3} sx={{ mt: 0, p: 2, borderRadius: 2 }}>
                                        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)} indicatorColor="primary" textColor="primary" variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{borderBottom: 1, borderColor: 'divider'}}>
                                            <Tab label={`Bookings (${clientData.bookings.length})`} />
                                            <Tab label={`Visas (${clientData.visas.length})`} />
                                            <Tab label={`Passports (${clientData.passports.length})`} />
                                            <Tab label={`Policies (${clientData.policies.length})`} />
                                            <Tab label="Documents" />
                                            <Tab label={`Notes (${clientData.notes.length})`} />
                                        </Tabs>
                                        <Box sx={{pt: 2}}> {/* Removed extra padding around content inside tabs */}
                                            {tabValue === 0 && <InsightTable data={clientData.bookings} columns={bookingCols} />}
                                            {tabValue === 1 && <InsightTable data={clientData.visas} columns={visaCols} />}
                                            {tabValue === 2 && <InsightTable data={clientData.passports} columns={passportCols} />}
                                            {tabValue === 3 && <InsightTable data={clientData.policies} columns={policyCols} />}
                                            {tabValue === 4 && <ClientDocumentsView client={selectedClient} onUpdate={onUpdate} onShowSnackbar={onShowSnackbar} />}
                                            {tabValue === 5 && (
                                                <Box>
                                                    <List sx={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #eee', borderRadius: 1, mb: 2 }}>
                                                        {clientData.notes.length > 0 ? (
                                                            clientData.notes.map((note: ClientNote) => (
                                                                <ListItem key={note.id} divider secondaryAction={
                                                                    <>
                                                                        <Tooltip title="Edit Note">
                                                                            <IconButton edge="end" aria-label="edit-note" onClick={() => handleOpenNoteEditModal(note)}>
                                                                                <EditIcon color="info" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                        <Tooltip title="Delete Note">
                                                                            <IconButton edge="end" aria-label="delete-note" onClick={() => handleDeleteNote(note.id)}>
                                                                                <DeleteIcon color="error" />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    </>
                                                                }>
                                                                    <ListItemText primary={note.note} secondary={`By ${note.user} on ${dayjs(note.created_at).format(DISPLAY_DATE_TIME)}`} />
                                                                </ListItem>
                                                            ))
                                                        ) : (
                                                            <ListItem><ListItemText primary="No notes for this client." sx={{color: 'text.secondary'}} /></ListItem>
                                                        )}
                                                    </List>
                                                    <TextField label="Add a new note" fullWidth multiline rows={3} value={newNote} onChange={e => setNewNote(e.target.value)} sx={{mt: 0}} variant="outlined" />
                                                    <Button variant="contained" onClick={handleAddNote} sx={{mt: 2}}>Add Note</Button>
                                                </Box>
                                            )}
                                        </Box>
                                    </Paper>
                                </Grid>
                            </Grid>
                    {/* Note Edit Modal */}
                    {isNoteEditModalOpen && noteToEdit && (
                        <NoteEditModal
                            open={isNoteEditModalOpen}
                            onClose={handleCloseNoteEditModal}
                            note={noteToEdit}
                            latestRef={latestEditedNoteRef}
                            onSave={handleUpdateNote}
                        />
                    )}
                    {/* Department Detail Dialog */}
                    <Dialog open={deptDialogOpen} onClose={closeDeptDialog} fullWidth maxWidth="md">
                        <DialogTitle>{deptType ? `${deptType} Details` : 'Details'}</DialogTitle>
                        <DialogContent dividers>
                            {deptType && (()=> {
                                const cfg = deptConfig[deptType];
                                const rows = cfg.data as any[];
                                const cols = cfg.columns as { key: string; label: string; render?: (val:any)=>React.ReactNode }[];
                                if (!rows.length) return <Alert severity="info">No {deptType.toLowerCase()} found.</Alert>;
                                return (
                                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
                                        <Table size="small" stickyHeader>
                                            <TableHead>
                                                <TableRow>
                                                    {cols.map(c => <TableCell key={c.key}>{c.label}</TableCell>)}
                                                    <TableCell>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {rows.map(r => (
                                                    <TableRow key={r.id} hover>
                                                        {cols.map(c => <TableCell key={c.key}>{c.render ? c.render((r as any)[c.key]) : (r as any)[c.key] ?? '—'}</TableCell>)}
                                                        <TableCell>
                                                            <Stack direction="row" spacing={1}>
                                                                <Tooltip title="View Details"><IconButton size="small" onClick={()=> openRecordDetail(r)}><InfoIcon fontSize="small" color="primary" /></IconButton></Tooltip>
                                                                <Tooltip title="Edit"><IconButton size="small" onClick={()=> { onOpenModal('edit', r, cfg.view); closeDeptDialog(); }}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                                                <Tooltip title="Delete"><IconButton size="small" onClick={()=> { onDeleteItem(r.id, cfg.view); }}><DeleteIcon fontSize="small" color="error" /></IconButton></Tooltip>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                );
                            })()}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={closeDeptDialog}>Close</Button>
                        </DialogActions>
                    </Dialog>
                    {/* Record Detail Dialog */}
                    <Dialog open={recordDetailOpen} onClose={closeRecordDetail} fullWidth maxWidth="md">
                        <DialogTitle sx={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <Typography variant="h6" sx={{ fontWeight:600 }}>Entry Details</Typography>
                            <Stack direction="row" spacing={1}>
                                <Tooltip title="Copy JSON"><IconButton size="small" onClick={copyRecordJson}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>
                                <IconButton size="small" onClick={closeRecordDetail}><MuiCloseIcon fontSize="small" /></IconButton>
                            </Stack>
                        </DialogTitle>
                        <DialogContent dividers sx={{ maxHeight: '70vh' }}>
                            {recordDetail && (
                                <Stack spacing={3}>
                                    {/* Field Grid */}
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight:600, mb:1 }}>Fields</Typography>
                                        <Grid container spacing={1}>
                                            {Object.keys(recordDetail).filter(k => k !== 'segments').map(key => (
                                                <Grid item xs={12} sm={6} md={4} key={key}>
                                                    <Paper variant="outlined" sx={{ p:1, borderRadius:1 }}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight:500 }}>{key}</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight:600, wordBreak:'break-word' }}>{formatFieldValue(key, (recordDetail as any)[key])}</Typography>
                                                    </Paper>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </Box>
                                    {/* Travel Legs (Segments) */}
                                    {Array.isArray(recordDetail.segments) && (
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight:600, mb:1 }}>Travel Legs ({recordDetail.segments.length})</Typography>
                                            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight:240 }}>
                                                <Table size="small" stickyHeader>
                                                    <TableHead>
                                                        <TableRow>
                                                            {recordDetail.segments.length>0 && Object.keys(recordDetail.segments[0]).map((k:string)=>(<TableCell key={k}>{k}</TableCell>))}
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {recordDetail.segments.map((seg:any, idx:number)=>(
                                                            <TableRow key={idx} hover>
                                                                {Object.keys(seg).map(k => <TableCell key={k}>{formatFieldValue(k, seg[k])}</TableCell>)}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </Box>
                                    )}
                                    {/* Raw JSON */}
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight:600, mb:1 }}>Raw JSON</Typography>
                                        <Paper variant="outlined" sx={{ p:1, maxHeight:300, overflow:'auto', fontFamily:'monospace', fontSize:'0.75rem' }}>
                                            <pre style={{ margin:0 }}>{JSON.stringify(recordDetail, null, 2)}</pre>
                                        </Paper>
                                    </Box>
                                </Stack>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={closeRecordDetail}>Close</Button>
                        </DialogActions>
                    </Dialog>
                </Box>
            )}
        </Box>
        </Fade>
    );
};

// --- NOTE EDIT MODAL COMPONENT ---
interface NoteEditModalProps {
    open: boolean;
    onClose: () => void;
    note: ClientNote;
    onSave: (noteId: string, updatedNoteContent: string) => void;
    // Fast Refresh-safe buffering
    latestRef?: React.MutableRefObject<{ content?: string } | undefined>;
}

const NoteEditModal: React.FC<NoteEditModalProps> = ({ open, onClose, note, onSave, latestRef }) => {
    const [editedNoteContent, setEditedNoteContent] = useState(note.note);

    // Mirror to latestRef so parent can snapshot if needed
    useEffect(() => { if (latestRef) latestRef.current = { content: editedNoteContent }; }, [editedNoteContent, latestRef]);

    useEffect(() => {
        // If latestRef has buffered content (e.g., after Fast Refresh), restore it; otherwise use note
        if (open && latestRef?.current?.content) {
            setEditedNoteContent(latestRef.current.content);
        } else {
            setEditedNoteContent(note.note);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [note, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(note.id, editedNoteContent);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Note</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent dividers>
                    <TextField
                        label="Note Content"
                        fullWidth
                        multiline
                        rows={6}
                        value={editedNoteContent}
                        onChange={(e) => setEditedNoteContent(e.target.value)}
                        variant="outlined"
                        required
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained">Save Changes</Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

// --- USER REMINDERS VIEW (Phase 1) ---
const UserRemindersView = ({ reminders, onCreate, onEdit, onStatusChange, onDelete }: { reminders: UserReminder[]; onCreate: () => void; onEdit: (r: UserReminder) => void; onStatusChange: (r: UserReminder, status: UserReminder['status']) => void; onDelete: (id: string) => void }) => {
    const openItems = reminders.filter(r => r.status !== 'done' && r.status !== 'cancelled');
    const doneItems = reminders.filter(r => r.status === 'done').slice(0, 10);
    return (
        <Fade in={true}>
            <Paper sx={{ p:2, mt:2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h5" sx={{ fontWeight:'bold' }}>My Tasks</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>New Task</Button>
                </Stack>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={7}>
                        <Paper variant="outlined" sx={{ p:2, height:'100%' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight:'bold', mb:1 }}>Open ({openItems.length})</Typography>
                            <List dense sx={{ maxHeight: 420, overflowY:'auto' }}>
                                {openItems.length === 0 && <ListItem><ListItemText primary="No open tasks" /></ListItem>}
                                {openItems.map(r => {
                                    const due = r.due_at ? dayjs(r.due_at) : null;
                                    const overdue = due && due.isBefore(dayjs(), 'minute');
                                    const pr = r.priority ?? 0;
                                    const priorityColor = pr === 2 ? 'error.main' : pr === 1 ? 'warning.main' : 'info.main';
                                    return (
                                        <ListItem 
                                            key={r.id} 
                                            divider 
                                            alignItems="flex-start" 
                                            sx={{ borderLeft: '4px solid', borderLeftColor: priorityColor, pl:1.5 }}
                                            secondaryAction={
                                                <Stack direction="row" spacing={1}>
                                                    <Tooltip title="Edit"><IconButton size="small" onClick={()=>onEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                                    <Tooltip title="Mark Done"><IconButton size="small" onClick={()=>onStatusChange(r,'done')}><CheckCircleIcon color="success" fontSize="small" /></IconButton></Tooltip>
                                                </Stack>
                                            }>
                                            <ListItemText
                                                primary={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="body1" sx={{ fontWeight:600 }}>{r.title}</Typography>{overdue && <Chip size="small" color="error" label="Overdue" />}{pr>0 && <Chip size="small" color={pr===2? 'error':'warning'} label={pr===2? 'Critical':'High'} />}</Stack>}
                                                secondary={<Typography variant="caption" color="text.secondary">{due ? `Due: ${due.format(DISPLAY_DATE_TIME)}` : 'No due date'}</Typography>}
                                            />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={5}>
                        <Paper variant="outlined" sx={{ p:2 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight:'bold', mb:1 }}>Recently Completed</Typography>
                            <List dense sx={{ maxHeight: 420, overflowY:'auto' }}>
                                {doneItems.length === 0 && <ListItem><ListItemText primary="No completed tasks" /></ListItem>}
                                {doneItems.map(r => {
                                    const pr = r.priority ?? 0;
                                    const priorityColor = pr === 2 ? 'error.main' : pr === 1 ? 'warning.main' : 'info.main';
                                    return (
                                        <ListItem key={r.id} divider sx={{ borderLeft:'4px solid', borderLeftColor: priorityColor, pl:1.5 }} secondaryAction={
                                            <Stack direction="row" spacing={1}>
                                                <Tooltip title="Restore"><IconButton size="small" onClick={()=> onStatusChange(r,'open')}><UndoIcon fontSize="small" /></IconButton></Tooltip>
                                                <Tooltip title="Delete Permanently"><IconButton size="small" onClick={async ()=> { const id = r.id; const { error } = await supabase.from('user_reminders').delete().eq('id', id); if (!error) { onDelete(id); } }}><DeleteIcon color="error" fontSize="small" /></IconButton></Tooltip>
                                            </Stack>
                                        }>
                                            <ListItemIcon><CheckCircleIcon color="success" fontSize="small" /></ListItemIcon>
                                            <ListItemText primary={<Stack direction="row" spacing={1} alignItems="center"><Typography variant="body2" sx={{ textDecoration:'line-through' }}>{r.title}</Typography>{pr>0 && <Chip size="small" color={pr===2? 'error':'warning'} label={pr===2? 'Critical':'High'} />}</Stack>} secondary={r.due_at ? dayjs(r.due_at).format(DISPLAY_DATE) : undefined} />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>
        </Fade>
    );
};

// --- USER REMINDER CREATE / EDIT MODAL ---
const UserReminderModal = ({ open, onClose, existing, userId, onSaved, bufferRef, latestRef }: { open: boolean; onClose: () => void; existing: UserReminder | null; userId: string; onSaved: (r: UserReminder) => void; bufferRef?: React.MutableRefObject<{ mode: 'add'|'edit'; id?: string|null; data: React.MutableRefObject<{ title?: string; details?: string; dueAt?: string|null; remindAt?: string|null; priority?: number } | undefined> | { title?: string; details?: string; dueAt?: string|null; remindAt?: string|null; priority?: number } } | null>; latestRef?: React.MutableRefObject<{ title?: string; details?: string; dueAt?: string|null; remindAt?: string|null; priority?: number } | undefined> }) => {
    const isEdit = Boolean(existing);
    const [title, setTitle] = useState(existing?.title || '');
    const [details, setDetails] = useState(existing?.details || '');
    const [dueAt, setDueAt] = useState<string | null>(existing?.due_at || null);
    const [remindAt, setRemindAt] = useState<string | null>(existing?.remind_at || null);
    const [priority, setPriority] = useState<number>(existing?.priority ?? 0);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [touched, setTouched] = useState(false);
    // Mirror latest to latestRef so parent can snapshot
    useEffect(()=>{ if (open && latestRef) latestRef.current = { title, details, dueAt, remindAt, priority }; }, [open, title, details, dueAt, remindAt, priority, latestRef]);
    // Restore from in-memory buffer on mount/open when creating new
    useEffect(()=>{
        if (open && bufferRef?.current?.data) {
            const raw: any = bufferRef.current.data as any;
            const d = raw && typeof raw === 'object' && 'current' in raw ? (raw.current || {}) : raw;
            if (!d || typeof d !== 'object') return;
            if (!isEdit && bufferRef.current.mode === 'add') {
                if (d.title != null) setTitle(d.title);
                if (d.details != null) setDetails(d.details);
                if (typeof d.priority === 'number') setPriority(d.priority);
                if (d.dueAt !== undefined) setDueAt(d.dueAt ?? null);
                if (d.remindAt !== undefined) setRemindAt(d.remindAt ?? null);
            } else if (isEdit && existing && bufferRef.current.mode === 'edit' && bufferRef.current.id === existing.id) {
                if (d.title != null) setTitle(d.title);
                if (d.details != null) setDetails(d.details);
                if (typeof d.priority === 'number') setPriority(d.priority);
                if (d.dueAt !== undefined) setDueAt(d.dueAt ?? null);
                if (d.remindAt !== undefined) setRemindAt(d.remindAt ?? null);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    useEffect(()=> {
        if (existing) {
            setTitle(existing.title);
            setDetails(existing.details||'');
            setDueAt(existing.due_at||null);
            setRemindAt(existing.remind_at||null);
            setPriority(existing.priority??0);
        }
    }, [existing]);

    const handleSave = async () => {
        setTouched(true);
        setErrorMsg(null);
        if (!title.trim()) { setErrorMsg('Title is required'); return; }
        setSaving(true);
        try {
            // Derive defaults: if dueAt provided & no remindAt, remind 1 hour before (if future), else now
            let finalRemind = remindAt;
            if (!finalRemind && dueAt) {
                const due = dayjs(dueAt);
                const candidate = due.subtract(1,'hour');
                finalRemind = (candidate.isAfter(dayjs()) ? candidate : dayjs()).toISOString();
            }
            // Normalize to ISO timestamps if date-only selected
            const toIso = (d: string | null) => d ? (d.length === 10 ? dayjs(d + 'T09:00:00').toISOString() : dayjs(d).toISOString()) : null;
            const payload: any = { 
                user_id: userId, 
                title: title.trim(), 
                details: details||null, 
                due_at: toIso(dueAt), 
                remind_at: toIso(finalRemind), 
                priority, 
                status: existing?.status || 'open' 
            };
            if (isEdit && existing) {
                const { data, error } = await supabase.from('user_reminders').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existing.id).select().single();
                if (error) { setErrorMsg(error.message); }
                else if (data) onSaved(data as UserReminder);
            } else {
                const { data, error } = await supabase.from('user_reminders').insert([payload]).select().single();
                if (error) { setErrorMsg(error.message); }
                else if (data) onSaved(data as UserReminder);
            }
            // Clear latestRef after successful save
            if (latestRef) latestRef.current = {};
        } catch (e:any) {
            setErrorMsg(e.message || 'Unexpected error');
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEdit? 'Edit Task':'New Task'}</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TextField label="Title" value={title} onChange={e=>setTitle(e.target.value)} onBlur={()=>setTouched(true)} required fullWidth error={touched && !title.trim()} helperText={touched && !title.trim() ? 'Title is required' : ' '} />
                    <TextField label="Details" value={details} onChange={e=>setDetails(e.target.value)} fullWidth multiline rows={3} />
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <Stack direction={{ xs:'column', sm:'row' }} spacing={2}>
                            <DatePicker label="Due Date" format={DISPLAY_DATE} value={dueAt? dayjs(dueAt): null} onChange={d=> setDueAt(d? d.format('YYYY-MM-DD'): null)} slotProps={{ textField:{ fullWidth:true, size:'small' } }} />
                            <DatePicker label="Remind Date" format={DISPLAY_DATE} value={remindAt? dayjs(remindAt): null} onChange={d=> setRemindAt(d? d.format('YYYY-MM-DD'): null)} slotProps={{ textField:{ fullWidth:true, size:'small' } }} />
                        </Stack>
                    </LocalizationProvider>
                    <FormControl fullWidth size="small">
                        <InputLabel>Priority</InputLabel>
                        <Select label="Priority" value={priority} onChange={e=> setPriority(Number(e.target.value))}>
                            <MenuItem value={0}>Normal</MenuItem>
                            <MenuItem value={1}>High</MenuItem>
                            <MenuItem value={2}>Critical</MenuItem>
                        </Select>
                    </FormControl>
                    {errorMsg && <Alert severity="error" variant="outlined">{errorMsg}</Alert>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving || !title.trim()}>{saving? 'Saving...':'Save'}</Button>
            </DialogActions>
        </Dialog>
    );
};
