import { createClient } from '@supabase/supabase-js';
import { ApplicationFormData, Startup, Note, AuditLog, PipelineStatus, Admin } from '../types';

const rawSupabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();

// Clean up Supabase URL: remove trailing slash, ensure protocol prefix, and strip api path suffixes
export const cleanSupabaseUrl = (() => {
  let url = rawSupabaseUrl;
  if (!url) return '';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  // Strip common incorrect suffixes like /rest/v1, /rest, /auth/v1, /storage/v1, /v1
  url = url.replace(/\/(rest|auth|storage)\/v1\/?$/i, '');
  url = url.replace(/\/rest\/?$/i, '');
  url = url.replace(/\/auth\/?$/i, '');
  url = url.replace(/\/storage\/?$/i, '');
  url = url.replace(/\/v1\/?$/i, '');
  
  // Remove trailing slashes again just in case
  while (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
})();

export const cleanSupabaseAnonKey = rawSupabaseAnonKey;

// Detect if Supabase is properly configured
export const isSupabaseConfigured =
  !!cleanSupabaseUrl &&
  cleanSupabaseUrl !== 'https://your-project-id.supabase.co' &&
  cleanSupabaseUrl !== 'your-project-id.supabase.co' &&
  !!cleanSupabaseAnonKey &&
  cleanSupabaseAnonKey !== 'your-anon-key';

const supabaseUrl = cleanSupabaseUrl;
const supabaseAnonKey = cleanSupabaseAnonKey;

// Lazy initialize the Supabase client to avoid crashes if keys are invalid
let supabase: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!supabase && isSupabaseConfigured) {
    try {
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
    }
  }
  return supabase;
}

export interface DbService {
  isConfigured(): boolean;
  
  // Auth Operations
  getCurrentUser(): Promise<{ id: string; email: string; isAdmin: boolean } | null>;
  signUp(email: string, password: string): Promise<{ success: boolean; user: any; error?: string }>;
  signIn(email: string, password: string): Promise<{ success: boolean; user: any; error?: string }>;
  signOut(): Promise<void>;
  
  // Startup Operations
  submitApplication(data: ApplicationFormData): Promise<{ success: boolean; id: string; error?: string }>;
  getStartups(): Promise<Startup[]>;
  updateStartupStatus(id: string, status: PipelineStatus, user: { id: string; email: string }): Promise<boolean>;
  deleteStartup(id: string, user: { id: string; email: string }): Promise<boolean>;
  
  // Notes Operations
  getNotes(startupId: string): Promise<Note[]>;
  addNote(startupId: string, content: string, user: { id: string; email: string }): Promise<Note | null>;
  deleteNote(noteId: string, user: { id: string; email: string }): Promise<boolean>;
  
  // Storage & Pitch Deck Operations
  getSignedUrl(path: string): Promise<string>;
  
  // Audit Logs Operations
  getAuditLogs(): Promise<AuditLog[]>;
  
  // CSV Import Operations
  importCSV(startups: Partial<Startup>[], user: { id: string; email: string }): Promise<{ imported: number; skipped: number; report: string[] }>;

  // Admin Management Operations
  getAdmins(): Promise<Admin[]>;
  addAdmin(id: string, email: string): Promise<boolean>;
  deleteAdmin(id: string): Promise<boolean>;
}

/**
 * -------------------------------------------------------------
 * REAL SUPABASE SERVICE IMPLEMENTATION
 * -------------------------------------------------------------
 */
