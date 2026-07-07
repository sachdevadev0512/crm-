import { createClient } from '@supabase/supabase-js';
import { Startup, Note, Admin, AuditLog, PipelineStatus, ApplicationFormData } from '../types';

// Read Supabase environment variables safely and sanitize them
const rawSupabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || '').trim();
const rawSupabaseAnonKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();

// Clean up Supabase URL: remove trailing slash, ensure protocol prefix, and strip api path suffixes
export const cleanSupabaseUrl = (() => {
  let url = rawSupabaseUrl;
  if (!url) return '';
  // Prepend https:// if protocol is missing (e.g. yourproject.supabase.co -> https://yourproject.supabase.co)
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Remove trailing slashes (e.g. https://yourproject.supabase.co/ -> https://yourproject.supabase.co)
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
 * LOCAL SANDBOX SERVICE (High-Fidelity Simulation)
 * -------------------------------------------------------------
 * This runs when real Supabase environment variables are missing,
 * providing a seamless, fully-interactive testing environment in AI Studio.
 */
class LocalSandboxServiceImpl implements DbService {
  private startupsKey = 'mv_sandbox_startups';
  private notesKey = 'mv_sandbox_notes';
  private adminsKey = 'mv_sandbox_admins';
  private logsKey = 'mv_sandbox_logs';
  private activeUserKey = 'mv_sandbox_active_user';

  constructor() {
    this.initializeData();
  }

  isConfigured(): boolean {
    return false;
  }

  private getItems<T>(key: string): T[] {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  }

  private saveItems<T>(key: string, items: T[]): void {
    localStorage.setItem(key, JSON.stringify(items));
  }

  private initializeData() {
    if (!localStorage.getItem(this.startupsKey)) {
      // Seed some starting applications for previewing
      const initialStartups: Startup[] = [
        {
          id: 'startup-1',
          company_name: 'Acme AI Solutions',
          website: 'https://acmeai.example.com',
          one_line_pitch: 'Generative AI platform for enterprise workflow automation and orchestration.',
          description: 'Acme AI builds custom LLM agents that connect to enterprise databases and API endpoints to automate repetitive data entry, email follow-ups, and calendar coordination, saving workers up to 15 hours per week.',
          hq_location: 'San Francisco, CA',
          sector: 'AI/ML',
          founder_name: 'Alice Johnson',
          founder_email: 'alice@acmeai.example.com',
          founder_linkedin: 'https://linkedin.com/in/alice-johnson-demo',
          team_size: 4,
          team_background: 'Former Senior AI Research Scientist at DeepMind, and Technical Product Manager at Google.',
          stage: 'Pre-revenue/Traction',
          funding_raised: 150000,
          target_raise: 1200000,
          traction: 'Currently in closed beta with 8 enterprise design partners. $12k in committed pilot ARR starting next month.',
          pitch_deck_path: 'pitch-decks/acme_ai_pitch.pdf',
          demo_video: 'https://youtube.com/watch?v=acmedemo',
          status: 'New',
          created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
        },
        {
          id: 'startup-2',
          company_name: 'Helix BioSystems',
          website: 'https://helixbio.example.com',
          one_line_pitch: 'Microfluidic chips for high-throughput single-cell DNA sequencing.',
          description: 'Helix BioSystems has engineered a custom desktop sequencer that reduces the cost of single-cell genomic mapping by 90%, enabling routine clinical screening for early-stage oncology mutations.',
          hq_location: 'Boston, MA',
          sector: 'HealthTech',
          founder_name: 'Dr. Robert Chen',
          founder_email: 'r.chen@helixbio.example.com',
          founder_linkedin: 'https://linkedin.com/in/robert-chen-demo',
          team_size: 8,
          team_background: 'Ph.D. in Bioengineering from MIT. Postdoc at Harvard Wyss Institute. 3 patents published.',
          stage: 'Post-revenue/Traction',
          funding_raised: 1200000,
          target_raise: 5000000,
          traction: '3 desktop sequencers shipped to research institutes. $45,000 MRR from consumable reagent kit sales.',
          pitch_deck_path: 'pitch-decks/helix_biosystems.pdf',
          status: 'Screening',
          created_at: new Date(Date.now() - 120 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 110 * 3600 * 1000).toISOString()
        },
        {
          id: 'startup-3',
          company_name: 'Scribe Legal Technologies',
          website: 'https://scribelegal.example.com',
          one_line_pitch: 'AI-assisted contract analysis and regulatory compliance auditing for boutique firms.',
          description: 'Scribe Legal operates as an automated regulatory co-pilot that scans thousands of pages of municipal code and real estate contracts to highlight liability risks in minutes.',
          hq_location: 'Chicago, IL',
          sector: 'SaaS',
          founder_name: 'Marcus Vance',
          founder_email: 'marcus@scribelegal.example.com',
          founder_linkedin: 'https://linkedin.com/in/marcus-vance-demo',
          team_size: 3,
          team_background: 'Corporate attorney (ex-Kirkland & Ellis) and Full-Stack Software Engineer.',
          stage: 'MVP/Pre-revenue',
          funding_raised: 50000,
          target_raise: 750000,
          traction: 'Beta version built. 15 law firms signed letters of intent (LOI) to run 30-day trials upon pilot launch.',
          pitch_deck_path: 'pitch-decks/scribe_legal.pdf',
          demo_video: 'https://loom.com/share/scribelegal',
          status: 'Meeting',
          created_at: new Date(Date.now() - 240 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 200 * 3600 * 1000).toISOString()
        }
      ];
      this.saveItems(this.startupsKey, initialStartups);
    }

    if (!localStorage.getItem(this.notesKey)) {
      const initialNotes: Note[] = [
        {
          id: 'note-1',
          startup_id: 'startup-1',
          author_id: 'admin-bootstrap-id',
          author_email: 'sachdevadev0512@gmail.com',
          content: 'The deep learning founder has an outstanding research pedigree. The market is crowded, but their agent-orchestration layer looks highly differentiated.',
          created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        }
      ];
      this.saveItems(this.notesKey, initialNotes);
    }

    if (!localStorage.getItem(this.adminsKey)) {
      const initialAdmins: Admin[] = [
        {
          id: 'admin-bootstrap-id',
          email: 'sachdevadev0512@gmail.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
      this.saveItems(this.adminsKey, initialAdmins);
    }

    if (!localStorage.getItem(this.logsKey)) {
      const initialLogs: AuditLog[] = [
        {
          id: 'log-1',
          user_id: null,
          user_email: 'System Applicant',
          action: 'Application submitted',
          target_id: 'startup-1',
          target_name: 'Acme AI Solutions',
          details: { message: 'Startup applied via public portal.' },
          created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
        },
        {
          id: 'log-2',
          user_id: null,
          user_email: 'System Applicant',
          action: 'Application submitted',
          target_id: 'startup-2',
          target_name: 'Helix BioSystems',
          details: { message: 'Startup applied via public portal.' },
          created_at: new Date(Date.now() - 120 * 3600 * 1000).toISOString()
        }
      ];
      this.saveItems(this.logsKey, initialLogs);
    }
  }

  async getCurrentUser() {
    const userStr = localStorage.getItem(this.activeUserKey);
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    
    // Check if they are admin
    const admins = this.getItems<Admin>(this.adminsKey);
    const isAdmin = admins.some(a => a.id === user.id);
    return { ...user, isAdmin };
  }

  async signUp(email: string, password: string) {
    const userId = 'user-' + email.replace(/[@.]/g, '-');
    const user = { id: userId, email };
    
    // Check if admin table is empty (for bootstrapping)
    const admins = this.getItems<Admin>(this.adminsKey);
    const isNowAdmin = admins.some(a => a.id === userId);

    localStorage.setItem(this.activeUserKey, JSON.stringify(user));
    return { success: true, user: { ...user, isAdmin: isNowAdmin } };
  }

  async signIn(email: string, password: string) {
    const userId = 'user-' + email.replace(/[@.]/g, '-');
    const user = { id: userId, email };
    
    const admins = this.getItems<Admin>(this.adminsKey);
    const isNowAdmin = admins.some(a => a.id === userId);

    localStorage.setItem(this.activeUserKey, JSON.stringify(user));
    return { success: true, user: { ...user, isAdmin: isNowAdmin } };
  }

  async signOut() {
    localStorage.removeItem(this.activeUserKey);
  }

  async submitApplication(data: ApplicationFormData) {
    const startups = this.getItems<Startup>(this.startupsKey);
    const newId = 'startup-' + Math.random().toString(36).substring(2, 11);
    
    // Simulate pitch deck file path saving
    const pitchDeckPath = `pitch-decks/${newId}_${data.pitch_deck?.name || 'pitch_deck.pdf'}`;

    const newStartup: Startup = {
      id: newId,
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
      demo_video: data.demo_video,
      status: 'New',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    startups.unshift(newStartup);
    this.saveItems(this.startupsKey, startups);

    // Audit Log
    const logs = this.getItems<AuditLog>(this.logsKey);
    logs.unshift({
      id: Math.random().toString(),
      user_id: null,
      user_email: data.founder_email,
      action: 'Application submitted',
      target_id: newId,
      target_name: data.company_name,
      details: { sector: data.sector, target_raise: data.target_raise },
      created_at: new Date().toISOString()
    });
    this.saveItems(this.logsKey, logs);

    return { success: true, id: newId };
  }

  async getStartups() {
    return this.getItems<Startup>(this.startupsKey);
  }

  async updateStartupStatus(id: string, status: PipelineStatus, user: { id: string; email: string }) {
    const startups = this.getItems<Startup>(this.startupsKey);
    const startup = startups.find(s => s.id === id);
    if (!startup) return false;

    const oldStatus = startup.status;
    startup.status = status;
    startup.updated_at = new Date().toISOString();
    this.saveItems(this.startupsKey, startups);

    // Add Audit Log
    const logs = this.getItems<AuditLog>(this.logsKey);
    logs.unshift({
      id: Math.random().toString(),
      user_id: user.id,
      user_email: user.email,
      action: 'Status changed',
      target_id: id,
      target_name: startup.company_name,
      details: { old_status: oldStatus, new_status: status },
      created_at: new Date().toISOString()
    });
    this.saveItems(this.logsKey, logs);

    return true;
  }

  async deleteStartup(id: string, user: { id: string; email: string }) {
    let startups = this.getItems<Startup>(this.startupsKey);
    const startup = startups.find(s => s.id === id);
    if (!startup) return false;

    startups = startups.filter(s => s.id !== id);
    this.saveItems(this.startupsKey, startups);

    // Clean up notes
    let notes = this.getItems<Note>(this.notesKey);
    notes = notes.filter(n => n.startup_id !== id);
    this.saveItems(this.notesKey, notes);

    // Add Audit Log
    const logs = this.getItems<AuditLog>(this.logsKey);
    logs.unshift({
      id: Math.random().toString(),
      user_id: user.id,
      user_email: user.email,
      action: 'Delete',
      target_id: id,
      target_name: startup.company_name,
      details: { message: `Startup '${startup.company_name}' deleted entirely by admin.` },
      created_at: new Date().toISOString()
    });
    this.saveItems(this.logsKey, logs);

    return true;
  }

  async getNotes(startupId: string) {
    const notes = this.getItems<Note>(this.notesKey);
    return notes.filter(n => n.startup_id === startupId);
  }

  async addNote(startupId: string, content: string, user: { id: string; email: string }) {
    const notes = this.getItems<Note>(this.notesKey);
    const startups = this.getItems<Startup>(this.startupsKey);
    const startup = startups.find(s => s.id === startupId);
    if (!startup) return null;

    const newNote: Note = {
      id: Math.random().toString(),
      startup_id: startupId,
      author_id: user.id,
      author_email: user.email,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    notes.unshift(newNote);
    this.saveItems(this.notesKey, notes);

    // Add Audit Log
    const logs = this.getItems<AuditLog>(this.logsKey);
    logs.unshift({
      id: Math.random().toString(),
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: startupId,
      target_name: startup.company_name,
      details: { message: 'Added reviewer note.' },
      created_at: new Date().toISOString()
    });
    this.saveItems(this.logsKey, logs);

    return newNote;
  }

  async deleteNote(noteId: string, user: { id: string; email: string }) {
    let notes = this.getItems<Note>(this.notesKey);
    const note = notes.find(n => n.id === noteId);
    if (!note) return false;

    notes = notes.filter(n => n.id !== noteId);
    this.saveItems(this.notesKey, notes);

    const startups = this.getItems<Startup>(this.startupsKey);
    const startup = startups.find(s => s.id === note.startup_id);

    // Add Audit Log
    const logs = this.getItems<AuditLog>(this.logsKey);
    logs.unshift({
      id: Math.random().toString(),
      user_id: user.id,
      user_email: user.email,
      action: 'Reviewer note changes',
      target_id: note.startup_id,
      target_name: startup?.company_name || 'Unknown Startup',
      details: { message: 'Deleted reviewer note.' },
      created_at: new Date().toISOString()
    });
    this.saveItems(this.logsKey, logs);

    return true;
  }

  async getSignedUrl(path: string) {
    return `https://documents.example.com/viewer?file=${encodeURIComponent(path)}`;
  }

  async getAuditLogs() {
    return this.getItems<AuditLog>(this.logsKey);
  }

  async importCSV(startupsList: Partial<Startup>[], user: { id: string; email: string }) {
    const existingStartups = this.getItems<Startup>(this.startupsKey);
    const logs = this.getItems<AuditLog>(this.logsKey);
    let importedCount = 0;
    let skippedCount = 0;
    const report: string[] = [];

    const updatedStartups = [...existingStartups];

    for (const item of startupsList) {
      if (!item.company_name) {
        skippedCount++;
        report.push(`Skipped row: Missing Company Name`);
        continue;
      }

      const isDuplicate = existingStartups.some(
        s =>
          s.company_name.toLowerCase() === item.company_name?.toLowerCase() ||
          (s.website && item.website && s.website.toLowerCase().trim() === item.website.toLowerCase().trim())
      );

      if (isDuplicate) {
        skippedCount++;
        report.push(`Skipped duplicate: '${item.company_name}' already exists in CRM.`);
        continue;
      }

      const newId = 'startup-' + Math.random().toString(36).substring(2, 11);
      const newStartup: Startup = {
        id: newId,
        company_name: item.company_name,
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
        pitch_deck_path: item.pitch_deck_path || `pitch-decks/imported_${newId}.pdf`,
        demo_video: item.demo_video,
        status: (item.status as PipelineStatus) || 'New',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      updatedStartups.unshift(newStartup);
      importedCount++;
      report.push(`Successfully imported: '${item.company_name}' (${newStartup.stage}, Sector: ${newStartup.sector})`);

      // Add log
      logs.unshift({
        id: Math.random().toString(),
        user_id: user.id,
        user_email: user.email,
        action: 'Application submitted',
        target_id: newId,
        target_name: item.company_name,
        details: { message: 'Imported via CSV file.', imported_by: user.email },
        created_at: new Date().toISOString()
      });
    }

    this.saveItems(this.startupsKey, updatedStartups);
    this.saveItems(this.logsKey, logs);

    return { imported: importedCount, skipped: skippedCount, report };
  }

  async getAdmins() {
    return this.getItems<Admin>(this.adminsKey);
  }

  async addAdmin(id: string, email: string) {
    const admins = this.getItems<Admin>(this.adminsKey);
    if (admins.some(a => a.id === id || a.email === email)) {
      throw new Error('Admin already exists');
    }
    const newAdmin: Admin = {
      id,
      email,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    admins.push(newAdmin);
    this.saveItems(this.adminsKey, admins);
    return true;
  }

  async deleteAdmin(id: string) {
    let admins = this.getItems<Admin>(this.adminsKey);
    admins = admins.filter(a => a.id !== id);
    this.saveItems(this.adminsKey, admins);
    return true;
  }
}

/**
 * -------------------------------------------------------------
 * REAL SUPABASE SERVICE IMPLEMENTATION
 * -------------------------------------------------------------
 */
class RealSupabaseServiceImpl implements DbService {
  isConfigured(): boolean {
    return true;
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

    for (const item of startupsList) {
      if (!item.company_name) {
        skipped++;
        report.push(`Skipped row: Missing Company Name`);
        continue;
      }

      // Check duplicates by company name in database
      const { data: existing, error: findError } = await client
        .from('startups')
        .select('id')
        .ilike('company_name', item.company_name)
        .maybeSingle();

      if (findError) {
        console.error('Error finding duplicate during import:', findError);
      }

      if (existing) {
        skipped++;
        report.push(`Skipped duplicate: '${item.company_name}' already exists in CRM.`);
        continue;
      }

      const startupPayload = {
        company_name: item.company_name,
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

      const { data: inserted, error: insertError } = await client
        .from('startups')
        .insert(startupPayload)
        .select('id')
        .single();

      if (insertError) {
        skipped++;
        report.push(`Failed to import '${item.company_name}': ${insertError.message}`);
        continue;
      }

      const insertedId = inserted?.id || '';

      imported++;
      report.push(`Successfully imported: '${item.company_name}' (${startupPayload.stage}, Sector: ${startupPayload.sector})`);

      // Add log
      await client.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'Application submitted',
        target_id: insertedId,
        target_name: item.company_name,
        details: { message: 'Imported via CSV file.', imported_by: user.email }
      });
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

    const { error } = await client
      .from('admins')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }
}

// Instantiate the active service based on config detection
export const dbService: DbService = isSupabaseConfigured
  ? new RealSupabaseServiceImpl()
  : new LocalSandboxServiceImpl();
