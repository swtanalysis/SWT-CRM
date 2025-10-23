import { supabase } from './supabaseClient';

// Fetch all rows from a table or query by paging with range. Uses chunkSize to avoid huge single responses.
export async function fetchAllFrom(table: string, select = '*', chunkSize = 1000) {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const to = from + chunkSize - 1;
    const res = await supabase.from(table).select(select).range(from, to);
    if (res.error) {
      return { data: null, error: res.error };
    }
    const rows = res.data || [];
    all.push(...rows);
    if (rows.length < chunkSize) break;
    from += chunkSize;
  }
  return { data: all, error: null };
}

// Accepts an existing QueryBuilder (supabase.from(...)) and pages using range.
export async function fetchAllFromQuery(builder: any, chunkSize = 1000) {
  const all: any[] = [];
  let from = 0;
  while (true) {
    const to = from + chunkSize - 1;
    const res = await builder.range(from, to);
    if (res.error) {
      return { data: null, error: res.error };
    }
    const rows = res.data || [];
    all.push(...rows);
    if (rows.length < chunkSize) break;
    from += chunkSize;
  }
  return { data: all, error: null };
}