class SupabaseServiceImpl implements DbService {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  }

  async getCurrentUser() {
    const client: any = getSupabase();
    if (!client) return null;

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return null;

    // Fetch the admin record to authorize
    const { data: adminRecord, error: adminError } = await client
      .from('admins')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: user.email || '',
      isAdmin: !adminError && !!adminRecord
    };
  }

  async signUp(email: string, password: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    const { data, error } = await client.auth.signUp({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return { success: true, user: data.user };
  }

  async signIn(email: string, password: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    // Check if they are admin
    const { data: adminRecord } = await client
      .from('admins')
      .select('id')
      .eq('id', data.user?.id)
      .maybeSingle();

    return {
      success: true,
      user: {
        id: data.user?.id || '',
        email: data.user?.email || '',
        isAdmin: !!adminRecord
      }
    };
  }

  async signOut() {
    const client: any = getSupabase();
    if (client) {
      await client.auth.signOut();
    }
  }

  async submitApplication(data: ApplicationFormData) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    // Ensure the user has an active session to allow storage uploads (authenticated role required by RLS)
    try {
      const { data: { session } } = await client.auth.getSession();
      if (!session) {
        const { error: anonError } = await client.auth.signInAnonymously();
        if (anonError) {
          console.warn('Anonymous auth failed, trying to proceed anyway:', anonError);
        }
      }
    } catch (authErr) {
      console.warn('Error checking/signing in anonymously:', authErr);
    }

    // Check for duplicate company name submissions (case-insensitive)
    try {
      const { data: existingStartup, error: checkError } = await client
        .from('startups')
        .select('id')
        .ilike('company_name', data.company_name.trim())
        .maybeSingle();

      if (checkError) {
        console.warn('Duplicate verification skipped due to database error:', checkError);
      } else if (existingStartup) {
        throw new Error(`A startup application with the company name "${data.company_name}" has already been submitted to our pipeline.`);
      }
    } catch (err: any) {
      if (err.message && err.message.includes('already been submitted')) {
        throw err;
      }
      console.warn('Duplicate verification query issue, continuing with insert:', err);
    }

    // 1. Upload the pitch deck first if it exists
    let pitchDeckPath = '';
    if (data.pitch_deck) {
      const fileExt = data.pitch_deck.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 11)}_${Date.now()}.${fileExt}`;
      const filePath = `pitch-decks/${fileName}`;

      const { error: uploadError } = await client.storage
        .from('pitch-decks')
        .upload(filePath, data.pitch_deck, {
          cacheControl: '3650',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Pitch deck upload failed: ${uploadError.message}`);
      }
      pitchDeckPath = filePath;
    }

    // 2. Submit Startup metadata
    const startupPayload = {
      company_name: data.company_name,
      website: data.website,
      one_line_pitch: data.one_line_pitch,
      description: data.description,
      hq_location: data.hq_location,
      sector: data.sector,
      founder_name: data.founder_name,
      founder_email: data.founder_email,
      founder_linkedin: data.founder_linkedin,
      team_size: Number(data.team_size),
      team_background: data.team_background,
      stage: data.stage,
      funding_raised: Number(data.funding_raised || 0),
      target_raise: Number(data.target_raise),
      traction: data.traction,
      pitch_deck_path: pitchDeckPath,
      demo_video: data.demo_video || null,
      status: 'New'
    };

    const { data: insertedData, error: dbError } = await client
      .from('startups')
      .insert(startupPayload)
      .select('id')
      .single();

    if (dbError) {
      throw dbError;
    }

    const insertedId = insertedData?.id || '';

    // 3. Write Audit Log
    // For anonymous public submissions, direct audit log insertion is blocked via RLS policies.
    // The secure database trigger 'tr_log_startup_submission' handles this automatically.
    // We only attempt direct insertion if the current user is authenticated (e.g. an admin importing).
    try {
      const { data: { user } } = await client.auth.getUser();
      if (user) {
        await client.from('audit_logs').insert({
          user_id: user.id,
          user_email: user.email,
          action: 'Application submitted',
          target_id: insertedId,
          target_name: data.company_name,
          details: { sector: data.sector, target_raise: data.target_raise }
        });
      }
    } catch (e) {
      console.warn('Anonymous client-side audit log skipped (handled securely by database trigger):', e);
    }

    return { success: true, id: insertedId };
  }

  async getStartups() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('startups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as Startup[];
  }

  async updateStartupStatus(id: string, status: PipelineStatus, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return false;

    // Fetch the previous status first for auditing
    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name, status')
      .eq('id', id)
      .single();

    const oldStatus = currentStartup?.status || 'Unknown';

    const { error } = await client
      .from('startups')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Insert Audit Log
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'Status changed',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { old_status: oldStatus, new_status: status }
    });

    return true;
  }

  async deleteStartup(id: string, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return false;

    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name')
      .eq('id', id)
      .single();

    const { error } = await client
      .from('startups')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    // Insert Audit Log
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'Delete',
      target_id: id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: `Startup '${currentStartup?.company_name}' deleted by admin.` }
    });

    return true;
  }

  async getNotes(startupId: string) {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('notes')
      .select('*')
      .eq('startup_id', startupId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as Note[];
  }

  async addNote(startupId: string, content: string, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return null;

    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name')
      .eq('id', startupId)
      .single();

    const { data, error } = await client
      .from('notes')
      .insert({
        startup_id: startupId,
        author_id: user.id,
        author_email: user.email,
        content
      })
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    // Insert Audit Log
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: startupId,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: 'Added reviewer note.' }
    });

    return data as Note;
  }

  async deleteNote(noteId: string, user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) return false;

    // Fetch note to identify startup_id
    const { data: currentNote } = await client
      .from('notes')
      .select('startup_id')
      .eq('id', noteId)
      .single();

    if (!currentNote) return false;

    const { data: currentStartup } = await client
      .from('startups')
      .select('company_name')
      .eq('id', currentNote.startup_id)
      .single();

    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (error) {
      throw error;
    }

    // Insert Audit Log
    await client.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: currentNote.startup_id,
      target_name: currentStartup?.company_name || 'Startup',
      details: { message: 'Deleted reviewer note.' }
    });

    return true;
  }

  async getSignedUrl(path: string) {
    if (!path || !path.trim()) {
      return '';
    }
    const client: any = getSupabase();
    if (!client) return '';

    // Sanitize the storage path: remove double/multiple slashes and remove leading slash
    let cleanPath = path.trim().replace(/\/+/g, '/');
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.slice(1);
    }

    // Guard against empty path or generic bucket directory names that can trigger invalid path API errors
    if (!cleanPath || cleanPath === 'pitch-decks' || cleanPath === 'pitch-decks/') {
      return '';
    }

    const { data, error } = await client.storage
      .from('pitch-decks')
      .createSignedUrl(cleanPath, 3600); // 1 hour expiration

    if (error) {
      throw error;
    }

    return data.signedUrl || '';
  }

  async getAuditLogs() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    return (data || []) as AuditLog[];
  }

  async importCSV(startupsList: Partial<Startup>[], user: { id: string; email: string }) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    let imported = 0;
    let skipped = 0;
    const report: string[] = [];

    // 1. Fetch all existing startups to perform in-memory duplicate validation
    const { data: existing, error: fetchError } = await client
      .from('startups')
      .select('company_name');

    if (fetchError) {
      throw new Error(`Failed to verify existing startups: ${fetchError.message}`);
    }

    const existingNames = new Set((existing || []).map((s: any) => s.company_name.toLowerCase().trim()));
    const startupsToInsert: any[] = [];
    const pendingReports: string[] = [];

    for (const item of startupsList) {
      if (!item.company_name) {
        skipped++;
        report.push(`Skipped row: Missing Company Name`);
        continue;
      }

      const companyNameTrimmed = item.company_name.trim();

      if (existingNames.has(companyNameTrimmed.toLowerCase())) {
        skipped++;
        report.push(`Skipped duplicate: '${companyNameTrimmed}' already exists in CRM.`);
        continue;
      }

      // Add to set to avoid duplicates within the CSV itself
      existingNames.add(companyNameTrimmed.toLowerCase());

      const startupPayload = {
        company_name: companyNameTrimmed,
        website: item.website || 'https://example.com',
        one_line_pitch: item.one_line_pitch || 'Imported via CSV',
        description: item.description || 'Imported startup profile.',
        hq_location: item.hq_location || 'Unknown',
        sector: item.sector || 'SaaS',
        founder_name: item.founder_name || 'N/A',
        founder_email: item.founder_email || 'import@example.com',
        founder_linkedin: item.founder_linkedin || 'https://linkedin.com',
        team_size: Number(item.team_size || 1),
        team_background: item.team_background || 'N/A',
        stage: item.stage || 'Pre-revenue/Traction',
        funding_raised: Number(item.funding_raised || 0),
        target_raise: Number(item.target_raise || 100000),
        traction: item.traction || 'N/A',
        pitch_deck_path: item.pitch_deck_path || `pitch-decks/imported_${Math.random().toString(36).substring(2, 9)}.pdf`,
        demo_video: item.demo_video || null,
        status: (item.status as PipelineStatus) || 'New'
      };

      startupsToInsert.push(startupPayload);
      pendingReports.push(`Successfully imported: '${companyNameTrimmed}' (${startupPayload.stage}, Sector: ${startupPayload.sector})`);
    }

    // 2. Perform bulk insert in a single transactional network request
    if (startupsToInsert.length > 0) {
      const { data: insertedRows, error: insertError } = await client
        .from('startups')
        .insert(startupsToInsert)
        .select('id, company_name');

      if (insertError) {
        throw new Error(`Bulk CSV import failed. Database transaction rolled back: ${insertError.message}`);
      }

      imported = insertedRows?.length || 0;
      report.push(...pendingReports);

      // 3. Bulk insert audit logs for the newly imported startups
      if (insertedRows && insertedRows.length > 0) {
        const auditLogsToInsert = insertedRows.map((row: any) => ({
          user_id: user.id,
          user_email: user.email,
          action: 'Application submitted',
          target_id: row.id,
          target_name: row.company_name,
          details: { message: 'Imported via CSV file.', imported_by: user.email }
        }));

        const { error: logError } = await client.from('audit_logs').insert(auditLogsToInsert);
        if (logError) {
          console.warn('Failed to insert audit logs for CSV import:', logError);
        }
      }
    } else {
      report.push('No new rows were valid for import.');
    }

    return { imported, skipped, report };
  }

  async getAdmins() {
    const client: any = getSupabase();
    if (!client) return [];

    const { data, error } = await client
      .from('admins')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as Admin[];
  }

  async addAdmin(id: string, email: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    const { error } = await client
      .from('admins')
      .insert({ id, email });

    if (error) {
      throw error;
    }

    return true;
  }

  async deleteAdmin(id: string) {
    const client: any = getSupabase();
    if (!client) throw new Error('Supabase client is not configured');

    // Request the deleted row(s) back. If RLS blocks the delete (e.g. the
    // "Admins delete access" policy from 03_security_fixes.sql denies it, or
    // that migration hasn't been applied yet), Supabase returns success with
    // an empty array rather than an error -- so we must check the row count
    // ourselves instead of assuming success whenever `error` is falsy.
    const { data, error } = await client
      .from('admins')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error(
        'Admin was not removed. This is either not permitted (you cannot revoke your own access or remove the last remaining admin) or the required database policy is missing — see supabase/migrations/03_security_fixes.sql.'
      );
    }

    return true;
  }
}

// Instantiate the active service
export const dbService: DbService = new SupabaseServiceImpl();
