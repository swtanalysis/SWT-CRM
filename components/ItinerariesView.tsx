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
import Autocomplete from '@mui/material/Autocomplete';
import dayjs from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DISPLAY_DATE } from '../lib/dateFormats';
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

  // --- Draft Persistence ---
  // Load draft for new itinerary if user had one and nothing selected yet
  useEffect(()=> {
    if (selected) return; // only for empty state
    try {
      const raw = localStorage.getItem('itinerary_draft_new');
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.title) {
          const draft: Itinerary = { ...emptyItinerary(d.client_id||null), ...d, id: '' };
          setSelected(draft);
        }
      }
    } catch {}
  }, [selected]);

  // Persist draft for: (a) new itinerary without id, (b) unsaved field edits before autosave (lightweight snapshot)
  useEffect(()=> {
    if (!selected) return;
    const key = selected.id ? `itinerary_draft_${selected.id}` : 'itinerary_draft_new';
    // Avoid storing excessively large arrays by trimming activities details (keep essential fields)
    const slim = { ...selected, days: selected.days.map(d => ({ date: d.date, activities: (d.activities||[]).map(a => ({ id:a.id, time:a.time, type:a.type, description:a.description, location:a.location, cost:a.cost, currency:a.currency, _costInput:(a as any)._costInput })) })) };
    try { localStorage.setItem(key, JSON.stringify(slim)); } catch {}
  }, [selected]);

  // Offer recovery of previous autosaved version when selecting an itinerary
  const applyLocalDraftIfNewer = useCallback((it: Itinerary) => {
    try {
      const key = `itinerary_draft_${it.id}`;
      const raw = localStorage.getItem(key);
      if (!raw) return it;
      const draft = JSON.parse(raw);
      // Simple heuristic: choose draft if it has more activities total or later updated_at (if exists)
      const draftActs = (draft.days||[]).reduce((s:number,d:any)=> s + (d.activities?.length||0),0);
      const serverActs = (it.days||[]).reduce((s,d)=> s + (d.activities?.length||0),0);
      if (draftActs > serverActs) return { ...it, ...draft, id: it.id };
    } catch {}
    return it;
  }, []);

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
  const newAct: ItineraryActivity = { id: Math.random().toString(36).slice(2), time:'', type:'Activity', description:'', location:'', cost:0, currency: prev.currency } as ItineraryActivity & { _costInput?: string };
  (newAct as any)._costInput = '';
      target.activities = [...(target.activities||[]), newAct];
      days[dayIndex] = target;
      return { ...prev, days };
    });
    scheduleSave();
  };

  const updateActivity = (dayIndex: number, actId: string, patch: Partial<ItineraryActivity & { _costInput?: string }>) => {
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
  setSelected(applyLocalDraftIfNewer(data as Itinerary));
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
    try {
      setSnackbar({ open:true, message:'Building PDF...', severity:'info' });
      const pdf = new jsPDF('p','mm','a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const themePrimary = '#2bcba8';
      const themeDark = '#178f77';

      const addHeader = (title: string) => {
        pdf.setFillColor(43,203,168); // mint primary
        pdf.rect(0,0,pageWidth,18,'F');
        pdf.setTextColor('#04352c');
        pdf.setFontSize(14);
        pdf.setFont('helvetica','bold');
        pdf.text(title, margin, 12);
        pdf.setDrawColor(themeDark);
      };
      const addFooter = (pageNo: number) => {
        pdf.setFontSize(9);
        pdf.setTextColor('#178f77');
        pdf.text(`Page ${pageNo}`, pageWidth - margin - 20, pageHeight - 6);
        pdf.setTextColor('#094f43');
        pdf.text(dayjs().format('DD/MM/YYYY HH:mm'), margin, pageHeight - 6);
      };

      let page = 1;
      addHeader(selected.title);
      addFooter(page);
      pdf.setFontSize(10);
      pdf.setTextColor('#094f43');
      pdf.setFont('helvetica','normal');
      let cursorY = 26;

      const lineGap = 5;
      const sectionTitle = (text: string) => {
        if (cursorY > pageHeight - 30) { pdf.addPage(); addHeader(selected.title); addFooter(++page); cursorY = 26; }
        pdf.setFillColor(217,246,239);
        pdf.setDrawColor(themePrimary);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(margin, cursorY-4, pageWidth - margin*2, 8, 2,2,'F');
        pdf.setFontSize(11); pdf.setFont('helvetica','bold'); pdf.setTextColor(themeDark);
        pdf.text(text, margin + 2, cursorY+1);
        pdf.setFont('helvetica','normal'); pdf.setFontSize(10); pdf.setTextColor('#094f43');
        cursorY += lineGap + 2;
      };

      // Summary top block
      const summaryBlock = [
        `Dates: ${dayjs(selected.start_date).format('DD/MM/YYYY')} - ${dayjs(selected.end_date).format('DD/MM/YYYY')}`,
        `Travelers: ${selected.travelers}`,
        `Status: ${selected.status}`,
        selected.client_id ? `Client: ${clients.find(c=>c.id===selected.client_id)?.first_name || ''} ${clients.find(c=>c.id===selected.client_id)?.last_name || ''}` : ''
      ].filter(Boolean);
      summaryBlock.forEach(line => {
        if (cursorY > pageHeight - 20) { pdf.addPage(); addHeader(selected.title); addFooter(++page); cursorY = 26; }
        pdf.text(line, margin, cursorY); cursorY += lineGap;
      });
      cursorY += 2;

      // Day by Day section
      sectionTitle('Day by Day');
      selected.days.forEach(d => {
        if (cursorY > pageHeight - 30) { pdf.addPage(); addHeader(selected.title); addFooter(++page); cursorY = 26; sectionTitle('Day by Day (cont.)'); }
        pdf.setFont('helvetica','bold');
        pdf.text(dayjs(d.date).format('dddd, DD MMM YYYY'), margin, cursorY);
        pdf.setFont('helvetica','normal');
        cursorY += lineGap;
        const acts = d.activities || [];
        if (!acts.length) { pdf.setTextColor('#666666'); pdf.text('No activities', margin+2, cursorY); pdf.setTextColor('#094f43'); cursorY += lineGap; }
        acts.forEach(a => {
          if (cursorY > pageHeight - 20) { pdf.addPage(); addHeader(selected.title); addFooter(++page); cursorY = 26; }
            const time = a.time || '--:--';
            const type = a.type || 'Activity';
            const desc = a.description || 'No description';
            const loc = a.location ? ` @ ${a.location}` : '';
            const cost = (a.cost || 0) ? ` - ${selected.currency} ${(a.cost||0).toFixed(2)}` : '';
            const line = `${time} | ${type} | ${desc}${loc}${cost}`;
            const split = pdf.splitTextToSize(line, pageWidth - margin*2);
            split.forEach((l: string) => {
              if (cursorY > pageHeight - 15) { pdf.addPage(); addHeader(selected.title); addFooter(++page); cursorY = 26; }
              pdf.text(l, margin+2, cursorY); cursorY += 4.2;
            });
            cursorY += 1;
        });
        cursorY += 2;
      });

      // Pricing Summary
      sectionTitle('Pricing Summary');
      const entries = Object.entries(costSummary.byType);
      const col1 = margin + 2;
      const col2 = pageWidth - margin - 40;
      pdf.setFont('helvetica','bold'); pdf.text('Type', col1, cursorY); pdf.text('Amount', col2, cursorY); pdf.setFont('helvetica','normal'); cursorY += lineGap - 1;
      entries.forEach(([t,v]) => {
        if (cursorY > pageHeight - 25) { pdf.addPage(); addHeader(selected.title); addFooter(++page); cursorY = 26; sectionTitle('Pricing Summary (cont.)'); pdf.setFont('helvetica','bold'); pdf.text('Type', col1, cursorY); pdf.text('Amount', col2, cursorY); pdf.setFont('helvetica','normal'); cursorY += lineGap - 1; }
        pdf.text(t, col1, cursorY); pdf.text(`${selected.currency} ${v.toFixed(2)}`, col2, cursorY, { align:'left' }); cursorY += 4.5;
      });
      cursorY += 2;
      pdf.setDrawColor(themePrimary);
      pdf.setLineWidth(0.3);
      pdf.line(margin, cursorY, pageWidth - margin, cursorY); cursorY += 5;
      pdf.setFont('helvetica','bold');
      pdf.text('Total:', col1, cursorY); pdf.text(`${selected.currency} ${costSummary.total.toFixed(2)}`, col2, cursorY); cursorY += 5;
      pdf.setFont('helvetica','normal');
      pdf.text('Per Traveler:', col1, cursorY); pdf.text(`${selected.currency} ${costSummary.perTraveler.toFixed(2)}`, col2, cursorY);

      pdf.save(`${selected.title.replace(/\s+/g,'-').toLowerCase()}.pdf`);
      setSnackbar({ open:true, message:'PDF downloaded', severity:'success' });
    } catch (err: any) {
      setSnackbar({ open:true, message:`PDF failed: ${err.message||err}`, severity:'error' });
    }
  };

  const templateItineraries = useMemo(()=> itineraries.filter(i => (i as any).is_template), [itineraries]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p:2, height:'100%', display:'flex', flexDirection:'column', gap:1 }}>
          <Typography variant="h6" sx={{ fontWeight:'bold' }}>Itineraries</Typography>
          <TextField size="small" label="Search" value={search} onChange={e=>setSearch(e.target.value)} />
          <Autocomplete
            size="small"
            options={clients}
            getOptionLabel={(c)=> [c.first_name,c.last_name].filter(Boolean).join(' ')}
            isOptionEqualToValue={(a,b)=> a.id===b.id}
            value={clients.find(c=> c.id===filterClient) || null}
            onChange={(e,val)=> setFilterClient(val? val.id: '')}
            renderInput={(params)=><TextField {...params} label="Client Filter" />}
            clearOnEscape
          />
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
                <ListItemButton selected={selected?.id === i.id} onClick={()=>setSelected(applyLocalDraftIfNewer(i))}>
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
                <Grid item xs={12} md={3}><DatePicker format={DISPLAY_DATE} label="Start" value={dayjs(selected.start_date)} onChange={d=> { if (!d) return; handleFieldChange('start_date', d.format('YYYY-MM-DD')); }} slotProps={{ textField:{ size:'small', fullWidth:true } }} /></Grid>
                <Grid item xs={12} md={3}><DatePicker format={DISPLAY_DATE} label="End" value={dayjs(selected.end_date)} onChange={d=> { if (!d) return; handleFieldChange('end_date', d.format('YYYY-MM-DD')); }} slotProps={{ textField:{ size:'small', fullWidth:true } }} /></Grid>
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    size="small"
                    options={clients}
                    getOptionLabel={(c)=> [c.first_name, c.last_name].filter(Boolean).join(' ')}
                    isOptionEqualToValue={(a,b)=> a.id===b.id}
                    value={clients.find(c=> c.id === (selected.client_id||'')) || null}
                    onChange={(e,val)=> {
                      const newId = val? val.id : null;
                      bumpVersion();
                      setSelected(p=> p? { ...p, client_id: newId }: p);
                      setItineraries(list => list.map(i => i.id === selected?.id ? { ...i, client_id: newId } : i));
                      saveSelected({ client_id: newId });
                    }}
                    renderInput={(params)=><TextField {...params} fullWidth label="Client" placeholder="Search client" />}
                    clearOnEscape
                    sx={{ width: '100%' }}
                    autoHighlight
                  />
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
                                <Grid item xs={6} md={2}>
                                  <TextField 
                                    size="small" 
                                    fullWidth 
                                    label="Cost" 
                                    inputMode="decimal"
                                    value={(a as any)._costInput !== undefined ? (a as any)._costInput : (a.cost ?? '')}
                                    onChange={e=> {
                                      const raw = e.target.value;
                                      // Allow empty or partial input, store in _costInput
                                      updateActivity(idx, a.id!, { _costInput: raw });
                                    }}
                                    onBlur={e=> {
                                      const raw = e.target.value.trim();
                                      if (raw === '') { updateActivity(idx,a.id!,{ cost: undefined, _costInput: '' }); return; }
                                      const num = Number(raw.replace(/[^0-9.\-]/g,''));
                                      if (!isNaN(num)) {
                                        updateActivity(idx,a.id!,{ cost: num, _costInput: String(num) });
                                      }
                                    }}
                                  />
                                </Grid>
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
  {/* Removed legacy hidden screenshot container for PDF export */}
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
