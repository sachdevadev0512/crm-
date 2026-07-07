import React, { useState } from 'react';
import FormPortal from './components/FormPortal';
import AdminCRM from './components/AdminCRM';
import { Layers, UserCircle2, ShieldCheck, Cpu } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState<'public' | 'admin'>('public');

  return (
    <div className="min-h-screen bg-neutral-50/50 flex flex-col font-sans" id="mv-app-root">
      {/* Platform Subdomain Switcher - Styled as a Professional Local Host Utility Bar */}
      <header className="bg-neutral-900 border-b border-neutral-850 px-4 py-2.5 text-white flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-neutral-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-300 font-mono">
            Middha Ventures Network Preview
          </span>
        </div>

        {/* Subdomain Swapping Tabs */}
        <div className="flex bg-neutral-950/80 p-0.5 rounded-lg border border-neutral-800/60 max-w-sm">
          <button
            onClick={() => setCurrentView('public')}
            className={`px-3.5 py-1 rounded text-[11px] font-semibold transition-all inline-flex items-center gap-1.5 ${
              currentView === 'public'
                ? 'bg-white text-neutral-900 font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
            id="btn-nav-public"
          >
            <UserCircle2 className="h-3.5 w-3.5" />
            Public Portal <span className="text-[9px] opacity-60 font-normal hidden sm:inline">(apply.mv.com)</span>
          </button>
          <button
            onClick={() => setCurrentView('admin')}
            className={`px-3.5 py-1 rounded text-[11px] font-semibold transition-all inline-flex items-center gap-1.5 ${
              currentView === 'admin'
                ? 'bg-white text-neutral-900 font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
            id="btn-nav-admin"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin CRM <span className="text-[9px] opacity-60 font-normal hidden sm:inline">(crm.mv.com)</span>
          </button>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[10px] font-mono text-neutral-400">
          <span>HOST: PORT_3000</span>
          <span className="text-neutral-600">•</span>
          <span>MODE: FULL_STACK</span>
        </div>
      </header>

      {/* Main App Container */}
      <main className="flex-1 overflow-y-auto">
        {currentView === 'public' ? (
          <FormPortal />
        ) : (
          <div className="max-w-7xl mx-auto px-4 py-8">
            <AdminCRM />
          </div>
        )}
      </main>
    </div>
  );
}

