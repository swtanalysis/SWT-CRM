"use client";
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Itinerary, ItineraryDay, ItineraryActivity, Client } from '../lib/types';
import {
  Box, Grid, Paper, Typography, TextField, Button, IconButton, Stack, List, ListItem, ListItemButton, ListItemText,
  ListSubheader, Divider, Tooltip, Chip, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem,
  Select, FormControl, InputLabel, Snackbar, Alert
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, ContentCopy as ContentCopyIcon, Download as DownloadIcon, Save as SaveIcon, FilterList as FilterListIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface Props { clients: Client[]; }

// Utility: generate days between dates inclusive
const buildDays = (start: string, end: string): ItineraryDay[] => {
  if (!start || !end) return [];
  const s = dayjs(start); const e = dayjs(end);
  if (!s.isValid() || !e.isValid() || e.isBefore(s)) return [];
  const days: ItineraryDay[] = [];
  for (let d = s; d.isBefore(e) || d.isSame(e, 'day'); d = d.add(1,'day')) {
    days.push({ date: d.format('YYYY-MM-DD'), activities: [] });
  }
  return days;
};

const emptyItinerary = (clientId: string | null = null): Itinerary => ({
  id: '',
  client_id: clientId || null,
  title: 'New Itinerary',
  start_date: dayjs().format('YYYY-MM-DD'),
  end_date: dayjs().add(2,'day').format('YYYY-MM-DD'),
  travelers: 1,
  currency: 'USD',
  days: buildDays(dayjs().format('YYYY-MM-DD'), dayjs().add(2,'day').format('YYYY-MM-DD')),
  status: 'Draft'
});

const activityTypes = ['Flight','Hotel','Transfer','Tour','Meal','Activity','Note'];

const ItinerariesView: React.FC<Props> = ({ clients }) => {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Itinerary | null>(null);
  const [tab, setTab] = useState(0);
  const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity?: 'success' | 'error' | 'info' | 'warning'}>({open:false, message:''});
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [templateSource, setTemplateSource] = useState<string>('');
  // Track save sequence to avoid stale async overwrites
  const saveSeqRef = useRef(0);
  const latestAppliedRef = useRef(0);
  // Skip autosave immediately after creation until user changes something meaningful
  const freshlyCreatedRef = useRef(false);
  // Track local change version to prevent stale save responses clobbering newer edits
  const changeVersionRef = useRef(0);
  const bumpVersion = () => { changeVersionRef.current++; };
  // Track deleted activity IDs until server confirms deletion
  const deletedActivityIdsRef = useRef<Set<string>>(new Set());
  // Track currently focused field (to avoid overwriting in-progress typing)
  const focusedFieldRef = useRef<string|null>(null);

  const fetchItineraries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('itineraries').select('*').order('created_at',{ ascending: false });
    if (error) { setSnackbar({open:true, message:`Fetch error: ${error.message}`, severity:'error'}); }
    else setItineraries(data as Itinerary[] || []);
    setLoading(false);
  },[]);

  useEffect(()=>{ fetchItineraries(); },[fetchItineraries]);

  // Derived list
  const filtered = useMemo(()=> itineraries.filter(i => {
    if (search) {
      const s = search.toLowerCase();
      const clientName = clients.find(c => c.id === i.client_id)?.first_name?.toLowerCase() + ' ' + clients.find(c => c.id === i.client_id)?.last_name?.toLowerCase();
      if (!(i.title.toLowerCase().includes(s) || (clientName && clientName.includes(s)))) return false;
    }
    if (filterClient && i.client_id !== filterClient) return false;
    return true;
  }), [itineraries, search, filterClient, clients]);

  // Cost aggregation
  const costSummary = useMemo(()=>{
    if (!selected) return { total:0, byType: {} as Record<string, number>, perTraveler:0 };
    const byType: Record<string, number> = {};
    selected.days.forEach(d => d.activities.forEach(a => { if (a.cost) byType[a.type || 'Other'] = (byType[a.type || 'Other']||0) + (a.cost||0); }));
    const total = Object.values(byType).reduce((s,n)=>s+n,0);
    return { total, byType, perTraveler: selected.travelers ? total / selected.travelers : total };
  },[selected]);

  // Autosave (debounced)
  const scheduleSave = () => {
    if (!selected || !selected.id) return; // only autosave existing
    if (focusedFieldRef.current) return; // defer until blur to avoid overwriting in-progress typing
    if (freshlyCreatedRef.current) {
      // Previously we skipped the first change after creation causing client selection not to persist.
      // Now we just clear the flag and continue to schedule the save.
      freshlyCreatedRef.current = false;
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(()=> { saveSelected(); }, 800);
  };

  const handleFieldChange = (field: keyof Itinerary, value: any) => {
    bumpVersion();
    setSelected(prev => {
      if (!prev) return prev;
      let next = { ...prev, [field]: value } as Itinerary;
      if (field === 'start_date' || field === 'end_date') {
        next.days = buildDays(field === 'start_date' ? value : prev.start_date, field === 'end_date' ? value : prev.end_date);
      }
      return next;
    });
    scheduleSave();
  };

  const addActivity = (dayIndex: number) => {
    bumpVersion();
    setSelected(prev => {
      if (!prev) return prev;
      const days = [...prev.days];
      const target = { ...days[dayIndex] };
      const newAct: ItineraryActivity = { id: Math.random().toString(36).slice(2), time:'', type:'Activity', description:'', location:'', cost:0, currency: prev.currency };
      target.activities = [...(target.activities||[]), newAct];
      days[dayIndex] = target;
      return { ...prev, days };
    });
    scheduleSave();
  };

  const updateActivity = (dayIndex: number, actId: string, patch: Partial<ItineraryActivity>) => {
    bumpVersion();
    setSelected(prev => {
      if (!prev) return prev;
      const days = [...prev.days];
      const target = { ...days[dayIndex] };
      target.activities = target.activities.map(a => a.id === actId ? { ...a, ...patch } : a);
      days[dayIndex] = target;
      return { ...prev, days };
    });
    scheduleSave();
  };

  const removeActivity = (dayIndex: number, actId: string) => {
    bumpVersion();
    setSelected(prev => {
      if (!prev) return prev;
      const days = [...prev.days];
      const target = { ...days[dayIndex] };
      target.activities = target.activities.filter(a => a.id !== actId);
      days[dayIndex] = target;
      if (actId) deletedActivityIdsRef.current.add(actId);
      saveSelected({ days }, { forceApply: true });
      return { ...prev, days };
    });
  };

  const createItinerary = async (base?: Itinerary) => {
    const baseItin = base
      ? { ...base, id: '', client_id: base.client_id || null, created_at: undefined, total_cost: undefined, version: (base as any).version || 1 }
      : emptyItinerary();
    // Remove transient fields / empty id so DB can generate UUID
    const { id: _omitId, created_at: _omitCreated, total_cost: _omitTotal, ...rest } = baseItin as any;
    const payload: any = { ...rest, total_cost: 0 };
    if (!payload.client_id) payload.client_id = null;
    // Safety: ensure we never pass an empty string uuid
    if (!payload.id) delete payload.id;
    const { data, error } = await supabase.from('itineraries').insert([payload]).select().single();
    if (error) { setSnackbar({open:true, message:`Create failed: ${error.message}`, severity:'error'}); return; }
  setItineraries(prev => [data as Itinerary, ...prev]);
  bumpVersion();
  setSelected(data as Itinerary);
  freshlyCreatedRef.current = true; // prevent immediate autosave cycle wiping defaults
    setSnackbar({open:true, message:'Itinerary created', severity:'success'});
  };

  const saveSelected = async (override?: Partial<Itinerary>, opts?: { forceApply?: boolean }) => {
    if (!selected) return;
    setSaving(true);
    const mutationId = ++saveSeqRef.current;
    const snapshotVersion = changeVersionRef.current; // capture version at snapshot time
    // Merge any optimistic override (e.g., client_id change) into snapshot for this save
    const snapshot = { ...selected, ...(override||{}) } as Itinerary;
    const { id, ...rest } = snapshot;
    const { error, data } = await supabase.from('itineraries').update({ ...rest, total_cost: costSummary.total }).eq('id', id).select().single();
    if (error) {
      if (mutationId > latestAppliedRef.current) latestAppliedRef.current = mutationId; // advance to avoid blocking future
      setSnackbar({open:true, message:`Save failed: ${error.message}`, severity:'error'});
      setSaving(false);
      return;
    }
    // Apply only if this mutation is the latest
  if (mutationId >= latestAppliedRef.current && (opts?.forceApply || snapshotVersion === changeVersionRef.current)) {
      latestAppliedRef.current = mutationId;
      // Merge server response with any optimistic local activities that may not yet be persisted
      setItineraries(prev => prev.map(i => {
        if (i.id !== id) return i;
        const server = data as Itinerary;
        if (!i.days || !server.days) return server;
        const mergedDays = server.days.map((sd, idx) => {
          const localDay = i.days[idx];
          if (!localDay) return sd;
          const serverActs = (sd.activities||[]);
          const localActs = (localDay.activities||[]);
          const map: Record<string, any> = {};
          // Put local first so in-progress typing wins over stale server snapshot
          localActs.forEach(a => { const key = a.id || JSON.stringify(a); map[key] = a; });
          serverActs.forEach(a => { if (a.id && deletedActivityIdsRef.current.has(a.id)) return; const key = a.id || JSON.stringify(a); if (!map[key]) map[key] = a; });
          return { ...sd, activities: Object.values(map) };
        });
        // Clean up confirmed deletions (ids no longer in server)
        deletedActivityIdsRef.current.forEach(delId => {
          const stillExists = mergedDays.some(d => (d.activities||[]).some(a => a.id === delId));
          if (!stillExists) deletedActivityIdsRef.current.delete(delId);
        });
        return { ...(data as Itinerary), days: mergedDays };
      }));
      setSelected(prev => {
        if (!prev || prev.id !== id) return prev;
        const server = data as Itinerary;
        if (!prev.days || !server.days) return server;
        const mergedDays = server.days.map((sd, idx) => {
          const localDay = prev.days[idx];
          if (!localDay) return sd;
          const serverActs = (sd.activities||[]);
          const localActs = (localDay.activities||[]);
          const map: Record<string, any> = {};
          localActs.forEach(a => { const key = a.id || JSON.stringify(a); map[key] = a; });
          serverActs.forEach(a => { if (a.id && deletedActivityIdsRef.current.has(a.id)) return; const key = a.id || JSON.stringify(a); if (!map[key]) map[key] = a; });
          return { ...sd, activities: Object.values(map) };
        });
        deletedActivityIdsRef.current.forEach(delId => {
          const stillExists = mergedDays.some(d => (d.activities||[]).some(a => a.id === delId));
          if (!stillExists) deletedActivityIdsRef.current.delete(delId);
        });
        return { ...server, days: mergedDays };
      });
    }
    setSaving(false);
  };

  const duplicateItinerary = async () => {
    if (!selected) return;
    const copy = { ...selected, id: '', title: selected.title + ' (Copy)' };
    await createItinerary(copy);
  };

  const newVersion = async () => {
    if (!selected) return;
    const rootId = (selected as any).parent_itinerary_id || selected.id;
    const version = ((selected as any).version || 1) + 1;
    const copy: any = { ...selected, id:'', parent_itinerary_id: rootId, version, title: selected.title.replace(/ v\d+$/,'') + ` v${version}` };
    await createItinerary(copy);
  };

  const deleteItinerary = async (id: string) => {
    if (!window.confirm('Delete this itinerary?')) return;
    const { error } = await supabase.from('itineraries').delete().eq('id', id);
    if (error) { setSnackbar({open:true, message:`Delete failed: ${error.message}`, severity:'error'}); return; }
    setItineraries(prev => prev.filter(i => i.id !== id));
    if (selected?.id === id) setSelected(null);
    setSnackbar({open:true, message:'Deleted', severity:'success'});
  };

  const exportPdf = () => {
    if (!selected) return;
    // Use comprehensive hidden printable container
    const node = document.getElementById('itinerary-print-full');
    if (!node) return;
    setSnackbar({open:true, message:'Generating PDF...', severity:'info'});
    setTimeout(()=>{
      html2canvas(node as HTMLElement, { scale: 2 }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p','mm','a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth;
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;
        pdf.addImage(imgData,'PNG',0,position,imgWidth,imgHeight);
        heightLeft -= pageHeight;
        while (heightLeft > 0) {
          position -= pageHeight;
            pdf.addPage();
            pdf.addImage(imgData,'PNG',0,position,imgWidth,imgHeight);
            heightLeft -= pageHeight;
        }
        pdf.save(`${selected.title.replace(/\s+/g,'-').toLowerCase()}.pdf`);
        setSnackbar({open:true, message:'PDF downloaded', severity:'success'});
      }).catch(err => {
        setSnackbar({open:true, message:`PDF failed: ${err.message||err}`, severity:'error'});
      });
    },30);
  };

  const templateItineraries = useMemo(()=> itineraries.filter(i => (i as any).is_template), [itineraries]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p:2, height:'100%', display:'flex', flexDirection:'column', gap:1 }}>
          <Typography variant="h6" sx={{ fontWeight:'bold' }}>Itineraries</Typography>
          <TextField size="small" label="Search" value={search} onChange={e=>setSearch(e.target.value)} />
          <FormControl size="small">
            <InputLabel>Client</InputLabel>
            <Select label="Client" value={filterClient} onChange={e=>setFilterClient(e.target.value)}>
              <MenuItem value=""><em>All</em></MenuItem>
              {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</MenuItem>)}
            </Select>
          </FormControl>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="contained" startIcon={<AddIcon />} onClick={()=>createItinerary()}>New</Button>
            <Tooltip title="Create from Template">
              <IconButton color="primary" onClick={()=>setShowNewDialog(true)}><FilterListIcon /></IconButton>
            </Tooltip>
          </Stack>
          <Divider sx={{ my:1 }} />
          <List dense sx={{ flexGrow:1, overflowY:'auto' }}>
            {loading && <ListItem><ListItemText primary="Loading..." /></ListItem>}
            {!loading && filtered.map(i => (
              <ListItem key={i.id} disablePadding secondaryAction={
                <Stack direction="row" spacing={0}>
                  <Tooltip title="Duplicate"><IconButton size="small" onClick={(e)=>{ e.stopPropagation(); setSelected(i); duplicateItinerary(); }}><ContentCopyIcon fontSize="inherit" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" onClick={(e)=>{ e.stopPropagation(); deleteItinerary(i.id); }}><DeleteIcon fontSize="inherit" color="error" /></IconButton></Tooltip>
                </Stack>
              }>
                <ListItemButton selected={selected?.id === i.id} onClick={()=>setSelected(i)}>
                  <ListItemText primary={i.title} secondary={`${dayjs(i.start_date).format('MMM D')} - ${dayjs(i.end_date).format('MMM D')}`} />
                </ListItemButton>
              </ListItem>
            ))}
            {!loading && filtered.length === 0 && <ListItem><ListItemText primary="No itineraries" /></ListItem>}
          </List>
        </Paper>
      </Grid>
      <Grid item xs={12} md={9}>
        <Paper sx={{ p:2, minHeight: '70vh' }} id="itinerary-export">
          {!selected && <Typography color="text.secondary">Select or create an itinerary.</Typography>}
          {selected && (
            <Box>
              <Stack direction={{ xs:'column', md:'row' }} spacing={2} alignItems={{ md:'center' }} justifyContent="space-between" mb={2}>
                <TextField label="Title" value={selected.title} 
                  onFocus={()=>{ focusedFieldRef.current='title'; }}
                  onBlur={()=>{ 
                    if (focusedFieldRef.current==='title') focusedFieldRef.current=null; 
                    // Save once after user finishes editing title
                    scheduleSave();
                  }}
                  onChange={e=>{ bumpVersion(); setSelected(p=> p? { ...p, title: e.target.value }: p); /* defer save until blur to prevent last char loss */ }} 
                  fullWidth 
                />
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Save Now"><span><IconButton color="primary" onClick={()=>saveSelected()} disabled={saving}><SaveIcon /></IconButton></span></Tooltip>
                  <Tooltip title="New Version"><IconButton onClick={newVersion}><EditIcon /></IconButton></Tooltip>
                  <Tooltip title="Export PDF"><IconButton onClick={exportPdf}><DownloadIcon /></IconButton></Tooltip>
                </Stack>
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}><DatePicker label="Start" value={dayjs(selected.start_date)} onChange={d=> { if (!d) return; handleFieldChange('start_date', d.format('YYYY-MM-DD')); }} slotProps={{ textField:{ size:'small', fullWidth:true } }} /></Grid>
                <Grid item xs={12} md={3}><DatePicker label="End" value={dayjs(selected.end_date)} onChange={d=> { if (!d) return; handleFieldChange('end_date', d.format('YYYY-MM-DD')); }} slotProps={{ textField:{ size:'small', fullWidth:true } }} /></Grid>
                <Grid item xs={12} md={4}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Client</InputLabel>
                    <Select label="Client" value={selected.client_id || ''} onChange={e=>{
                      const val = (e.target.value as string) || '';
                      const newId = val || null;
                      bumpVersion();
                      setSelected(p=> p? { ...p, client_id: newId }: p);
                      setItineraries(list => list.map(i => i.id === selected?.id ? { ...i, client_id: newId } : i));
                      // Save with override so we don't lose change due to stale selected in async
                      saveSelected({ client_id: newId });
                    }}>
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {clients.map(c => <MenuItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6} md={2}><TextField size="small" label="Travelers" type="number" value={selected.travelers} onChange={e=>{ bumpVersion(); setSelected(p=> p? { ...p, travelers: parseInt(e.target.value)||0 }: p); scheduleSave(); }} fullWidth /></Grid>
                <Grid item xs={6} md={2}><TextField size="small" label="Currency" value={selected.currency} onChange={e=>{ bumpVersion(); setSelected(p=> p? { ...p, currency: e.target.value }: p); scheduleSave(); }} fullWidth /></Grid>
                <Grid item xs={12} md={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={selected.status || ''} label="Status" onChange={e=>{ bumpVersion(); setSelected(p=> p? { ...p, status: e.target.value }: p); scheduleSave(); }}>
                      <MenuItem value="Draft">Draft</MenuItem>
                      <MenuItem value="Confirmed">Confirmed</MenuItem>
                      <MenuItem value="Archived">Archived</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Tabs value={tab} onChange={(e,v)=>setTab(v)} sx={{ mt:2 }} variant="scrollable" allowScrollButtonsMobile>
                <Tab label="Days" />
                <Tab label={`Pricing (${costSummary.total.toFixed(2)})`} />
              </Tabs>
              {tab === 0 && (
                <Box sx={{ mt:2 }}>
                  <Stack spacing={2}>
                    {selected.days.map((d, idx) => (
                      <Paper key={d.date} variant="outlined" sx={{ p:2 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="subtitle1" sx={{ fontWeight:'bold' }}>{dayjs(d.date).format('ddd, MMM D')}</Typography>
                          <Button size="small" startIcon={<AddIcon />} onClick={()=>addActivity(idx)}>Add Activity</Button>
                        </Stack>
                        <Stack spacing={1}>
                          {d.activities.map(a => (
                            <Paper key={a.id} variant="outlined" sx={{ p:1.5 }}>
                              <Grid container spacing={1}>
                                <Grid item xs={12} md={2}><TextField size="small" label="Time" value={a.time||''} onChange={e=>updateActivity(idx,a.id!,{ time:e.target.value })} placeholder="09:30" /></Grid>
                                <Grid item xs={12} md={2}>
                                  <FormControl size="small" fullWidth>
                                    <InputLabel>Type</InputLabel>
                                    <Select label="Type" value={a.type||''} onChange={e=>updateActivity(idx,a.id!,{ type:e.target.value })}>
                                      {activityTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                    </Select>
                                  </FormControl>
                                </Grid>
                                <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Description" value={a.description||''} onChange={e=>updateActivity(idx,a.id!,{ description:e.target.value })} /></Grid>
                                <Grid item xs={12} md={2}><TextField size="small" fullWidth label="Location" value={a.location||''} onChange={e=>updateActivity(idx,a.id!,{ location:e.target.value })} /></Grid>
                                <Grid item xs={6} md={2}><TextField size="small" fullWidth type="number" label="Cost" value={a.cost ?? ''} onChange={e=>updateActivity(idx,a.id!,{ cost: parseFloat(e.target.value)||0 })} /></Grid>
                                <Grid item xs={6} md={1} sx={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
                                  <Tooltip title="Remove"><IconButton color="error" onClick={()=>removeActivity(idx,a.id!)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                </Grid>
                              </Grid>
                            </Paper>
                          ))}
                          {d.activities.length === 0 && <Typography variant="body2" color="text.secondary">No activities yet.</Typography>}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}
              {tab === 1 && (
                <Box sx={{ mt:2 }}>
                  <Typography variant="h6" gutterBottom>Pricing Summary</Typography>
                  <Stack spacing={1}>
                    {Object.entries(costSummary.byType).map(([t,v]) => (
                      <Paper key={t} variant="outlined" sx={{ p:1, display:'flex', justifyContent:'space-between' }}>
                        <Typography>{t}</Typography>
                        <Typography>{selected.currency} {v.toFixed(2)}</Typography>
                      </Paper>
                    ))}
                    <Divider />
                    <Paper variant="outlined" sx={{ p:1, display:'flex', justifyContent:'space-between', bgcolor:'action.hover' }}>
                      <Typography sx={{ fontWeight:'bold' }}>Total</Typography>
                      <Typography sx={{ fontWeight:'bold' }}>{selected.currency} {costSummary.total.toFixed(2)}</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p:1, display:'flex', justifyContent:'space-between' }}>
                      <Typography>Per Traveler</Typography>
                      <Typography>{selected.currency} {costSummary.perTraveler.toFixed(2)}</Typography>
                    </Paper>
                  </Stack>
                </Box>
              )}
            </Box>
          )}
        </Paper>
        {/* Hidden printable full itinerary (all tabs) */}
        {selected && (
          <Box id="itinerary-print-full" sx={{ position:'absolute', top:-99999, left:-99999, width: 800, bgcolor:'#fff', color:'#000', p:3, fontSize:12 }}>
            <Typography variant="h5" sx={{ fontWeight:'bold', mb:1 }}>{selected.title}</Typography>
            <Typography variant="subtitle2" sx={{ mb:2 }}>
              {dayjs(selected.start_date).format('MMM D, YYYY')} - {dayjs(selected.end_date).format('MMM D, YYYY')} | Travelers: {selected.travelers} | Status: {selected.status}
            </Typography>
            {selected.client_id && (
              <Typography sx={{ mb:2 }}>Client: {clients.find(c=>c.id===selected.client_id)?.first_name} {clients.find(c=>c.id===selected.client_id)?.last_name}</Typography>
            )}
            <Typography variant="h6" sx={{ mt:1, mb:1 }}>Day By Day</Typography>
            {selected.days.map(d => (
              <Box key={d.date} sx={{ mb:1.5 }}>
                <Typography sx={{ fontWeight:'bold' }}>{dayjs(d.date).format('dddd, MMM D')}</Typography>
                {(d.activities||[]).length === 0 && <Typography variant="body2" color="text.secondary">No activities</Typography>}
                {(d.activities||[]).map(a => (
                  <Box key={a.id} sx={{ pl:1, borderLeft:'2px solid #666', mb:0.5 }}>
                    <Typography variant="body2"><strong>{a.time||'--:--'}</strong> | {a.type} | {a.description || 'No description'} {a.location ? `@ ${a.location}`:''} { (a.cost || 0) ? `- ${selected.currency} ${(a.cost||0).toFixed(2)}`:'' }</Typography>
                  </Box>
                ))}
              </Box>
            ))}
            <Divider sx={{ my:2 }} />
            <Typography variant="h6" sx={{ mb:1 }}>Pricing Summary</Typography>
            <Box>
              {Object.entries(costSummary.byType).map(([t,v]) => (
                <Box key={t} sx={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                  <span>{t}</span><span>{selected.currency} {v.toFixed(2)}</span>
                </Box>
              ))}
              <Box sx={{ mt:1, display:'flex', justifyContent:'space-between', fontWeight:'bold', fontSize:13 }}>
                <span>Total</span><span>{selected.currency} {costSummary.total.toFixed(2)}</span>
              </Box>
              <Box sx={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                <span>Per Traveler</span><span>{selected.currency} {costSummary.perTraveler.toFixed(2)}</span>
              </Box>
            </Box>
          </Box>
        )}
      </Grid>

      <Dialog open={showNewDialog} onClose={()=>setShowNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Itinerary From Template</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth size="small" sx={{ mt:1 }}>
            <InputLabel>Template</InputLabel>
            <Select label="Template" value={templateSource} onChange={e=>setTemplateSource(e.target.value)}>
              <MenuItem value=""><em>Select Template</em></MenuItem>
              {templateItineraries.map(t => <MenuItem key={t.id} value={t.id}>{t.title}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setShowNewDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={()=>{ const temp = itineraries.find(i=>i.id===templateSource); setShowNewDialog(false); createItinerary(temp); }}>Create</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={()=>setSnackbar(s=>({...s, open:false}))}>
        <Alert severity={snackbar.severity||'info'}>{snackbar.message}</Alert>
      </Snackbar>
    </Grid>
  );
};

export default ItinerariesView;
