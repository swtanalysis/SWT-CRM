'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient, Session } from '@supabase/supabase-js'
import {
  Box, CssBaseline, AppBar, Toolbar, Typography, Container, Paper, CircularProgress,
  IconButton, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Fade, InputAdornment,
  Select, MenuItem, FormControl, InputLabel, Stack, Link,
  Accordion, AccordionSummary, AccordionDetails, Avatar, Chip, Tabs, Tab, Snackbar
} from '@mui/material'
import { Grid } from '@mui/material';
import {
  Dashboard as DashboardIcon, People as PeopleIcon, Flight as FlightIcon, VpnKey as VpnKeyIcon,
  CreditCard as CreditCardIcon, Policy as PolicyIcon, Delete as DeleteIcon, Add as AddIcon,
  Edit as EditIcon, Menu as MenuIcon, Notifications as NotificationsIcon, Cake as CakeIcon,
  Search as SearchIcon, ArrowUpward as ArrowUpwardIcon, ArrowDownward as ArrowDownwardIcon,
  Logout as LogoutIcon, UploadFile as UploadFileIcon, Description as DescriptionIcon,
  ExpandMore as ExpandMoreIcon, AccountBox as AccountBoxIcon, Download as DownloadIcon, Share as ShareIcon,
  Analytics as AnalyticsIcon, Notes as NotesIcon, Star as StarIcon, Email as EmailIcon, Phone as PhoneIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

dayjs.extend(relativeTime)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// --- TYPE DEFINITIONS ---
interface BaseEntity { id: string; created_at: string; }
export interface Client extends BaseEntity { first_name: string; last_name: string; email_id: string; mobile_no: string; dob: string; nationality: string; vip_status?: boolean; } // Added vip_status
export interface Booking extends BaseEntity { client_id: string; reference: string; vendor: string; destination: string; check_in: string; check_out: string; confirmation_no: string; seat_reference?: string; meal_preference?: string; special_requirement?: string; booking_type: string; pnr: string; departure_date?: string; amount?: number; status?: 'Confirmed' | 'Pending' | 'Cancelled'; } // Made optional fields truly optional
export interface Visa extends BaseEntity { client_id: string; country: string; visa_type: string; visa_number: string; issue_date: string; expiry_date: string; notes: string; }
export interface Passport extends BaseEntity { client_id: string; passport_number: string; issue_date: string; expiry_date: string; }
export interface Policy extends BaseEntity { client_id: string; booking_id: string; policy_number: string; insurer: string; sum_insured: number; start_date: string; end_date: string; premium_amount: number; }
export interface Reminder { type: string; id: string; name: string; days_left?: number; client_id?: string; [key: string]: any; }
interface ClientDocument extends BaseEntity { client_id: string; file_name: string; file_path: string; }
interface ClientNote extends BaseEntity { client_id: string; note: string; user: string; }


const drawerWidth = 240;
const rightDrawerWidth = 320;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF6666', '#66B2FF']; // Expanded colors for more distinct charts

// --- AUTHENTICATION COMPONENT ---
const AuthComponent = ({ setSession }: { setSession: (session: Session | null) => void }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(false);
        if (error) {
            setMessage({ type: 'error', text: error.message });
        } else if (data.session) {
            setSession(data.session);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src="/SWT-Logo-TD.png" alt="SWT Logo" style={{ width: '150px', marginBottom: '1rem' }} />
                <Typography component="h1" variant="h5">
                    Shajanand World Travels CRM
                </Typography>
                <Typography component="h2" variant="subtitle1" sx={{ mt: 2 }}>
                    Sign In
                </Typography>
                <Box component="form" onSubmit={handleAuth} noValidate sx={{ mt: 1 }}>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="email"
                        label="Email Address"
                        name="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Password"
                        type="password"
                        id="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Sign In'}
                    </Button>
                    {message && <Alert severity={message.type}>{message.text}</Alert>}
                </Box>
            </Box>
        </Container>
    );
};


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
    bookings
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
    bookings: Booking[]
}) => (
    <Fade in={true}>
    <Paper sx={{ p: 2, mt: 2, elevation: 3, borderRadius: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'bold' }}>{view}</Typography>
        <TextField 
            label="Search All Columns" 
            variant="outlined" 
            size="small" 
            value={searchTerm} 
            onChange={e => onSearchTermChange(e.target.value)}
            InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>) }} 
            sx={{minWidth: '300px'}} 
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => onOpenModal('add')}>Add {view.slice(0, -1)}</Button>
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
                {Object.keys(getFieldsForView(view)).map(key => (
                  <TableCell key={key}>
                    {key.includes('date') && item[key] ? dayjs(item[key]).format('YYYY-MM-DD') : 
                     key === 'client_id' ? (clients.find(c => c.id === item[key])?.first_name || 'N/A') :
                     key === 'booking_id' ? (bookings.find(b => b.id === item[key])?.pnr || 'N/A') :
                     key === 'vip_status' ? (item[key] ? 'Yes' : 'No') :
                     item[key]}
                  </TableCell>
                ))}
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
  // --- STATE MANAGEMENT ---
  const [session, setSession] = useState<Session | null>(null);
  const [clients, setClients] = useState<Client[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [visas, setVisas] = useState<Visa[]>([])
  const [passports, setPassports] = useState<Passport[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [clientNotes, setClientNotes] = useState<ClientNote[]>([])
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [activeView, setActiveView] = useState('Dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)

  const [openModal, setOpenModal] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedItem, setSelectedItem] = useState<Client | Booking | Visa | Passport | Policy | null>(null)
  
  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<Record<string, string>>({}); 
  
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, view: string} | null>(null);

  // Document Upload Modal State
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [selectedClientForDocs, setSelectedClientForDocs] = useState<Client | null>(null);
  
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string}>({open: false, message: ''});

  // --- AUTHENTICATION ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

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
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- REMINDER GENERATION ---
  const reminders = useMemo<Reminder[]>(() => {
    const today = dayjs();
    const allReminders: Reminder[] = [];
    const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.first_name || 'Unknown';

    clients.forEach(client => {
        const dob = dayjs(client.dob);
        if (!dob.isValid()) return;
        let birthdayThisYear = dob.year(today.year());
        if (birthdayThisYear.isBefore(today, 'day')) birthdayThisYear = birthdayThisYear.add(1, 'year');
        const daysLeft = birthdayThisYear.diff(today, 'day');
        if (daysLeft >= 0 && daysLeft <= 7) {
            allReminders.push({ type: 'Birthday', id: client.id, name: `${client.first_name} ${client.last_name}`, dob: client.dob, days_left: daysLeft, client_id: client.id });
        }
    });
    
    const checkExpiry = (items: (Passport | Visa | Policy)[], type: 'Passport' | 'Visa' | 'Policy', threshold: number) => {
        items.forEach(item => {
            const expiryDateField = 'expiry_date' in item ? item.expiry_date : 'end_date' in item ? item.end_date : null;
            if (!expiryDateField) return;

            const expiryDate = dayjs(expiryDateField);
            if (!expiryDate.isValid()) return;
            const daysLeft = expiryDate.diff(today, 'day');
            if (daysLeft >= 0 && daysLeft <= threshold) { 
                 allReminders.push({ type, id: item.id, client_id: item.client_id, name: getClientName(item.client_id), expiry_date: expiryDate.format('YYYY-MM-DD'), days_left: daysLeft });
            }
        });
    };
    checkExpiry(passports, 'Passport', 365);
    checkExpiry(visas, 'Visa', 180 );
    checkExpiry(policies, 'Policy', 180);

    bookings.forEach(booking => {
        const departureDate = dayjs(booking.departure_date);
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
    const { error } = await supabase.from(tableName).insert([itemData]);
    if (error) setError(`Error adding item: ${error.message}`);
    else { fetchData(); handleCloseModal(); setSnackbar({open: true, message: `${activeView.slice(0, -1)} added successfully!`}); }
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
      else { fetchData(); handleCloseModal(); setSnackbar({open: true, message: `${tableName.slice(0, -1)} updated successfully!`}); }
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
    else { fetchData(); setSnackbar({open: true, message: `${itemToDelete.view.slice(0, -1)} deleted successfully!`}); }
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
  };
  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedItem(null);
    // Potentially reset activeView if it was overridden for the modal, or keep it as is
    // For now, keep it as is, as the user might want to remain in Client Insight.
  };
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


  // --- UI CONFIGURATION & FILTERING ---
  const getFieldsForView = (view: string) => {
    switch (view) {
        case 'Clients': return { first_name: '', last_name: '', email_id: '', mobile_no: '', dob: '', nationality: ''};
        case 'Bookings': return { client_id: '', pnr: '', booking_type: '', destination: '', check_in: '', check_out: '', vendor: '', reference: '', confirmation_no: '', seat_preference: '', meal_preference: '', special_requirement: '', departure_date: '', amount: 0, status: 'Confirmed' };
        case 'Visas': return { client_id: '', country: '', visa_type: '', visa_number: '', issue_date: '', expiry_date: '', notes: '' };
        case 'Passports': return { client_id: '', passport_number: '', issue_date: '', expiry_date: ''};
        case 'Policies': return { client_id: '', booking_id: '', policy_number: '', insurer: '', sum_insured: 0, start_date: '', end_date: '', premium_amount: 0 };
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
        filtered = filtered.filter(item =>
            Object.values(item).some(val => String(val).toLowerCase().includes(lowercasedFilter))
        );
    }

    filtered = filtered.filter(item => Object.entries(filters).every(([key, val]) => !val || String((item as any)[key]).toLowerCase().includes(val.toLowerCase())));

    if (sortColumn) {
        // Create a shallow copy before sorting to avoid mutating the original state
        filtered = [...filtered].sort((a, b) => {
            const aVal = (a as any)[sortColumn];
            const bVal = (b as any)[sortColumn];

            // Handle null or undefined values
            if (aVal == null) return 1;
            if (bVal == null) return -1;

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
  ];

  const drawer = (
    <div>
      <Toolbar sx={{ bgcolor: 'primary.main', color: 'white' }}><Typography variant="h6" noWrap>SWTravels</Typography></Toolbar>
      <List sx={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
        <Box>
            {menuItems.map(item => (
                <ListItem key={item.text} disablePadding>
                    <ListItemButton selected={activeView === item.view} onClick={() => { setActiveView(item.view); setMobileOpen(false); }}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                    </ListItemButton>
                </ListItem>
            ))}
        </Box>
        <ListItem disablePadding sx={{ mt: 'auto' }}>
          <ListItemButton onClick={() => supabase.auth.signOut()}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Logout" />
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
        case 'Dashboard': return <DashboardView stats={{clients: clients.length, bookings: bookings.length}} clientData={clients} bookingData={bookings} policyData={policies} visaData={visas} passportData={passports} globalReminders={reminders} />;
        case 'Client Insight': return <ClientInsightView allClients={clients} allBookings={bookings} allVisas={visas} allPassports={passports} allPolicies={policies} allNotes={clientNotes} globalReminders={reminders} onUpdate={fetchData} onShowSnackbar={setSnackbar} onOpenModal={handleOpenModal} onDeleteItem={handleDeleteItem} />;
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
            />;
        default: return <Typography>Select a view</Typography>;
    }
  };

  const DashboardView = ({ stats, clientData, bookingData, policyData, visaData, passportData, globalReminders }: { stats: any, clientData: Client[], bookingData: Booking[], policyData: Policy[], visaData: Visa[], passportData: Passport[], globalReminders: Reminder[] }) => {
    const [opportunityTab, setOpportunityTab] = useState(0);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setOpportunityTab(newValue);
    };

    const nationalityData = useMemo(() => Object.entries(
        clientData.reduce((acc: Record<string, number>, c: Client) => ({ ...acc, [c.nationality]: (acc[c.nationality] || 0) + 1 }), {})
    ).map(([name, value]) => ({ name, value })), [clientData]);

    const bookingsByMonthData = useMemo(() => {
        const counts = Array(12).fill(0).map((_, i) => ({ name: dayjs().month(i).format('MMM'), bookings: 0 }));
        bookingData.forEach((b: Booking) => { const m = dayjs(b.check_in).month(); if(m>=0) counts[m].bookings++; });
        return counts;
    }, [bookingData]);
    
    const topClientsByRevenue = useMemo(() => {
        const clientSpend = bookingData.reduce((acc: Record<string, number>, booking: Booking) => {
            if (booking.amount) {
                acc[booking.client_id] = (acc[booking.client_id] || 0) + booking.amount;
            }
            return acc;
        }, {});

        return Object.entries(clientSpend)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 5)
            .map(([clientId, totalSpend]) => ({
                name: clientData.find((c: Client) => c.id === clientId)?.first_name || 'Unknown',
                revenue: totalSpend,
            }));
    }, [bookingData, clientData]);

    const bookingStatusData = useMemo(() => {
        const statusCounts = bookingData.reduce((acc: Record<string, number>, booking: Booking) => {
            const status = booking.status || 'Pending';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [bookingData]);

    const crossSellOpportunities = useMemo(() => {
        const allClientIds = new Set(clientData.map(c => c.id));
        const clientsWithBookings = new Set(bookingData.map(b => b.client_id));
        const clientsWithPolicies = new Set(policyData.map(p => p.client_id));
        const clientsWithVisas = new Set(visaData.map(v => v.client_id));
        const clientsWithPassports = new Set(passportData.map(p => p.client_id));
        const today = dayjs();

        const opportunities: Record<string, string[]> = {
            'Needs Insurance Policy': [...clientsWithBookings].filter(id => !clientsWithPolicies.has(id)),
            'May Need Visa': [...clientsWithBookings].filter(id => !clientsWithVisas.has(id)),
            'Needs Passport on File': [...allClientIds].filter(id => !clientsWithPassports.has(id)),
            'Needs First Booking': [...allClientIds].filter(id => !clientsWithBookings.has(id)),
        };

        // Potential Re-engagement: Clients who haven't booked in the last year
        const oneYearAgo = today.subtract(1, 'year');
        const recentBookers = new Set(bookingData.filter(b => dayjs(b.created_at).isAfter(oneYearAgo)).map(b => b.client_id));
        opportunities['Potential Re-engagement'] = [...clientsWithBookings].filter(id => !recentBookers.has(id));

        // VIP Clients with no recent activity (last 6 months)
        const sixMonthsAgo = today.subtract(6, 'months');
        const vipClientIds = new Set(clientData.filter(c => c.vip_status).map(c => c.id));
        const recentVipBookers = new Set(bookingData.filter(b => dayjs(b.created_at).isAfter(sixMonthsAgo) && vipClientIds.has(b.client_id)).map(b => b.client_id));
        opportunities['Inactive VIPs'] = [...vipClientIds].filter(id => !recentVipBookers.has(id));
        
        // Clients with expiring passports (next 6 months)
        const sixMonthsFromNow = today.add(6, 'months');
        const expiringPassportClientIds = new Set(passportData.filter(p => {
            const expiry = dayjs(p.expiry_date);
            return expiry.isAfter(today) && expiry.isBefore(sixMonthsFromNow);
        }).map(p => p.client_id));
        opportunities['Passport Renewal Opportunity'] = [...expiringPassportClientIds];

        return Object.entries(opportunities).map(([type, clientIds]) => ({
            type,
            clients: clientIds.map(id => clientData.find(c => c.id === id)).filter((c): c is Client => Boolean(c)).slice(0, 10)
        }));
    }, [clientData, bookingData, policyData, visaData, passportData]);

    const vendorPerformanceData = useMemo(() => {
        const vendorRevenue = bookingData.reduce((acc: Record<string, number>, booking: Booking) => {
            if (booking.vendor && booking.amount) {
                acc[booking.vendor] = (acc[booking.vendor] || 0) + booking.amount;
            }
            return acc;
        }, {});

        return Object.entries(vendorRevenue)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 7)
            .map(([name, value]) => ({ name, 'Revenue': value }));
    }, [bookingData]);
    
    const clientAgeData = useMemo(() => {
        const ageGroups: Record<string, number> = { '18-30': 0, '31-45': 0, '46-60': 0, '61+': 0, 'Unknown': 0 };
        clientData.forEach((c: Client) => {
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
    }, [clientData]);

    const popularDestinations = useMemo(() => {
        const destinationCounts = bookingData.reduce((acc: Record<string, number>, booking: Booking) => {
            const dest = booking.destination || 'N/A';
            acc[dest] = (acc[dest] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(destinationCounts)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .slice(0, 7)
            .map(([name, value]) => ({ name, 'Bookings': value }));
    }, [bookingData]);

    const bookingTypeData = useMemo(() => {
        const typeCounts = bookingData.reduce((acc: Record<string, number>, booking: Booking) => {
            const type = booking.booking_type || 'Other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(typeCounts).map(([name, value]) => ({ name, value }));
    }, [bookingData]);
    
    const avgTripDuration = useMemo(() => {
        const validTrips = bookingData.filter((b: Booking) => b.check_in && b.check_out);
        if (validTrips.length === 0) return 0;
        const totalDays = validTrips.reduce((sum: number, b: Booking) => {
            const duration = dayjs(b.check_out).diff(dayjs(b.check_in), 'day');
            return sum + (duration > 0 ? duration : 0);
        }, 0);
        return Math.round(totalDays / validTrips.length);
    }, [bookingData]);

    const expiringRemindersCount = useMemo(() => {
        return globalReminders.filter((r: Reminder) => r.type !== 'Birthday' && r.days_left! <= 30 && r.days_left! >=0).length;
    }, [globalReminders]);
    
    return (
        <Fade in={true}>
        <Grid container spacing={3}>
            {/* Key Metrics */}
            <Grid item xs={12}>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Total Clients</Typography>
                            <Typography variant="h4" color="primary.main" sx={{fontWeight: 'bold'}}>{stats.clients}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Active Bookings</Typography>
                            <Typography variant="h4" color="secondary.main" sx={{fontWeight: 'bold'}}>{stats.bookings}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Avg. Trip Duration</Typography>
                            <Typography variant="h4" color="info.main" sx={{fontWeight: 'bold'}}>{avgTripDuration} Days</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Paper elevation={3} sx={{p:3, textAlign:'center', borderRadius: 2, height: '100%'}}>
                            <Typography variant="h6" color="text.secondary" gutterBottom>Expiring Soon</Typography>
                            <Typography variant="h4" color="error.main" sx={{fontWeight: 'bold'}}>{expiringRemindersCount}</Typography>
                        </Paper>
                    </Grid>
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
                                                    <TableCell>{client.first_name} {client.last_name}</TableCell>
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
                        <Paper elevation={3} sx={{p:3, height: 400, borderRadius: 2, display: 'flex', flexDirection: 'column'}}>
                            <Typography variant="h6" gutterBottom sx={{fontWeight: 'bold', flexShrink: 0}}>Top 5 Clients (by Revenue)</Typography>
                            <Box sx={{flexGrow: 1, width: '100%'}}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topClientsByRevenue} margin={{top: 20, right: 30, left: 20, bottom: 5}}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis allowDecimals={false} label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }} />
                                        <RechartsTooltip formatter={(value) => `$${value}`} />
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
                                        <YAxis allowDecimals={false} label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }} />
                                        <RechartsTooltip formatter={(value: number) => `$${value}`} />
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

    useEffect(() => {
        setFormData(modalMode === 'edit' && selectedItem ? selectedItem : getFieldsForView(activeView));
    }, [openModal, modalMode, selectedItem, activeView]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const type = 'type' in e.target ? e.target.type : 'text';
        
        if (type === 'checkbox') {
            // Type assertion to access 'checked' property
            setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleDateChange = (name: string, date: dayjs.Dayjs | null) => {
        setFormData({ ...formData, [name]: date ? date.format('YYYY-MM-DD') : null });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = e.target;
        if (files && files.length > 0) {
            const file = files[0];
            setFormData({ ...formData, file_name: file.name, file_path: URL.createObjectURL(file) });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (modalMode === 'add') handleAddItem(formData);
        else handleUpdateItem(formData);
    };
    
    return (
        <Dialog open={openModal} onClose={handleCloseModal} maxWidth="sm" fullWidth>
            <DialogTitle>{modalMode === 'add' ? 'Add New' : 'Edit'} {activeView === 'Client Insight' ? 'Client' : activeView.slice(0, -1)}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DialogContent dividers>
                        <Grid container spacing={2} sx={{pt: 1}}>
                        {Object.keys(formData).filter(k => k !== 'id' && k !== 'created_at').map(key => (
                            <Grid item xs={12} sm={key.includes('notes') || key.includes('special_requirement') ? 12 : 6} key={key}>
                                {key.includes('client_id') ? (
                                    <FormControl fullWidth required>
                                        <InputLabel id={`${key}-label`}>Client</InputLabel>
                                        <Select
                                            labelId={`${key}-label`}
                                            id={key}
                                            name="client_id"
                                            value={formData[key] || ''}
                                            label="Client"
                                            onChange={(e) => handleFormChange(e as any)}
                                        >
                                            <MenuItem value=""><em>None</em></MenuItem>
                                            {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                ) : key.includes('booking_id') && activeView === 'Policies' ? (
                                    <FormControl fullWidth required>
                                        <InputLabel id={`${key}-label`}>Booking</InputLabel>
                                        <Select
                                            labelId={`${key}-label`}
                                            id={key}
                                            name="booking_id"
                                            value={formData[key] || ''}
                                            label="Booking"
                                            onChange={(e) => handleFormChange(e as any)}
                                        >
                                            <MenuItem value=""><em>None</em></MenuItem>
                                            {bookings.map(b => <MenuItem key={b.id} value={b.id}>{b.pnr || b.reference} ({clients.find(c => c.id === b.client_id)?.first_name || 'N/A'})</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                ) : key.includes('date') || key.includes('dob') || key.includes('check_in') || key.includes('check_out') || key.includes('start_date') || key.includes('end_date') ? (
                                    <DatePicker
                                        label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        value={formData[key] ? dayjs(formData[key]) : null}
                                        onChange={(date) => handleDateChange(key, date)}
                                        slotProps={{ textField: { fullWidth: true, required: true } }}
                                    />
                                ) : key === 'status' ? (
                                    <FormControl fullWidth required>
                                        <InputLabel id={`${key}-label`}>Status</InputLabel>
                                        <Select
                                            labelId={`${key}-label`}
                                            id={key}
                                            name="status"
                                            value={formData[key] || ''}
                                            label="Status"
                                            onChange={(e) => handleFormChange(e as any)}
                                        >
                                            <MenuItem value="Confirmed">Confirmed</MenuItem>
                                            <MenuItem value="Pending">Pending</MenuItem>
                                            <MenuItem value="Cancelled">Cancelled</MenuItem>
                                        </Select>
                                    </FormControl>
                                ) : key === 'vip_status' ? (
                                    <FormControl fullWidth>
                                        <label>
                                            <input
                                                type="checkbox"
                                                name="vip_status"
                                                checked={!!formData[key]} // Ensure it's a boolean
                                                onChange={handleFormChange}
                                            /> VIP Status
                                        </label>
                                    </FormControl>
                                ) : (
                                    <TextField name={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        type={typeof (getFieldsForView(activeView) as any)[key] === 'number' ? 'number' : 'text'}
                                        fullWidth value={formData[key] || ''} onChange={handleFormChange} required={key !== 'notes' && key !== 'special_requirement' && key !== 'vip_status' && key !== 'amount' && key !== 'departure_date' && key !== 'status'}
                                        multiline={key.includes('notes') || key.includes('special_requirement')}
                                        rows={key.includes('notes') || key.includes('special_requirement') ? 3 : 1}
                                    />
                                )}
                            </Grid>
                        ))}
                        </Grid>
                    </DialogContent>
                </LocalizationProvider>
                <DialogActions>
                    <Button onClick={handleCloseModal}>Cancel</Button>
                    <Button type="submit" variant="contained">{modalMode === 'add' ? 'Add' : 'Update'}</Button>
                </DialogActions>
            </form>
        </Dialog>
    )
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
            else fetchDocuments();
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
        else fetchDocuments();
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
            <DialogTitle>Documents for {selectedClientForDocs?.first_name} {selectedClientForDocs?.last_name}</DialogTitle>
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
                                <ListItemText primary={doc.file_name} secondary={`Uploaded: ${dayjs(doc.created_at).format('YYYY-MM-DD HH:mm')}`} />
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

  const RightDrawer = ({ reminders, onReminderClick }: { reminders: Reminder[]; onReminderClick: (reminder: Reminder) => void; }) => {
    const getReminderIcon = (type: string) => ({ Birthday: <CakeIcon color="secondary" />, Passport: <CreditCardIcon color="error" />, Visa: <VpnKeyIcon color="error" />, Policy: <PolicyIcon color="error" />, Booking: <FlightIcon color="info" /> }[type] || <NotificationsIcon />);
    const getReminderMessage = (r: Reminder) => {
        let message = `${r.type} for ${r.name}`;
        if (r.type.includes('Passport') || r.type.includes('Visa') || r.type.includes('Policy')) {
            message += ` expiring on ${dayjs(r.expiry_date || r.end_date).format('YYYY-MM-DD')}`;
        } else if (r.type === 'Booking') {
            message += ` check-in on ${dayjs(r.departure_date).format('YYYY-MM-DD')}`;
        } else if (r.type === 'Birthday') {
            message += ` on ${dayjs(r.dob).format('MM-DD')}`;
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
                [`& .MuiDrawer-paper`]: { width: rightDrawerWidth, boxSizing: 'border-box', pt: '64px', overflowY: 'auto', borderLeft: '1px solid rgba(0, 0, 0, 0.12)' },
                display: { xs: 'none', md: 'block' }
            }}
        >
            <Toolbar />
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Reminders</Typography>
                {Object.keys(categorizedReminders).length > 0 ? (
                    Object.entries(categorizedReminders).map(([category, items]) => (
                        <Accordion key={category} defaultExpanded={true} elevation={1} sx={{ mb: 1 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    {category} ({items.length})
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 1 }}>
                                {items.map((r, i) => (
                                    <Alert 
                                        key={i} 
                                        severity={r.days_left! <= 7 && r.days_left! >= 0 ? "error" : r.days_left! < 0 ? "error" : "warning"} 
                                        icon={getReminderIcon(r.type)} 
                                        sx={{ mb: 1, cursor: 'pointer', '&:last-child': { mb: 0 }, alignItems: 'center' }} 
                                        onClick={() => onReminderClick(r)}
                                    >
                                        {getReminderMessage(r)}
                                    </Alert>
                                ))}
                            </AccordionDetails>
                        </Accordion>
                    ))
                ) : (
                    <Alert severity="success" sx={{mt: 2}}>No upcoming reminders!</Alert>
                )}
            </Box>
        </Drawer>
    );
  };


  // --- MAIN RENDER ---
  if (!session) {
    return <AuthComponent setSession={setSession} />;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" 
        sx={{ 
            zIndex: (theme) => theme.zIndex.drawer + 1,
        }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: 'none' } }}><MenuIcon /></IconButton>
          <Typography variant="h6" noWrap component="div" sx={{flexGrow: 1}}>{activeView}</Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}>{drawer}</Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid rgba(0, 0, 0, 0.12)' } }} open>{drawer}</Drawer>
      </Box>
      <Box component="main" 
        sx={{ 
            flexGrow: 1, 
            p: 3, 
            bgcolor: '#f4f6f8', 
            minHeight: '100vh',
            // LAYOUT FIX: Removed manual width calculations. Flex-grow will now correctly handle the width.
        }}>
        <Toolbar /> {/* Toolbar offset for content below AppBar */}
        <Container maxWidth="xl" sx={{ pt: 2, pb: 2 }}>
          {renderContent()}
        </Container>
      </Box>

      {/* Right Reminders Drawer */}
      <RightDrawer reminders={reminders} onReminderClick={handleReminderClick} />

      {openModal && <FormModal />}
      {docModalOpen && <DocumentUploadModal onShowSnackbar={setSnackbar} />}
      <ConfirmationDialog />
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}

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
                        <ListItemText primary={doc.file_name} secondary={`Uploaded: ${dayjs(doc.created_at).format('YYYY-MM-DD')}`} />
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
    const [insightSearchTerm, setInsightSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [clientData, setClientData] = useState<any>({ bookings: [], visas: [], passports: [], policies: [], notes: [], reminders: [] });
    const [tabValue, setTabValue] = useState(0);
    const [newNote, setNewNote] = useState('');

    const [isNoteEditModalOpen, setIsNoteEditModalOpen] = useState(false);
    const [noteToEdit, setNoteToEdit] = useState<ClientNote | null>(null);

    const handleSearch = () => {
        if (!insightSearchTerm) {
            setSelectedClient(null);
            return;
        }
        const lowercasedTerm = insightSearchTerm.toLowerCase();
        const foundClient = allClients.find(c =>
            c.first_name.toLowerCase().includes(lowercasedTerm) ||
            c.last_name.toLowerCase().includes(lowercasedTerm) ||
            c.email_id.toLowerCase().includes(lowercasedTerm) ||
            c.mobile_no.includes(lowercasedTerm)
        );
        setSelectedClient(foundClient || null);
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
        }
    };

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
        }
    };

    const handleDownloadPdf = () => {
        const insightContent = document.getElementById('insight-content');
        if (insightContent) {
            onShowSnackbar({ open: true, message: 'Generating PDF...' });
            html2canvas(insightContent).then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                const width = pdfWidth;
                const height = width / ratio;
                pdf.addImage(imgData, 'PNG', 0, 0, width, height);
                pdf.save(`client-insight-${selectedClient?.first_name}-${selectedClient?.last_name}.pdf`);
            });
        }
    };

    const analytics = useMemo(() => {
        if (!selectedClient) return { totalSpend: 0, numTrips: 0, avgSpend: 0, destinations: [] };
        const bookings = clientData.bookings;
        const policies = clientData.policies;
        const totalSpend = bookings.reduce((sum: any, b: { amount: any; }) => sum + (b.amount || 0), 0) + policies.reduce((sum: any, p: { premium_amount: any; }) => sum + (p.premium_amount || 0), 0);
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

    const bookingCols = [ {key: 'pnr', label: 'PNR'}, {key: 'destination', label: 'Destination'}, {key: 'check_in', label: 'Check-in', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, {key: 'check_out', label: 'Check-out', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, {key: 'amount', label: 'Amount', render: (val: number) => `$${val?.toFixed(2)}`}, {key: 'status', label: 'Status'}, ];
    const visaCols = [ {key: 'country', label: 'Country'}, {key: 'visa_type', label: 'Type'}, {key: 'visa_number', label: 'Number'}, {key: 'issue_date', label: 'Issue Date', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, {key: 'expiry_date', label: 'Expiry Date', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, ];
    const passportCols = [ {key: 'passport_number', label: 'Number'}, {key: 'issue_date', label: 'Issue Date', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, {key: 'expiry_date', label: 'Expiry Date', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, ];
    const policyCols = [ {key: 'policy_number', label: 'Number'}, {key: 'insurer', label: 'Insurer'}, {key: 'sum_insured', label: 'Sum Insured', render: (val: number) => `$${val?.toFixed(2)}`}, {key: 'premium_amount', label: 'Premium', render: (val: number) => `$${val?.toFixed(2)}`}, {key: 'start_date', label: 'Start', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, {key: 'end_date', label: 'End', render: (val: string) => dayjs(val).format('YYYY-MM-DD')}, ];

    return (
        <Fade in={true}>
            <Box>
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

                {!selectedClient && (
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
                                    <Avatar sx={{ width: 90, height: 90, bgcolor: 'primary.main', fontSize: '2.5rem' }}>{selectedClient.first_name[0]}</Avatar>
                                    <Box flexGrow={1}>
                                        <Typography variant="h4" component="div" sx={{fontWeight: 'bold', mb: 0.5}}>
                                            {selectedClient.first_name} {selectedClient.last_name}
                                            {selectedClient.vip_status && <Chip icon={<StarIcon />} label="VIP Client" color="secondary" size="medium" sx={{ ml: 2, verticalAlign: 'middle' }} />}
                                        </Typography>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="flex-start">
                                            <Chip icon={<EmailIcon fontSize="small" />} label={selectedClient.email_id} size="small" />
                                            <Chip icon={<PhoneIcon fontSize="small" />} label={selectedClient.mobile_no} size="small" />
                                            <Chip icon={<CakeIcon fontSize="small" />} label={`DOB: ${dayjs(selectedClient.dob).format('YYYY-MM-DD')}`} size="small" />
                                            <Chip label={`Nationality: ${selectedClient.nationality}`} size="small" />
                                        </Stack>
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
                                            <Typography variant="h6" color="primary.main">${analytics.totalSpend.toFixed(2)}</Typography>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body1">Average Spend per Trip:</Typography>
                                            <Typography variant="h6" color="primary.main">${analytics.avgSpend.toFixed(2)}</Typography>
                                        </Box>
                                    </Stack>
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
                                                                    `Expires: ${dayjs(r.expiry_date || r.end_date).format('YYYY-MM-DD')}` : ''}
                                                                {r.type === 'Booking' ? `Departure: ${dayjs(r.departure_date).format('YYYY-MM-DD')}` : ''}
                                                                {r.type === 'Birthday' ? `Birthday: ${dayjs(r.dob).format('MM-DD')}` : ''}
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
                                                                <ListItemText primary={note.note} secondary={`By ${note.user} on ${dayjs(note.created_at).format('YYYY-MM-DD HH:mm')}`} />
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
                    </Box>
                )}

                {/* Note Edit Modal */}
                {isNoteEditModalOpen && noteToEdit && (
                    <NoteEditModal
                        open={isNoteEditModalOpen}
                        onClose={handleCloseNoteEditModal}
                        note={noteToEdit}
                        onSave={handleUpdateNote}
                    />
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
}

const NoteEditModal: React.FC<NoteEditModalProps> = ({ open, onClose, note, onSave }) => {
    const [editedNoteContent, setEditedNoteContent] = useState(note.note);

    useEffect(() => {
        setEditedNoteContent(note.note);
    }, [note]);

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


// function onShowSnackbar(arg0: string, arg1: string) {
//     throw new Error('Function not implemented.');
// }
// function setDocError(arg0: string | null) {
//     throw new Error('Function not implemented.');
// }
// }

