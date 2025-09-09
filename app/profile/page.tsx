'use client'
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Profile, UserDailyMetrics, UserActivity } from '../../lib/types';
import { Box, Tabs, Tab, Avatar, Typography, Grid, Paper, TextField, Button, Stack, Alert, Snackbar, AppBar, Toolbar, Container, CssBaseline, CircularProgress, FormControlLabel, Switch, Table, TableHead, TableRow, TableCell, TableBody, ToggleButtonGroup, ToggleButton, Divider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, BarChart, Bar, AreaChart, Area } from 'recharts';
import { Save as SaveIcon, CloudUpload as CloudUploadIcon, Security as SecurityIcon, Insights as InsightsIcon, History as HistoryIcon, Edit as EditIcon, ArrowBack as ArrowBackIcon, PictureAsPdf as PictureAsPdfIcon } from '@mui/icons-material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import NextLink from 'next/link';
import dayjs from 'dayjs';
import { DISPLAY_DATE, DISPLAY_DATE_TIME } from '../../lib/dateFormats';

const ProfilePage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(()=> { setMounted(true); },[]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [tab, setTab] = useState(0);
  const [metrics, setMetrics] = useState<UserDailyMetrics[]>([]);
  // Department raw data (last 30d) for broader analytics beyond user-specific metrics table
  const [clients30, setClients30] = useState<any[]>([]);
  const [bookings30, setBookings30] = useState<any[]>([]);
  const [visas30, setVisas30] = useState<any[]>([]);
  const [passports30, setPassports30] = useState<any[]>([]);
  const [policies30, setPolicies30] = useState<any[]>([]);
  const [itineraries30, setItineraries30] = useState<any[]>([]);
  const [activity, setActivity] = useState<UserActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  // Removed API keys feature as requested
  const [snackbar, setSnackbar] = useState<{open:boolean; message:string; severity?:'success'|'error'|'info'|'warning'}>({open:false, message:''});
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [dataScope, setDataScope] = useState<'me'|'all'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const s = localStorage.getItem('profile_scope');
        if (s === 'me' || s === 'all') return s;
      } catch {}
    }
    return 'me';
  });
  // Date filters for Sales Metrics daily table
  const [salesFrom, setSalesFrom] = useState<dayjs.Dayjs | null>(null);
  const [salesTo, setSalesTo] = useState<dayjs.Dayjs | null>(null);
  useEffect(()=>{ try { localStorage.setItem('profile_scope', dataScope); } catch {}; },[dataScope]);

  // Auth bootstrap (avoid race where getUser returns null briefly)
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => { if (!mounted) return; setAuthUser(session?.user || null); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, session) => { if (!mounted) return; setAuthUser(session?.user || null); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const ensureProfile = useCallback(async (user: any) => {
    setProfileError(null);
    setDebugInfo(null);
    try {
      const fetchRes = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      setDebugInfo((d:any)=> ({ ...(d||{}), fetchRes: serializeResult(fetchRes) }));
      if (fetchRes.error) throw fetchRes.error;
      if (fetchRes.data) { setProfile(fetchRes.data as Profile); setForm(fetchRes.data as Profile); return; }
      const seed = {
        id: user.id,
        display_name: user.email || 'User',
        first_name: user.email ? user.email.split('@')[0] : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: (navigator.language || 'en-US'),
        currency: 'USD',
        theme: 'light'
      };
      const insertRes = await supabase.from('profiles').insert(seed).select().single();
      setDebugInfo((d:any)=> ({ ...(d||{}), insertRes: serializeResult(insertRes) }));
      if (insertRes.error) throw insertRes.error;
      if (insertRes.data) { setProfile(insertRes.data as Profile); setForm(insertRes.data as Profile); return; }
      setProfileError('Unknown failure: insert returned no data and no error');
    } catch (err: any) {
      const msg = err?.message || err?.hint || err?.details || JSON.stringify(err) || 'Unknown error';
      setProfileError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const serializeResult = (res: any) => {
    if (!res) return res;
    const { data, error, status, statusText } = res;
    return {
      status, statusText,
      hasData: !!data,
      dataKeys: data ? (Array.isArray(data) ? data.length : Object.keys(data)) : null,
      error: error ? { message: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint } : null
    };
  };

  // Main load when authUser available
  useEffect(() => {
    if (!authUser) { return; }
    setLoading(true);
    (async () => {
      await ensureProfile(authUser);
      if (!authUser?.id) return;
      const since = dayjs().subtract(30,'day').format('YYYY-MM-DD'); // keep storage/query format
      const { data: met } = await supabase.from('user_metrics_daily').select('*').eq('user_id', authUser.id).gte('date', since).order('date');
      if (met) setMetrics(met as any);
      // Fetch department data (created_at limited) for holistic analytics (system-wide)
      const [cl, bk, vs, pp, pl, it] = await Promise.all([
        supabase.from('clients').select('id, created_at').gte('created_at', since),
        supabase.from('bookings').select('id, created_at, amount').gte('created_at', since),
        supabase.from('visas').select('id, created_at, amount').gte('created_at', since),
        supabase.from('passports').select('id, created_at, amount').gte('created_at', since),
        supabase.from('policies').select('id, created_at, premium_amount').gte('created_at', since),
        supabase.from('itineraries').select('id, created_at').gte('created_at', since)
      ]);
      if (cl.data) setClients30(cl.data);
      if (bk.data) setBookings30(bk.data);
      if (vs.data) setVisas30(vs.data);
      if (pp.data) setPassports30(pp.data);
      if (pl.data) setPolicies30(pl.data);
      if (it.data) setItineraries30(it.data);
  // API keys removed
    })();
  }, [authUser, ensureProfile]);

  // Activity fetch (top-level hooks)
  const activityLoadedRef = useRef(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const fetchUserActivity = useCallback(async (force?: boolean) => {
    if (!authUser?.id) return;
    if (!force && (activityLoading || activityLoadedRef.current)) return;
    setActivityLoading(true);
    setActivityError(null);
    try {
      const base = supabase.from('user_activity').select('*').eq('user_id', authUser.id).order('created_at',{ascending:false}).limit(200);
      const { data, error } = await base;
      if (error) {
        setActivityError(error.message);
      }
      let rows = data || [];
      if ((!rows || !rows.length) && !error) {
        // optional broad fetch for diagnostics
        const broad = await supabase.from('user_activity').select('*').order('created_at',{ascending:false}).limit(200);
        if (!broad.error && broad.data) {
          rows = (broad.data as any[]).filter(r=> r.user_id === authUser.id);
        }
      }
      if (rows && rows.length) {
        setActivity(rows as any);
      } else if (!error) {
        setActivity([]);
      }
      activityLoadedRef.current = true;
    } finally {
      setActivityLoading(false);
    }
  }, [authUser]);

  // Adjust for removed tab (Productivity). Ensure activity (now index 2) loads once.
  useEffect(() => {
    if (tab > 2) { setTab(2); return; }
    if (tab === 2) fetchUserActivity();
  }, [tab, fetchUserActivity]);

  const handleSave = async () => {
    if (!profile) return;
    const update = { ...form };
    const { error, data } = await supabase.from('profiles').update(update).eq('id', profile.id).select().single();
    if (error) { setSnackbar({open:true,message:`Save failed: ${error.message}`,severity:'error'}); return; }
    setProfile(data as Profile); setEdit(false); setSnackbar({open:true,message:'Profile updated',severity:'success'});
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatar_url = pub.publicUrl;
      const { error: updateError, data } = await supabase.from('profiles').update({ avatar_url }).eq('id', profile.id).select().single();
      if (updateError) throw updateError;
      setProfile(data as Profile);
      setForm(f=>({ ...f, avatar_url }));
      setSnackbar({ open:true, message: 'Avatar updated', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open:true, message: `Avatar upload failed: ${err.message || err}`, severity: 'error' });
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id);
      if (error) throw error;
      setProfile(p=> p ? { ...p, avatar_url: undefined } : p);
      setForm(f=> ({ ...f, avatar_url: undefined }));
      setSnackbar({ open:true, message: 'Avatar removed', severity: 'success' });
    } catch (err: any) {
      setSnackbar({ open:true, message: `Remove failed: ${err.message || err}`, severity: 'error' });
    }
  };

  // API key creation & revocation logic removed

  const handleThemeToggle = async () => {
    if (!profile) return;
    const newTheme = (form.theme === 'dark' ? 'light' : 'dark');
    setForm(f=>({ ...f, theme: newTheme }));
    // Optimistic UI update & persistence
    const { error, data } = await supabase.from('profiles').update({ theme: newTheme }).eq('id', profile.id).select().single();
    if (error) { setSnackbar({open:true,message:`Theme update failed: ${error.message}`,severity:'error'}); return; }
    setProfile(data as Profile);
    // Persist to localStorage for root layout, and dispatch event
    try { localStorage.setItem('pref_theme', newTheme); } catch {}
    window.dispatchEvent(new CustomEvent('user-theme-change', { detail: { theme: newTheme } }));
    setSnackbar({open:true,message:`Theme set to ${newTheme}`,severity:'success'});
  };

  // Full name helper (first + middle + last fallback to display_name)
  const fullName = useMemo(()=> {
    if (!profile) return 'User';
    return [profile.first_name, (profile as any)?.middle_name, profile.last_name].filter(Boolean).join(' ') || profile.display_name || 'User';
  }, [profile]);

  // Helper: last 30 calendar days list (inclusive today) for storage/queries
  const last30Days = useMemo(()=> {
    const arr: string[] = [];
    for (let i=29;i>=0;i--) arr.push(dayjs().subtract(i,'day').format('YYYY-MM-DD'));
    return arr;
  },[]);

  // Aggregate department daily counts (system-wide) for holistic KPIs
  const deptDaily = useMemo(()=> {
    const index = (rows: any[], extra?: (r:any)=>number) => {
      const map: Record<string, { count: number; value: number }> = {};
      rows.forEach(r => {
        const d = dayjs(r.created_at).format('YYYY-MM-DD');
        if (!map[d]) map[d] = { count:0, value:0 };
        map[d].count++;
        if (extra) map[d].value += extra(r) || 0;
      });
      return map;
    };
    return {
      clients: index(clients30),
      bookings: index(bookings30, r=>Number(r.amount)||0),
      visas: index(visas30, r=>Number(r.amount)||0),
      passports: index(passports30, r=>Number(r.amount)||0),
      policies: index(policies30, r=>Number(r.premium_amount)||0),
      itineraries: index(itineraries30)
    };
  }, [clients30, bookings30, visas30, passports30, policies30, itineraries30]);

  // Build user & global sales trends; pick via scope
  const userSalesTrend = useMemo(()=> last30Days.map(d => {
    const m = metrics.find(x=>x.date===d);
    const bookingRevenue = m? Number(m.revenue_sum||0):0;
    return {
      date: d.slice(5), // legacy short
      displayDate: dayjs(d).format('DD/MM'),
      isoDate: d,
      bookings: m?.bookings_count||0,
      bookingRevenue,
      policyRevenue: 0,
      visaRevenue: 0,
      passportRevenue: 0,
      totalRevenue: bookingRevenue,
      revenue: bookingRevenue,
      avg: m? Number(m.avg_booking_value||0):0
    };
  }), [metrics, last30Days]);
  const globalSalesTrend = useMemo(()=> last30Days.map(d => {
    const b = deptDaily.bookings[d];
    const p = deptDaily.policies[d];
    const v = deptDaily.visas[d];
    const pp = deptDaily.passports[d];
    const bookingRevenue = b?.value||0;
    const policyRevenue = p?.value||0;
    const visaRevenue = v?.value||0;
    const passportRevenue = pp?.value||0;
    const totalRevenue = bookingRevenue + policyRevenue + visaRevenue + passportRevenue;
    const bookings = b?.count||0;
    return {
      date: d.slice(5),
      displayDate: dayjs(d).format('DD/MM'),
      isoDate: d,
      bookings,
      bookingRevenue,
      policyRevenue,
      visaRevenue,
      passportRevenue,
      totalRevenue,
      revenue: totalRevenue,
      avg: bookings ? (bookingRevenue / bookings) : 0
    };
  }), [deptDaily, last30Days]);
  const salesTrend = (dataScope==='me') ? userSalesTrend : globalSalesTrend;
  // Filtered sales trend for daily table (does not affect overview chart to preserve 30d visuals)
  const filteredSalesTrend = useMemo(()=> {
    if (!salesFrom && !salesTo) return salesTrend;
    return salesTrend.filter(r => {
      const d = dayjs(r.isoDate ? r.isoDate : dayjs().year() + '-' + r.date);
      if (salesFrom && d.isBefore(salesFrom, 'day')) return false;
      if (salesTo && d.isAfter(salesTo, 'day')) return false;
      return true;
    });
  }, [salesTrend, salesFrom, salesTo]);

  // Productivity metrics removed (tab deleted)

    const kpis = useMemo(()=> {
      const bookings = salesTrend.reduce((s,r)=>s+r.bookings,0);
      const bookingRevenue = salesTrend.reduce((s,r)=>s+(r.bookingRevenue||0),0);
      const policyRevenueGlobal = Object.values(deptDaily.policies||{}).reduce((s:any,r:any)=>s+r.value,0);
      const visaRevenueGlobal = Object.values(deptDaily.visas||{}).reduce((s:any,r:any)=>s+r.value,0);
      const passportRevenueGlobal = Object.values(deptDaily.passports||{}).reduce((s:any,r:any)=>s+r.value,0);
      const policyRevenue = (dataScope==='me') ? 0 : policyRevenueGlobal;
      const visaRevenue = (dataScope==='me') ? 0 : visaRevenueGlobal;
      const passportRevenue = (dataScope==='me') ? 0 : passportRevenueGlobal;
      const policies = (dataScope==='me') ? metrics.reduce((s,m)=>s+m.policies_count,0) : (deptDaily.policies ? Object.values(deptDaily.policies).reduce((s,r)=>s+r.count,0):0);
      const clients = (dataScope==='me') ? 0 : Object.values(deptDaily.clients||{}).reduce((s,r)=>s+r.count,0);
      const visas = (dataScope==='me') ? 0 : Object.values(deptDaily.visas||{}).reduce((s,r)=>s+r.count,0);
      const passports = (dataScope==='me') ? 0 : Object.values(deptDaily.passports||{}).reduce((s,r)=>s+r.count,0);
      const itineraries = (dataScope==='me') ? 0 : Object.values(deptDaily.itineraries||{}).reduce((s,r)=>s+r.count,0);
      const totalRevenue = bookingRevenue + policyRevenue + visaRevenue + passportRevenue;
      const avg = bookings ? bookingRevenue / bookings : 0;
      return { bookings, bookingRevenue, policyRevenue, visaRevenue, passportRevenue, totalRevenue, policies, avg, clients, visas, passports, itineraries };
    },[salesTrend, deptDaily, dataScope, metrics]);

  const departmentSummary = useMemo(()=> [
    { label:'Clients Added', value: kpis.clients, color:'primary.main' },
    { label:'Bookings', value: kpis.bookings, color:'secondary.main' },
    { label:'Booking Revenue', value: kpis.bookingRevenue.toFixed(2), color:'success.main' },
    { label:'Policy Revenue', value: kpis.policyRevenue.toFixed(2), color:'info.main' },
    { label:'Visa Revenue', value: kpis.visaRevenue.toFixed(2), color:'warning.main' },
    { label:'Passport Revenue', value: kpis.passportRevenue.toFixed(2), color:'error.main' },
    { label:'Total Revenue', value: kpis.totalRevenue.toFixed(2), color:'success.dark' },
    { label:'Policies', value: kpis.policies, color:'info.dark' },
    { label:'Visas', value: kpis.visas, color:'warning.dark' },
    { label:'Passports', value: kpis.passports, color:'error.dark' },
    { label:'Itineraries', value: kpis.itineraries, color:'text.primary' },
    { label:'Avg / Booking', value: kpis.avg.toFixed(2), color:'success.dark' }
  ], [kpis]);

  const editableField = (name: keyof Profile, label: string, type: string = 'text') => (
    <TextField size="small" label={label} value={(form as any)[name] || ''} type={type} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} fullWidth disabled={!edit} />
  );

  const handleDownloadReport = async () => {
    const buildStructuredPdf = () => {
      try {
        const pdf = new jsPDF('p','mm','a4');
        const lineHeight = 6;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const marginX = 10;
        let y = 12;
        const write = (text: string, opts: { bold?: boolean; color?: [number,number,number] } = {}) => {
          if (y > 280) { pdf.addPage(); y = 12; }
          if (opts.bold) pdf.setFont(undefined,'bold'); else pdf.setFont(undefined,'normal');
            if (opts.color) pdf.setTextColor(...opts.color); else pdf.setTextColor(20,20,20);
          pdf.text(text, marginX, y, { maxWidth: pageWidth - marginX*2 });
          y += lineHeight;
        };
        // Header
        pdf.setFontSize(16); write(`Profile Analytics Report`, { bold: true });
        pdf.setFontSize(11); write(`User: ${fullName}`);
        write(`Scope: ${ dataScope==='me' ? 'My Data' : 'All Data' }`);
        write(`Generated: ${dayjs().format(DISPLAY_DATE_TIME)}`);
        y += 2; pdf.setDrawColor(180); pdf.line(marginX, y, pageWidth - marginX, y); y += 4;
        // KPIs
        write('KPIs (30 days):', { bold: true });
        const kpiPairs = [
          ['Bookings', String(kpis.bookings)],
          ['Booking Revenue', kpis.bookingRevenue.toFixed(2)],
          ['Policy Revenue', kpis.policyRevenue.toFixed(2)],
          ['Visa Revenue', kpis.visaRevenue.toFixed(2)],
          ['Passport Revenue', kpis.passportRevenue.toFixed(2)],
          ['Total Revenue', kpis.totalRevenue.toFixed(2)],
          ['Policies', String(kpis.policies)],
          ['Avg / Booking', kpis.avg.toFixed(2)],
          ['Clients Added', String(kpis.clients)],
          ['Visas', String(kpis.visas)],
          ['Passports', String(kpis.passports)],
          ['Itineraries', String(kpis.itineraries)]
        ];
        kpiPairs.forEach(([k,v]) => write(`${k}: ${v}`));
        y += 2; pdf.line(marginX, y, pageWidth - marginX, y); y += 4;
        // Sales Trend Table (last 14 days)
        write('Sales Trend (Last 14 days):', { bold: true });
        write('Date   | Bkgs | BookRev | PolRev | VisaRev | PassRev | TotalRev | AvgBk');
        salesTrend.slice(-14).forEach(r => write(`${dayjs(r.isoDate).format('DD/MM').padEnd(6)} | ${String(r.bookings).padStart(4)} | ${Number(r.bookingRevenue||0).toFixed(0).padStart(7)} | ${Number(r.policyRevenue||0).toFixed(0).padStart(7)} | ${Number(r.visaRevenue||0).toFixed(0).padStart(7)} | ${Number(r.passportRevenue||0).toFixed(0).padStart(7)} | ${Number(r.totalRevenue||r.revenue||0).toFixed(0).padStart(8)} | ${Number(r.avg||0).toFixed(0)}`));
        y += 2; pdf.line(marginX, y, pageWidth - marginX, y); y += 4;
        // Recent Activity
        if (activity.length) {
          write('Recent Activity (max 20):', { bold: true });
          activity.slice(0,20).forEach(a => write(`${dayjs(a.created_at).format('DD/MM/YYYY HH:mm')}  ${a.action} ${a.entity_type}`));
        }
        pdf.save(`profile-analytics-${fullName.replace(/\s+/g,'-').toLowerCase()}.pdf`);
        setSnackbar({open:true,message:'Report downloaded (fallback)',severity:'success'});
      } catch (err:any) {
        setSnackbar({open:true,message:`Fallback PDF failed: ${err.message||err}`,severity:'error'});
      }
    };

    try {
      const node = reportRef.current;
      if (!node) { setSnackbar({open:true,message:'Report element not found',severity:'error'}); return; }
      setSnackbar({open:true,message:'Generating PDF report...',severity:'info'});
      // Clone & sanitize to avoid unsupported CSS color() functions
      const clone = node.cloneNode(true) as HTMLElement;
      // Remove any style attributes using color( functions that html2canvas cannot parse
      clone.querySelectorAll('*').forEach(el => {
        const style = (el as HTMLElement).getAttribute('style') || '';
        if (/color\(/i.test(style)) (el as HTMLElement).setAttribute('style', style.replace(/color\([^)]*\)/gi,'#1976d2'));
      });
      // Offscreen container
      const temp = document.createElement('div');
      temp.style.position = 'fixed'; temp.style.left='-5000px'; temp.style.top='0'; temp.style.background='#fff'; temp.appendChild(clone);
      document.body.appendChild(temp);
      try {
        const canvas = await html2canvas(clone, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p','mm','a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - 10;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        if (imgHeight <= pageHeight - 10) {
          pdf.addImage(imgData,'PNG',5,5,imgWidth,imgHeight,'','FAST');
        } else {
          // paginate by slicing vertical segments
          let position = 0;
          const pageCanvas = document.createElement('canvas');
          const ctx = pageCanvas.getContext('2d');
          const ratio = canvas.width / imgWidth; // px per mm
          const sliceHeightPx = (pageHeight - 10) * ratio;
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeightPx;
          while (position < canvas.height) {
            const remaining = Math.min(sliceHeightPx, canvas.height - position);
            if (ctx) {
              ctx.clearRect(0,0,pageCanvas.width,pageCanvas.height);
              ctx.drawImage(canvas, 0, position, canvas.width, remaining, 0, 0, canvas.width, remaining);
              const sliceData = pageCanvas.toDataURL('image/png');
              pdf.addImage(sliceData,'PNG',5,5,imgWidth,(remaining/ratio),'','FAST');
              position += remaining;
              if (position < canvas.height) pdf.addPage();
            } else break;
          }
        }
        pdf.save(`profile-analytics-${fullName.replace(/\s+/g,'-').toLowerCase()}.pdf`);
      } finally {
        document.body.removeChild(temp);
      }
    } catch (e:any) {
      if (String(e?.message||e).includes('unsupported color function')) {
        // Fallback structured PDF without DOM rendering
        buildStructuredPdf();
      } else {
        setSnackbar({open:true,message:`PDF failed: ${e.message||e}`,severity:'error'});
      }
    }
  };

  if (loading) return <Box sx={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}><CircularProgress /></Box>;
  if (!profile) return <Box sx={{p:4}}>
    <Typography sx={{ mb: 1 }}>Profile initializing…</Typography>
    {!authUser && <Alert severity="info" sx={{ maxWidth: 520, mb:1 }}>Waiting for authentication session…</Alert>}
    {profileError && <Alert severity="error" sx={{ maxWidth: 640, mb:1 }}>Error: {profileError}</Alert>}
    {debugInfo && <Alert severity="info" sx={{ maxWidth: 640, fontFamily:'monospace', whiteSpace:'pre-wrap' }}>{JSON.stringify(debugInfo, null, 2)}</Alert>}
    <Stack direction="row" spacing={2} mt={2}>
      <Button variant="outlined" disabled={!authUser} onClick={()=> authUser && ensureProfile(authUser)}>Retry</Button>
      <Button variant="text" onClick={()=> { setDebugInfo(null); setProfileError(null); authUser && ensureProfile(authUser); }}>Clear & Retry</Button>
    </Stack>
    <Typography variant="caption" display="block" sx={{ mt:2, color:'text.secondary' }}>If insert policy missing, add: create policy "profiles_self_insert" on public.profiles for insert with check (auth.uid() = id);</Typography>
  </Box>;

  return (
    <Box sx={{ display:'flex', flexDirection:'column', minHeight:'100vh', bgcolor:'#f4f6f8' }}>
      <CssBaseline />
      <AppBar position="static" color="primary" elevation={3} sx={{ zIndex: (t)=>t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <Button component={NextLink} href="/" color="inherit" startIcon={<ArrowBackIcon />}>Dashboard</Button>
          <Typography variant="h6" sx={{ fontWeight: 600, flexGrow:1, ml: 1 }}>My Profile</Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={dataScope}
            onChange={(_,v)=> v && setDataScope(v)}
            color="secondary"
            sx={{ mr: 1, bgcolor:'rgba(255,255,255,0.1)', borderRadius:2, '& .MuiToggleButton-root': { color: 'white', borderColor:'rgba(255,255,255,0.3)' }, '& .Mui-selected': { bgcolor:'secondary.main', color:'white' } }}
          >
            <ToggleButton value="all">All Data</ToggleButton>
            <ToggleButton value="me">My Data</ToggleButton>
          </ToggleButtonGroup>
          {!edit && <Button color="inherit" startIcon={<EditIcon />} onClick={()=>setEdit(true)}>Edit</Button>}
          {edit && <Button color="inherit" startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>}
        </Toolbar>
      </AppBar>
  <Container suppressHydrationWarning maxWidth="xl" sx={{ py: 3, flexGrow:1 }} ref={reportRef}>
        {!mounted ? (
          <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height:'40vh' }}><CircularProgress /></Box>
        ) : (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item>
                  <Stack alignItems="center" spacing={1}>
                    <Avatar src={profile.avatar_url||''} sx={{ width:90, height:90, fontSize:'2rem', bgcolor:'primary.main' }}>{fullName.slice(0,1)}</Avatar>
                    {edit && (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" component="label" startIcon={<CloudUploadIcon />} disabled={uploadingAvatar} variant="outlined">
                          {uploadingAvatar ? 'Uploading...' : 'Avatar'}
                          <input hidden type="file" accept="image/*" onChange={handleAvatarUpload} />
                        </Button>
                        {profile.avatar_url && <Button size="small" color="error" variant="outlined" onClick={handleRemoveAvatar}>Remove</Button>}
                      </Stack>
                    )}
                  </Stack>
                </Grid>
                <Grid item xs>
                  <Stack spacing={2}>
                    <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
                      {editableField('first_name','First Name')}
                      {editableField('last_name','Last Name')}
                      {editableField('display_name','Display Name')}
                      {editableField('phone','Phone')}
                    </Stack>
                    <Stack direction={{ xs:'column', md:'row' }} spacing={2}>
                      {editableField('timezone','Timezone')}
                      {editableField('locale','Locale')}
                      {editableField('currency','Currency')}
                      {editableField('default_view','Default View')}
                    </Stack>
                    <Stack direction={{ xs:'column', md:'row' }} spacing={2} alignItems="center">
                      <FormControlLabel control={<Switch checked={(form.theme||'light')==='dark'} onChange={handleThemeToggle} disabled={!edit} />} label={(form.theme||'light')==='dark' ? 'Dark Mode' : 'Light Mode'} />
                      {editableField('date_format','Date Format')}
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
      <Grid item xs={12}>
        <Paper elevation={3} sx={{ p: 0, borderRadius:2, display:'flex', flexDirection:'column' }}>
          <Box sx={{ px:2, pt:1, display:'flex', alignItems:'center', gap:2 }}>
            <Tabs value={tab} onChange={(e,v)=>setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ flexGrow:1 }}>
              <Tab label="Overview" icon={<InsightsIcon />} iconPosition="start" />
              <Tab label="Sales" icon={<InsightsIcon />} iconPosition="start" />
              <Tab label="Activity" icon={<HistoryIcon />} iconPosition="start" />
            </Tabs>
            <Button onClick={handleDownloadReport} startIcon={<PictureAsPdfIcon />} size="small" variant="outlined" sx={{ whiteSpace:'nowrap' }}>Download PDF</Button>
          </Box>
          <Divider />
          <Box sx={{ p:3 }}>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper elevation={3} sx={{ p:3, borderRadius:2, height:'100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:0 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600, mb:0 }}>KPIs (30d)</Typography>
                <Typography variant="caption" color="text.secondary">Scope: {(dataScope==='me' && metrics.length)?'My Data':'All Data'}{(dataScope==='me' && !metrics.length)?' (no user metrics, showing global)':''}</Typography>
              </Stack>
              <Grid container spacing={2}>
                {[
                  {label:(dataScope==='me' && metrics.length)?'My Bookings':'Bookings', val:kpis.bookings, color:'primary.main'},
                  {label:(dataScope==='me' && metrics.length)?'My Booking Revenue':'Booking Revenue', val:kpis.bookingRevenue.toFixed(2), color:'secondary.main'},
                  {label:'Policy Revenue', val:kpis.policyRevenue.toFixed(2), color:'info.main'},
                  {label:'Visa Revenue', val:kpis.visaRevenue.toFixed(2), color:'warning.main'},
                  {label:'Passport Revenue', val:kpis.passportRevenue.toFixed(2), color:'error.main'},
                  {label:'Total Revenue', val:kpis.totalRevenue.toFixed(2), color:'success.main'},
                  {label:(dataScope==='me' && metrics.length)?'My Policies':'Policies', val:kpis.policies, color:'info.dark'},
                  {label:'Avg / Booking', val:kpis.avg.toFixed(2), color:'success.dark'}
                ].map(k => (
                  <Grid item xs={12} key={k.label}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{k.label}</Typography>
                      <Typography variant="h6" sx={{ fontWeight:700, color:k.color }}>{k.val}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={9}>
            <Paper elevation={3} sx={{ p:3, borderRadius:2, height:'100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600, mb:0 }}>Sales Trend (30d)</Typography>
                <Typography variant="caption" color="text.secondary">Scope: {(dataScope==='me' && metrics.length)?'My Data':'All Data'}{(dataScope==='me' && !metrics.length)?' (fallback global)':''}</Typography>
              </Stack>
              <Box sx={{ height:240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesTrend} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="displayDate" tick={{ fontSize:12 }} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize:12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize:12 }} />
                    <RechartsTooltip formatter={(val:any, name:any)=> {
                      if (['bookingRevenue','policyRevenue','visaRevenue','passportRevenue','totalRevenue','revenue','avg'].includes(name)) {
                        if (name==='avg') return [`$${Number(val).toFixed(0)}`,'Avg Booking'];
                        return [`$${Number(val).toFixed(0)}`, name.replace(/([A-Z])/g,' $1').replace(/^./,(c: string)=>c.toUpperCase())];
                      }
                      return val;
                    }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#1976d2" strokeWidth={2} dot={false} name="Bookings" />
                    <Line yAxisId="right" type="monotone" dataKey="bookingRevenue" stroke="#9c27b0" strokeWidth={2} dot={false} name="Booking Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="policyRevenue" stroke="#ff9800" strokeWidth={2} dot={false} name="Policy Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="visaRevenue" stroke="#4caf50" strokeWidth={2} dot={false} name="Visa Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="passportRevenue" stroke="#f44336" strokeWidth={2} dot={false} name="Passport Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="totalRevenue" stroke="#673ab7" strokeDasharray="4 3" strokeWidth={2} dot={false} name="Total Revenue" />
                    <Line yAxisId="right" type="monotone" dataKey="avg" stroke="#2e7d32" strokeDasharray="2 4" strokeWidth={2} dot={false} name="Avg Booking" />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
              <Box sx={{ mt:2 }}>
                <Grid container spacing={2}>
                  {departmentSummary.map(ds => (
                    <Grid item xs={6} sm={4} md={3} key={ds.label}>
                      <Box sx={{ p:1, border:'1px solid', borderColor:'divider', borderRadius:1 }}>
                        <Typography variant="caption" color="text.secondary">{ds.label}</Typography>
                        <Typography variant="subtitle1" sx={{ fontWeight:600, color: ds.color }}>{ds.value}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:1 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600, mb:0 }}>Sales Metrics (Daily) – All Departments</Typography>
            {(dataScope==='me' && metrics.length) && <Typography variant="caption" color="text.secondary">User scope: non-booking revenues = 0 (not tracked per-user yet)</Typography>}
            {(dataScope==='me' && !metrics.length) && <Typography variant="caption" color="warning.main">No user metrics • global shown</Typography>}
          </Stack>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Stack direction={{ xs:'column', sm:'row' }} spacing={2} alignItems={{ xs:'stretch', sm:'center' }} sx={{ mb:2 }}>
              <DatePicker format={DISPLAY_DATE} label="From" value={salesFrom} onChange={setSalesFrom} slotProps={{ textField: { size:'small' } }} />
              <DatePicker format={DISPLAY_DATE} label="To" value={salesTo} onChange={setSalesTo} slotProps={{ textField: { size:'small' } }} />
              {(salesFrom || salesTo) && <Button size="small" onClick={()=>{ setSalesFrom(null); setSalesTo(null); }}>Clear</Button>}
              <Typography variant="caption" color="text.secondary" sx={{ ml:'auto' }}>{filteredSalesTrend.length} day(s)</Typography>
            </Stack>
          </LocalizationProvider>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Bookings</TableCell>
                <TableCell align="right">Booking Rev</TableCell>
                <TableCell align="right">Policy Rev</TableCell>
                <TableCell align="right">Visa Rev</TableCell>
                <TableCell align="right">Passport Rev</TableCell>
                <TableCell align="right">Total Rev</TableCell>
                <TableCell align="right">Avg Book Val</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSalesTrend.map(r => (
                <TableRow key={r.date}>
                  <TableCell>{dayjs(r.isoDate).format(DISPLAY_DATE)}</TableCell>
                  <TableCell>{r.bookings}</TableCell>
                  <TableCell align="right">{Number(r.bookingRevenue||0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.policyRevenue||0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.visaRevenue||0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.passportRevenue||0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.totalRevenue||r.revenue||0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(r.avg||0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {!filteredSalesTrend.length && <TableRow><TableCell colSpan={8} align="center">No data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}

  {tab === 2 && (
        <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb:2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600, mb:0 }}>Recent Activity</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button size="small" variant="outlined" onClick={()=>fetchUserActivity(true)} disabled={activityLoading}>{activityLoading ? 'Loading...' : 'Refresh'}</Button>
              <Typography variant="caption" color="text.secondary">{activity.length} event{activity.length!==1?'s':''}</Typography>
            </Stack>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activity.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell>{dayjs(a.created_at).format(DISPLAY_DATE_TIME)}</TableCell>
                  <TableCell>{a.action}</TableCell>
                  <TableCell>{a.entity_type}</TableCell>
                  <TableCell>{a.meta ? JSON.stringify(a.meta) : ''}</TableCell>
                </TableRow>
              ))}
              {!activityLoading && !activity.length && (
                <TableRow><TableCell colSpan={4} align="center">No activity found for this user.</TableCell></TableRow>
              )}
              {activityLoading && (
                <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

  {/* API Keys tab content removed */}
              </Box>
            </Paper>
          </Grid>
  </Grid>
  )}
      </Container>
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={()=>setSnackbar(s=>({...s,open:false}))}><Alert severity={snackbar.severity||'info'}>{snackbar.message}</Alert></Snackbar>
    </Box>
  );
};

export default ProfilePage;
