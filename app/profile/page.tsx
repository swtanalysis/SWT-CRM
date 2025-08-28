'use client'
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Profile, UserDailyMetrics, UserActivity } from '../../lib/types';
import { Box, Tabs, Tab, Avatar, Typography, Grid, Paper, TextField, Button, Stack, Alert, Snackbar, AppBar, Toolbar, Container, CssBaseline, CircularProgress, FormControlLabel, Switch, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import { Save as SaveIcon, CloudUpload as CloudUploadIcon, Security as SecurityIcon, Insights as InsightsIcon, History as HistoryIcon, Edit as EditIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import NextLink from 'next/link';
import dayjs from 'dayjs';

const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [tab, setTab] = useState(0);
  const [metrics, setMetrics] = useState<UserDailyMetrics[]>([]);
  const [activity, setActivity] = useState<UserActivity[]>([]);
  // Removed API keys feature as requested
  const [snackbar, setSnackbar] = useState<{open:boolean; message:string; severity?:'success'|'error'|'info'|'warning'}>({open:false, message:''});
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

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
      const since = dayjs().subtract(30,'day').format('YYYY-MM-DD');
      const { data: met } = await supabase.from('user_metrics_daily').select('*').eq('user_id', authUser.id).gte('date', since).order('date');
      if (met) setMetrics(met as any);
      const { data: acts } = await supabase.from('user_activity').select('*').eq('user_id', authUser.id).order('created_at',{ ascending:false }).limit(50);
      if (acts) setActivity(acts as any);
  // API keys removed
    })();
  }, [authUser, ensureProfile]);

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

  const kpis = useMemo(()=> {
    if (!metrics.length) return { bookings:0, revenue:0, policies:0, avg:0 };
    const bookings = metrics.reduce((s,m)=>s+m.bookings_count,0);
    const revenue = metrics.reduce((s,m)=>s+Number(m.revenue_sum||0),0);
    const policies = metrics.reduce((s,m)=>s+m.policies_count,0);
    const avg = bookings ? revenue / bookings : 0;
    return { bookings, revenue, policies, avg };
  },[metrics]);

  const editableField = (name: keyof Profile, label: string, type: string = 'text') => (
    <TextField size="small" label={label} value={(form as any)[name] || ''} type={type} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))} fullWidth disabled={!edit} />
  );

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
        <Toolbar>
          <Button component={NextLink} href="/" color="inherit" startIcon={<ArrowBackIcon />}>Dashboard</Button>
          <Typography variant="h6" sx={{ fontWeight: 600, ml: 2, flexGrow:1 }}>My Profile</Typography>
          {!edit && <Button color="inherit" startIcon={<EditIcon />} onClick={()=>setEdit(true)}>Edit</Button>}
          {edit && <Button color="inherit" startIcon={<SaveIcon />} onClick={handleSave}>Save</Button>}
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3, flexGrow:1 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item>
                  <Stack alignItems="center" spacing={1}>
                    <Avatar src={profile.avatar_url||''} sx={{ width:90, height:90, fontSize:'2rem', bgcolor:'primary.main' }}>{(profile.display_name||profile.first_name||'U').slice(0,1)}</Avatar>
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
            <Paper elevation={3} sx={{ p: 0, borderRadius:2 }}>
              <Tabs value={tab} onChange={(e,v)=>setTab(v)} variant="scrollable" allowScrollButtonsMobile sx={{ borderBottom:1, borderColor:'divider', px:2 }}>
                <Tab label="Overview" icon={<InsightsIcon />} iconPosition="start" />
                <Tab label="Sales" icon={<InsightsIcon />} iconPosition="start" />
                <Tab label="Productivity" icon={<SecurityIcon />} iconPosition="start" />
                <Tab label="Activity" icon={<HistoryIcon />} iconPosition="start" />
              </Tabs>
              <Box sx={{ p:3 }}>

      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper elevation={3} sx={{ p:3, borderRadius:2, height:'100%' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600 }}>KPIs (30d)</Typography>
              <Grid container spacing={2}>
                {[{label:'Bookings', val:kpis.bookings, color:'primary.main'}, {label:'Revenue', val:kpis.revenue.toFixed(2), color:'secondary.main'}, {label:'Policies', val:kpis.policies, color:'info.main'}, {label:'Avg / Booking', val:kpis.avg.toFixed(2), color:'success.main'}].map(k => (
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
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600 }}>Sales Trend (placeholder)</Typography>
              <Box sx={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:'text.secondary', border:'1px dashed', borderColor:'divider', borderRadius:1 }}>Add chart</Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600 }}>Sales Metrics (Daily)</Typography>
          <Table size="small">
            <TableHead><TableRow><TableCell>Date</TableCell><TableCell>Bookings</TableCell><TableCell>Revenue</TableCell><TableCell>Policies</TableCell><TableCell>Avg Value</TableCell></TableRow></TableHead>
            <TableBody>
              {metrics.map(m => (
                <TableRow key={m.date}><TableCell>{m.date}</TableCell><TableCell>{m.bookings_count}</TableCell><TableCell>{Number(m.revenue_sum).toFixed(2)}</TableCell><TableCell>{m.policies_count}</TableCell><TableCell>{Number(m.avg_booking_value).toFixed(2)}</TableCell></TableRow>
              ))}
              {!metrics.length && <TableRow><TableCell colSpan={5} align="center">No metrics</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 2 && (
        <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600 }}>Productivity (placeholder)</Typography>
          <Box sx={{ height:180, display:'flex', justifyContent:'center', alignItems:'center', color:'text.secondary', border:'1px dashed', borderColor:'divider', borderRadius:1 }}>Add heatmap / response time charts</Box>
        </Paper>
      )}

      {tab === 3 && (
        <Paper elevation={3} sx={{ p:3, borderRadius:2 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight:600 }}>Recent Activity</Typography>
          <Table size="small">
            <TableHead><TableRow><TableCell>Time</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
            <TableBody>
              {activity.map(a => (
                <TableRow key={a.id}><TableCell>{dayjs(a.created_at).format('YYYY-MM-DD HH:mm')}</TableCell><TableCell>{a.action}</TableCell><TableCell>{a.entity_type}</TableCell><TableCell>{a.meta ? JSON.stringify(a.meta) : ''}</TableCell></TableRow>
              ))}
              {!activity.length && <TableRow><TableCell colSpan={4} align="center">No activity</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}

  {/* API Keys tab content removed */}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={()=>setSnackbar(s=>({...s,open:false}))}><Alert severity={snackbar.severity||'info'}>{snackbar.message}</Alert></Snackbar>
    </Box>
  );
};

export default ProfilePage;
