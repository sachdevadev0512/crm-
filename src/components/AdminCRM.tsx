import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Layers,
  Search,
  Filter,
  FileSpreadsheet,
  History,
  TrendingUp,
  MapPin,
  Clock,
  LogOut,
  Mail,
  ShieldCheck,
  Building,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  FolderOpen,
  Eye,
  Trash2,
  ListFilter,
  ShieldAlert,
  Key,
  Copy,
  Check,
  UserPlus,
  Users
} from 'lucide-react';
import { Startup, AuditLog, PipelineStatus, Admin } from '../types';
import { dbService } from '../services/dbService';
import StartupDetail from './StartupDetail';
import CsvImportTool from './CsvImportTool';

export default function AdminCRM() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; isAdmin: boolean } | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccessMessage, setAuthSuccessMessage] = useState('');
  const [isInitializingAuth, setIsInitializingAuth] = useState(true);
  const [copiedText, setCopiedText] = useState(false);

  // CRM Data States
  const [startups, setStartups] = useState<Startup[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [adminsList, setAdminsList] = useState<Admin[]>([]);
  const [loadingCRMData, setLoadingCRMData] = useState(false);
  const [crmError, setCrmError] = useState('');

  // Admin Management form states
  const [newAdminId, setNewAdminId] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminActionError, setAdminActionError] = useState('');
  const [adminActionSuccess, setAdminActionSuccess] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);

  // UI Navigation states
  const [activeTab, setActiveTab] = useState<'pipeline' | 'table' | 'csv' | 'logs' | 'admins'>('pipeline');
  const [selectedStartup, setSelectedStartup] = useState<Startup | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('All');
  const [selectedStage, setSelectedStage] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'raise' | 'date'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    checkActiveSession();
  }, []);

  const checkActiveSession = async () => {
    setIsInitializingAuth(true);
    setAuthError('');
    try {
      const user = await dbService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        if (user.isAdmin) {
          fetchCRMData();
        }
      } else {
        setCurrentUser(null);
      }
    } catch (e: any) {
      console.error('Session restoration failed:', e);
      setAuthError(e.message || 'Failed to check active session.');
    } finally {
      setIsInitializingAuth(false);
    }
  };

  const fetchCRMData = async () => {
    setLoadingCRMData(true);
    setCrmError('');
    try {
      const [startupsList, logs, admins] = await Promise.all([
        dbService.getStartups(),
        dbService.getAuditLogs(),
        dbService.getAdmins()
      ]);
      setStartups(startupsList);
      setAuditLogs(logs);
      setAdminsList(admins);
    } catch (err: any) {
      console.error(err);
      setCrmError(err.message || 'Failed to load database. Verify Supabase tables and RLS.');
    } finally {
      setLoadingCRMData(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMessage('');
    if (!authEmail.trim() || !authPassword.trim()) return;

    setAuthLoading(true);
    try {
      if (isSignUp) {
        // Sign Up Flow
        const res = await dbService.signUp(authEmail.trim(), authPassword.trim());
        if (res.success) {
          setAuthSuccessMessage('Account registered successfully! Checking authorization status...');
          await checkActiveSession();
        }
      } else {
        // Sign In Flow
        const res = await dbService.signIn(authEmail.trim(), authPassword.trim());
        if (res.success && res.user) {
          setCurrentUser(res.user);
          if (res.user.isAdmin) {
            await fetchCRMData();
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await dbService.signOut();
    setCurrentUser(null);
    setAuthEmail('');
    setAuthPassword('');
    setStartups([]);
    setAuditLogs([]);
    setAdminsList([]);
    setSelectedStartup(null);
  };

  const handleUpdateStatus = async (id: string, status: PipelineStatus) => {
    if (!currentUser) return;
    try {
      const success = await dbService.updateStartupStatus(id, status, currentUser);
      if (success) {
        // Optimistic local state update
        setStartups(prev =>
          prev.map(s => (s.id === id ? { ...s, status, updated_at: new Date().toISOString() } : s))
        );
        // Refresh audit logs
        const logs = await dbService.getAuditLogs();
        setAuditLogs(logs);

        // Update selected startup drawer if active
        if (selectedStartup && selectedStartup.id === id) {
          setSelectedStartup(prev => (prev ? { ...prev, status } : null));
        }
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to update status: ' + err.message);
    }
  };

  // Admin Management actions
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminActionError('');
    setAdminActionSuccess('');
    if (!newAdminId.trim() || !newAdminEmail.trim()) return;

    // UUID format verification
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(newAdminId.trim())) {
      setAdminActionError('User ID must be a valid 36-character UUID string.');
      return;
    }

    setAdminActionLoading(true);
    try {
      const success = await dbService.addAdmin(newAdminId.trim(), newAdminEmail.trim());
      if (success) {
        setAdminActionSuccess(`Successfully authorized ${newAdminEmail} as Admin.`);
        setNewAdminId('');
        setNewAdminEmail('');
        // Refresh crm data (which loads admins and logs)
        await fetchCRMData();
      }
    } catch (err: any) {
      console.error(err);
      setAdminActionError(err.message || 'Failed to authorize admin. Ensure the user exists in Auth users first.');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminEmail: string) => {
    if (adminId === currentUser?.id) {
      alert('Security Protection: You cannot revoke your own administrator privileges while active.');
      return;
    }

    if (!confirm(`Are you absolutely sure you want to revoke Admin rights for ${adminEmail}? This user will instantly lose CRM access.`)) {
      return;
    }

    setAdminActionError('');
    setAdminActionSuccess('');
    try {
      const success = await dbService.deleteAdmin(adminId);
      if (success) {
        setAdminActionSuccess(`Successfully revoked Admin privileges for ${adminEmail}.`);
        await fetchCRMData();
      }
    } catch (err: any) {
      console.error(err);
      setAdminActionError(err.message || 'Failed to delete admin.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Pipeline Board structure
  const pipelineStatuses: PipelineStatus[] = [
    'New',
    'Screening',
    'Meeting',
    'Due Diligence',
    'Approved',
    'Rejected',
    'Archived',
  ];

  // Filtering Logic
  const filteredStartups = startups.filter(s => {
    const matchesSearch =
      s.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.one_line_pitch.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.founder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.hq_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.sector.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSector = selectedSector === 'All' || s.sector === selectedSector;
    const matchesStage = selectedStage === 'All' || s.stage === selectedStage;

    return matchesSearch && matchesSector && matchesStage;
  });

  // Sorting Logic
  const sortedStartups = [...filteredStartups].sort((a, b) => {
    let valueA: any = a.created_at;
    let valueB: any = b.created_at;

    if (sortBy === 'name') {
      valueA = a.company_name.toLowerCase();
      valueB = b.company_name.toLowerCase();
    } else if (sortBy === 'raise') {
      valueA = a.target_raise;
      valueB = b.target_raise;
    }

    if (valueA < valueB) return sortOrder === 'asc' ? -1 : 1;
    if (valueA > valueB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Unique list of sectors and stages for filter buttons
  const availableSectors = ['All', ...Array.from(new Set(startups.map(s => s.sector)))];
  const availableStages = ['All', ...Array.from(new Set(startups.map(s => s.stage)))];

  const toggleSort = (field: 'name' | 'raise' | 'date') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Auth checking state screen
  if (isInitializingAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
        <span className="text-xs text-neutral-400 font-mono">Verifying administrative session...</span>
      </div>
    );
  }

  // 1. Unauthenticated Login/Signup Gate
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4" id="admin-login-screen">
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md bg-white border border-neutral-200 rounded-2xl p-8 shadow-xs space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <Lock className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
              Middha Ventures Admin CRM
            </h1>
            <p className="text-neutral-500 text-xs">
              {isSignUp ? 'Create your internal admin CRM account.' : 'Secure credential gateway for authorized investment team members.'}
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccessMessage && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg flex items-start gap-2 text-neutral-600 text-xs">
              <ShieldCheck className="h-4 w-4 text-neutral-800 shrink-0 mt-0.5" />
              <span>{authSuccessMessage}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-1.5" id="login_email_input">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="email">
                Business Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  type="email"
                  id="email"
                  placeholder="partner@middhaventures.com"
                  value={authEmail}
                  onChange={e => setAuthEmail(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5" id="login_password_input">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-400 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              id="btn-login-submit"
            >
              {authLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
              {isSignUp ? 'Register Admin Account' : 'Sign In to CRM'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="text-center pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError('');
                setAuthSuccessMessage('');
              }}
              className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              {isSignUp ? 'Already registered? Sign In instead' : "Don't have an account? Sign Up / Register"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. Authenticated but Unauthorized State (Not in public.admins)
  if (!currentUser.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center" id="unauthorized-screen">
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-lg bg-white border border-neutral-200 rounded-2xl p-8 shadow-sm space-y-6"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 border border-amber-150">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-neutral-900 tracking-tight">
              Access Authorization Required
            </h1>
            <p className="text-neutral-500 text-xs leading-relaxed max-w-md mx-auto">
              Your credentials are valid as <span className="font-semibold text-neutral-800 font-mono">{currentUser.email}</span>, but your account is not authorized in our <span className="font-mono text-[11px] font-semibold">public.admins</span> registry yet.
            </p>
          </div>

          {/* User Details Block */}
          <div className="p-5 bg-neutral-50 border border-neutral-200 rounded-xl text-left space-y-3 text-xs font-mono">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-200">
              <span className="text-[10px] text-neutral-400 uppercase font-bold">Account Metadata</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold uppercase">Pending authorization</span>
            </div>
            
            <div className="space-y-2">
              <div>
                <span className="text-neutral-400">EMAIL:</span>
                <span className="text-neutral-850 ml-2 font-bold">{currentUser.email}</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-100/60 p-2 rounded border border-neutral-200/50">
                <div className="truncate">
                  <span className="text-neutral-400">USER ID:</span>
                  <span className="text-neutral-850 ml-2 font-bold select-all">{currentUser.id}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(currentUser.id)}
                  className="p-1 hover:bg-neutral-200 rounded text-neutral-500 transition-colors shrink-0 ml-2"
                  title="Copy User ID to Clipboard"
                >
                  {copiedText ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Setup / Bootstrap Instructions */}
          <div className="p-5 bg-neutral-900 text-white rounded-xl text-left space-y-3 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <Building className="h-4 w-4" />
              <span>Bootstrapping Instructions</span>
            </div>
            <p className="text-neutral-300 text-[11px] leading-relaxed">
              If you are the developer or first team member bootstrapping this CRM, please copy your User ID above and execute the following SQL statement in your <b>Supabase SQL Editor</b> to authorize yourself:
            </p>
            <pre className="p-3 bg-neutral-950 rounded text-amber-300 font-mono text-[10px] overflow-x-auto whitespace-pre select-all">
{`INSERT INTO public.admins (id, email)
VALUES ('${currentUser.id}', '${currentUser.email}');`}
            </pre>
            <p className="text-neutral-400 text-[9px]">
              Once you run this SQL, click the "Re-Check Authorization Status" button below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button
              onClick={checkActiveSession}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-850 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Re-Check Authorization Status
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-700 font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              id="btn-unauth-logout"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out & Switch Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 3. Fully Authorized Admin CRM Screen
  return (
    <div className="space-y-6" id="admin-crm-dashboard">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-neutral-200 rounded-xl p-6 shadow-3xs">
        <div className="space-y-1">
          <span className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase font-mono">
            INTERNAL CRM PORTAL
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Middha Ventures Dealroom
          </h1>
          <p className="text-xs text-neutral-500">
            Authenticated: <span className="font-semibold font-mono text-neutral-700">{currentUser.email}</span> (Admin)
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchCRMData}
            disabled={loadingCRMData}
            className="p-2 border border-neutral-200 hover:bg-neutral-50 disabled:bg-neutral-100 rounded-lg text-neutral-600 transition-colors"
            title="Refresh database"
            id="btn-refresh-crm"
          >
            <RefreshCw className={`h-4 w-4 ${loadingCRMData ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleSignOut}
            className="px-3 py-2 border border-neutral-200 hover:bg-neutral-50 hover:text-red-600 text-neutral-600 font-semibold text-xs rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            id="btn-crm-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>

      {/* Database sync error alert */}
      {crmError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-red-800">Database Connection Error</p>
            <p className="mt-0.5">{crmError}</p>
            <p className="mt-2 text-[10px] opacity-80 font-mono">
              Have you run the database migrations in Supabase SQL editor? See '/supabase/migrations/01_init.sql' inside our codebase.
            </p>
          </div>
        </div>
      )}

      {/* Database Key Banner if using sandbox mode */}
      {!dbService.isConfigured() && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex justify-between items-center gap-4">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 block">Supabase Keys Missing (Development Sandbox Enabled)</span>
              <span className="opacity-90">Running in highly durable local local-session simulation. All CRM and application features are fully operational. Add credentials in Secrets panel to connect your real Supabase.</span>
            </div>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 border border-amber-300 rounded font-bold text-[9px] uppercase tracking-wider font-mono shrink-0">
            Sandbox
          </span>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap gap-1 bg-white border border-neutral-200 p-1 rounded-lg shadow-3xs text-xs max-w-2xl">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pipeline' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
          id="tab-pipeline-board"
        >
          <Layers className="h-3.5 w-3.5" />
          Pipeline Board
        </button>
        <button
          onClick={() => setActiveTab('table')}
          className={`px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'table' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
          id="tab-deal-table"
        >
          <Briefcase className="h-3.5 w-3.5" />
          Deal Table
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'csv' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
          id="tab-csv-import"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          CSV Import
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'logs' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
          id="tab-audit-logs"
        >
          <History className="h-3.5 w-3.5" />
          Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-1.5 rounded-md font-semibold text-center transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'admins' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
          }`}
          id="tab-admin-management"
        >
          <Users className="h-3.5 w-3.5" />
          Admin Management
        </button>
      </div>

      {/* FILTER PANEL (Only shown for Pipeline & Table) */}
      {(activeTab === 'pipeline' || activeTab === 'table') && (
        <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-3xs grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by company, sector, pitch keywords, founders, hq..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
              id="crm-search-input"
            />
          </div>

          {/* Sector filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 hover:border-neutral-300 text-xs rounded-lg outline-none cursor-pointer"
            >
              <option value="All">All Sectors</option>
              {availableSectors.filter(s => s !== 'All').map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>

          {/* Stage filter */}
          <div className="flex items-center gap-2">
            <ListFilter className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-neutral-50 border border-neutral-200 focus:border-neutral-900 hover:border-neutral-300 text-xs rounded-lg outline-none cursor-pointer"
            >
              <option value="All">All Stages</option>
              {availableStages.filter(s => s !== 'All').map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* CORE VIEWPORT BOX */}
      <div id="crm-viewport">
        {loadingCRMData ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white border border-neutral-200 rounded-xl">
            <RefreshCw className="h-6 w-6 animate-spin text-neutral-400" />
            <span className="text-xs text-neutral-400 font-mono">Synchronizing database tables...</span>
          </div>
        ) : activeTab === 'pipeline' ? (
          /* PIPELINE BOARD VIEW */
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-start overflow-x-auto pb-4" id="pipeline-board">
            {pipelineStatuses.map(status => {
              const columnStartups = sortedStartups.filter(s => s.status === status);
              return (
                <div
                  key={status}
                  className="bg-neutral-50 border border-neutral-200/60 rounded-xl p-3 space-y-3 min-w-[220px] max-h-[80vh] flex flex-col"
                >
                  {/* Column Header */}
                  <div className="flex justify-between items-center px-1 border-b border-neutral-200 pb-1.5 shrink-0">
                    <span className="text-xs font-bold text-neutral-800 tracking-tight">{status}</span>
                    <span className="px-1.5 py-0.5 bg-neutral-200 text-[10px] font-bold rounded-full text-neutral-600 font-mono">
                      {columnStartups.length}
                    </span>
                  </div>

                  {/* Cards container */}
                  <div className="space-y-2 overflow-y-auto flex-1 pr-0.5">
                    {columnStartups.length === 0 ? (
                      <div className="text-center py-8 text-[10px] border border-dashed border-neutral-200 rounded-lg text-neutral-400">
                        No deals
                      </div>
                    ) : (
                      columnStartups.map(s => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedStartup(s)}
                          className="bg-white border border-neutral-200 hover:border-neutral-900 hover:shadow-2xs p-3 rounded-lg cursor-pointer transition-all space-y-2 text-xs group relative text-left"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-semibold text-neutral-900 group-hover:underline line-clamp-1">
                              {s.company_name}
                            </span>
                          </div>
                          
                          <p className="text-neutral-500 text-[10px] leading-snug line-clamp-2">
                            {s.one_line_pitch}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="px-1.5 py-0.5 bg-neutral-100 text-[9px] font-medium text-neutral-600 rounded">
                              {s.stage}
                            </span>
                            <span className="px-1.5 py-0.5 bg-neutral-100 text-[9px] font-medium text-neutral-600 rounded truncate max-w-[100px]">
                              {s.hq_location}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-neutral-100 flex justify-between items-center text-[9px] font-mono text-neutral-400">
                            <span>Raise: ${s.target_raise.toLocaleString()}</span>
                          </div>

                          {/* Fast Move dropdown on hover */}
                          <div
                            onClick={e => e.stopPropagation()}
                            className="absolute right-2 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <select
                              value={s.status}
                              onChange={e => handleUpdateStatus(s.id, e.target.value as PipelineStatus)}
                              className="px-1 py-0.5 bg-neutral-50 border border-neutral-200 text-[9px] font-semibold text-neutral-600 rounded outline-none cursor-pointer"
                              title="Move Status"
                            >
                              {pipelineStatuses.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'table' ? (
          /* DEAL TABLE VIEW */
          <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden shadow-3xs" id="deal-table">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-250 text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                    <th className="px-6 py-3 cursor-pointer hover:bg-neutral-100" onClick={() => toggleSort('name')}>
                      Company Name {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3">Sector</th>
                    <th className="px-6 py-3">Location</th>
                    <th className="px-6 py-3">Stage</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-neutral-100" onClick={() => toggleSort('raise')}>
                      Target Raise {sortBy === 'raise' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 cursor-pointer hover:bg-neutral-100" onClick={() => toggleSort('date')}>
                      Applied On {sortBy === 'date' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150">
                  {sortedStartups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16 text-neutral-400 font-mono">
                        No database records matched your active search and filter presets.
                      </td>
                    </tr>
                  ) : (
                    sortedStartups.map(s => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedStartup(s)}
                        className="hover:bg-neutral-50/50 cursor-pointer group text-left"
                      >
                        <td className="px-6 py-3 font-semibold text-neutral-900 group-hover:underline">
                          {s.company_name}
                        </td>
                        <td className="px-6 py-3 text-neutral-600">{s.sector}</td>
                        <td className="px-6 py-3 text-neutral-600">{s.hq_location}</td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded font-medium text-neutral-700">
                            {s.stage}
                          </span>
                        </td>
                        <td className="px-6 py-3 font-mono text-neutral-900 font-semibold">
                          ${s.target_raise.toLocaleString()}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              s.status === 'Approved'
                                ? 'bg-neutral-100 text-neutral-800 border border-neutral-300'
                                : s.status === 'Rejected'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : s.status === 'Archived'
                                ? 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                                : 'bg-neutral-50 text-neutral-700 border border-neutral-250'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-neutral-500 font-mono">
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedStartup(s)}
                            className="p-1.5 hover:bg-neutral-100 text-neutral-600 hover:text-neutral-900 rounded-lg transition-colors inline-flex items-center gap-1 font-semibold"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'csv' ? (
          /* CSV BATCH IMPORT TAB */
          <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-3xs">
            <CsvImportTool
              currentUser={currentUser}
              onImportSuccess={fetchCRMData}
            />
          </div>
        ) : activeTab === 'logs' ? (
          /* AUDIT LOG RECORDS TAB */
          <div className="border border-neutral-200 bg-white rounded-xl overflow-hidden shadow-3xs" id="audit-logs text-left">
            <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/20 text-left">
              <h3 className="font-semibold text-sm text-neutral-900">Security Audit Logs</h3>
              <p className="text-neutral-500 text-[11px] mt-0.5">
                Comprehensive, read-only sequence of all database mutations, status modifications, note revisions, and CSV imports.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px] font-mono">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200 font-semibold text-neutral-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Operator User</th>
                    <th className="px-6 py-3">Action Mutex</th>
                    <th className="px-6 py-3">Target Reference</th>
                    <th className="px-6 py-3">Metadata Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-150 text-neutral-600">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-neutral-400">
                        No audit logs found in public.audit_logs.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-neutral-50/50 text-left">
                        <td className="px-6 py-3 text-neutral-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 font-semibold text-neutral-800">
                          {log.user_email || 'System Submit'}
                        </td>
                        <td className="px-6 py-3">
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                              log.action === 'Admin bootstrapped'
                                ? 'bg-emerald-50 text-emerald-800'
                                : log.action === 'Delete'
                                ? 'bg-red-50 text-red-800'
                                : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-neutral-800 font-semibold truncate max-w-[150px]">
                          {log.target_name}
                        </td>
                        <td className="px-6 py-3 text-[10px] text-neutral-500 max-w-sm truncate" title={JSON.stringify(log.details)}>
                          {log.details ? JSON.stringify(log.details) : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ADMIN MANAGEMENT VIEW */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="admin-management-view">
            {/* Left/Middle Column: List of Admins */}
            <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-3xs flex flex-col">
              <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/20 text-left">
                <h3 className="font-semibold text-sm text-neutral-900">Active CRM Administrators</h3>
                <p className="text-neutral-500 text-[11px] mt-0.5">
                  Users registered below are authorized to access the deal pipeline, review notes, generate signed deck URLs, and run bulk migrations.
                </p>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase tracking-wider font-mono">
                      <th className="px-6 py-3">Administrator Email</th>
                      <th className="px-6 py-3">User UUID (Auth Ref)</th>
                      <th className="px-6 py-3">Granted On</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-150">
                    {adminsList.map(admin => (
                      <tr key={admin.id} className="hover:bg-neutral-50/30 text-left">
                        <td className="px-6 py-3.5 font-semibold text-neutral-900 flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 bg-green-500 rounded-full"></span>
                          {admin.email}
                          {admin.id === currentUser?.id && (
                            <span className="px-1.5 py-0.5 bg-neutral-100 border border-neutral-250 text-[9px] text-neutral-500 rounded font-bold uppercase ml-2">
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-neutral-500 text-[11px]">
                          {admin.id}
                        </td>
                        <td className="px-6 py-3.5 text-neutral-500 font-mono">
                          {admin.created_at ? new Date(admin.created_at).toLocaleDateString() : 'Bootstrap'}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteAdmin(admin.id, admin.email)}
                            disabled={admin.id === currentUser?.id}
                            className={`p-1.5 rounded-lg border transition-colors inline-flex items-center gap-1 font-semibold ${
                              admin.id === currentUser?.id
                                ? 'border-neutral-150 bg-neutral-50 text-neutral-300 cursor-not-allowed'
                                : 'border-neutral-200 hover:border-red-200 hover:bg-red-50 text-neutral-500 hover:text-red-600'
                            }`}
                            title={admin.id === currentUser?.id ? 'You cannot de-authorize your active account.' : 'Revoke admin access'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Authorize subsequent admin */}
            <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-3xs space-y-4 h-fit text-left">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-neutral-900 font-semibold text-sm">
                  <UserPlus className="h-4.5 w-4.5" />
                  <span>Authorize New Administrator</span>
                </div>
                <p className="text-neutral-500 text-[11px] leading-relaxed">
                  To register a new admin, they must first sign up on the CRM login screen to create their credentials. Once they share their User UUID, paste it below.
                </p>
              </div>

              {adminActionError && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-lg flex items-start gap-2 text-red-700 text-xs font-sans">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{adminActionError}</span>
                </div>
              )}

              {adminActionSuccess && (
                <div className="p-3 bg-green-50 border border-green-150 rounded-lg flex items-start gap-2 text-green-800 text-xs font-sans">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                  <span>{adminActionSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAddAdmin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="admin-uuid">
                    User ID (UUID)
                  </label>
                  <input
                    type="text"
                    id="admin-uuid"
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                    value={newAdminId}
                    onChange={e => setNewAdminId(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500" htmlFor="admin-email">
                    Administrator Email
                  </label>
                  <input
                    type="email"
                    id="admin-email"
                    placeholder="partner-name@middhaventures.com"
                    value={newAdminEmail}
                    onChange={e => setNewAdminEmail(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 focus:border-neutral-900 focus:bg-white rounded-lg transition-colors outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={adminActionLoading}
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-850 disabled:bg-neutral-400 text-white font-semibold text-xs rounded-lg inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {adminActionLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
                  Grant CRM Access Rights
                </button>
              </form>

              <div className="p-3 bg-neutral-50 border border-neutral-200/60 rounded-lg space-y-1.5 text-[10px] text-neutral-500 font-sans leading-relaxed">
                <div className="font-semibold text-neutral-700 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-neutral-400" />
                  <span>RLS Gated Action</span>
                </div>
                <span>Adding administrators performs a direct database write on the <b>admins</b> table. Your current session must be active inside <b>public.admins</b> to successfully execute this action.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DRAWER DRAWER DRAWER */}
      <AnimatePresence>
        {selectedStartup && (
          <StartupDetail
            startup={selectedStartup}
            currentUser={currentUser}
            onClose={() => setSelectedStartup(null)}
            onUpdateStatus={status => handleUpdateStatus(selectedStartup.id, status)}
            onDelete={() => {
              setSelectedStartup(null);
              fetchCRMData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
