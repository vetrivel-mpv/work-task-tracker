import React, { useState } from 'react';
import { AppState, TeamGroup, ThemeId } from '../../types';
import { 
  Settings as SettingsIcon, 
  Download, 
  Upload, 
  RotateCcw, 
  Save, 
  Users, 
  Mail, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Plus,
  Trash2,
  Palette,
  Check,
  Building2,
  Globe2,
  FolderGit2
} from 'lucide-react';
import { exportBackupJSON, importBackupJSON } from '../../utils/storage';
import { generateId } from '../../utils/date';

interface SettingsViewProps {
  state: AppState;
  onUpdateState: (state: AppState) => void;
  onResetData: () => void;
}

const THEME_OPTIONS: { id: ThemeId; name: string; description: string; primary: string; surface: string; border: string; dark?: boolean }[] = [
  {
    id: 'executive_slate',
    name: 'Executive Slate & Ocean',
    description: 'Crisp light slate aesthetic with deep navy slate accents and rich ocean blue highlights.',
    primary: '#0284C7',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    dark: false
  },
  {
    id: 'obsidian_dark',
    name: 'Obsidian High-Contrast Dark',
    description: 'Sophisticated deep obsidian cockpit with indigo neon indicators and high legible contrast.',
    primary: '#6366F1',
    surface: '#0F172A',
    border: '#1E293B',
    dark: true
  },
  {
    id: 'steel_minimal',
    name: 'Steel Architectural Minimal',
    description: 'Clean monochrome steel architecture with cool titanium borders and subtle zinc focus rings.',
    primary: '#475569',
    surface: '#FFFFFF',
    border: '#E2E8F0',
    dark: false
  },
  {
    id: 'crimson_ops',
    name: 'Crimson Operations & SRE',
    description: 'High-alert emergency triage workspace with rich cardinal ruby accents and warm obsidian chrome.',
    primary: '#E11D48',
    surface: '#0E131F',
    border: '#1E293B',
    dark: true
  }
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateState,
  onResetData
}) => {
  const [appName, setAppName] = useState(state.settings.appName || 'Northstar Delivery Hub');
  const [emailRecipient, setEmailRecipient] = useState(state.settings.emailRecipient || 'engineering-leads@careflow.io');
  const [geminiModel, setGeminiModel] = useState(state.settings.geminiModel || 'gemini-2.5-flash');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(state.settings.theme || 'executive_slate');
  
  // Group state
  const [groups, setGroups] = useState<TeamGroup[]>(state.groups || []);
  const [newGroupName, setNewGroupName] = useState('');
  
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');

  const handleSelectTheme = (themeId: ThemeId) => {
    setSelectedTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    onUpdateState({
      ...state,
      settings: {
        ...state.settings,
        theme: themeId
      }
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    document.documentElement.setAttribute('data-theme', selectedTheme);
    onUpdateState({
      ...state,
      groups,
      settings: {
        ...state.settings,
        appName,
        emailRecipient,
        geminiModel,
        theme: selectedTheme
      }
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    setGroups([
      ...groups,
      {
        id: generateId('grp'),
        name: newGroupName.trim(),
        color: '#0284C7',
        memberIds: []
      }
    ]);
    setNewGroupName('');
  };

  const handleDeleteGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  const handleExportBackup = () => {
    exportBackupJSON(state);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const imported = importBackupJSON(content);
      if (imported) {
        onUpdateState(imported);
        if (imported.settings?.theme) {
          document.documentElement.setAttribute('data-theme', imported.settings.theme);
        }
        setImportStatus('Backup restored successfully!');
        setTimeout(() => setImportStatus(''), 3000);
      } else {
        setImportStatus('Invalid JSON backup file format.');
        setTimeout(() => setImportStatus(''), 4000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">System Settings, Themes & ADO Sync</h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Configure color themes, dual Azure DevOps parameters, squad structure, and disaster backups
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--low-bg)] text-[var(--low)] text-xs font-bold animate-in fade-in border border-[var(--low-border)]">
            <CheckCircle2 size={14} />
            <span>Settings saved</span>
          </div>
        )}
      </div>

      {/* THEME SELECTOR CARD */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border)]">
          <Palette size={18} className="text-[var(--primary)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Portal Color Theme Engine
          </h2>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Choose a tailored visual palette. The theme updates instantly across all views, boards, defects triage, and email generators.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {THEME_OPTIONS.map((theme) => {
            const isSelected = selectedTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleSelectTheme(theme.id)}
                className={`p-4 rounded-xl text-left border-2 transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]/40 shadow-sm'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{theme.name}</span>
                      {theme.dark && (
                        <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#0F172A] text-[#94A3B8] border border-[#334155]">
                          DARK
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {theme.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0">
                      <Check size={12} />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                  <div className="w-4 h-4 rounded-md shadow-xs border border-black/10" style={{ backgroundColor: theme.primary }} />
                  <div className="w-4 h-4 rounded-md shadow-xs border border-black/10" style={{ backgroundColor: theme.surface }} />
                  <div className="w-4 h-4 rounded-md shadow-xs border border-black/10" style={{ backgroundColor: theme.border }} />
                  <span className="text-[10px] font-mono-token text-[var(--text-muted)] ml-auto">
                    [data-theme="{theme.id}"]
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* DUAL AZURE DEVOPS INSTANCES OVERVIEW */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border)]">
          <FolderGit2 size={18} className="text-[var(--primary)]" />
          <h2 className="text-sm font-bold text-[var(--text-primary)]">
            Connected Dual Azure DevOps Instances
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Internal ADO Summary */}
          <div className="p-4 rounded-xl border border-[var(--primary)]/30 bg-[var(--internal-ado-bg)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-[var(--internal-ado)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">1. Internal ADO (Dev & QA)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--low-bg)] text-[var(--low)] border border-[var(--low-border)]">
                CONNECTED
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] flex flex-col gap-0.5 mt-1 font-mono-token">
              <div><strong>Org:</strong> {state.dualAdoConfig?.internal?.organization || 'careflow-dev-core'}</div>
              <div><strong>Project:</strong> {state.dualAdoConfig?.internal?.project || 'CareFlow-Core-EHR'}</div>
              <div><strong>Suite:</strong> {state.dualAdoConfig?.internal?.testPlanSettings?.testSuite || 'Telehealth & Clinical Pipeline'}</div>
            </div>
            <div className="text-[10.5px] text-[var(--internal-ado)] font-semibold mt-1">
              Synchronizes: Dev Activities, User Stories, QA Defects, Test Plan & Test Reports.
            </div>
          </div>

          {/* External ADO Summary */}
          <div className="p-4 rounded-xl border border-[var(--external-ado)]/30 bg-[var(--external-ado-bg)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe2 size={16} className="text-[var(--external-ado)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">2. External ADO (Customer & OPS)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--low-bg)] text-[var(--low)] border border-[var(--low-border)]">
                CONNECTED
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] flex flex-col gap-0.5 mt-1 font-mono-token">
              <div><strong>Org:</strong> {state.dualAdoConfig?.external?.organization || 'healthtech-customer-ops'}</div>
              <div><strong>Project:</strong> {state.dualAdoConfig?.external?.project || 'CareFlow-Customer-Support'}</div>
              <div><strong>Area:</strong> {state.dualAdoConfig?.external?.areaPath || 'CareFlow-Ops\\Customer-Escalations'}</div>
            </div>
            <div className="text-[10.5px] text-[var(--external-ado)] font-semibold mt-1">
              Synchronizes: Customer Defects, Hospital Client SLAs, OPS Incident Tickets.
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
        <h2 className="text-sm font-bold text-[var(--text-primary)] pb-2 border-b border-[var(--border)]">
          General Application Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Application Title</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Default Report Email Recipient</label>
            <input
              type="email"
              value={emailRecipient}
              onChange={(e) => setEmailRecipient(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Gemini AI Model Engine</label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fastest & High Quality Delivery Reasoning)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Architecture & Root Cause Analysis)</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </select>
          </div>
        </div>

        {/* Squads / Groups Management */}
        <div className="pt-3 border-t border-[var(--border)]">
          <label className="block text-xs font-bold text-[var(--text-primary)] mb-2">
            Engineering Squads & Pods
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {groups.map(g => (
              <div 
                key={g.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)]"
              >
                <span>{g.name}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(g.id)}
                  className="text-[var(--text-muted)] hover:text-[var(--critical)]"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 max-w-sm">
            <input
              type="text"
              placeholder="New squad name (e.g. Telehealth Pod)..."
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="flex-1 text-xs px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={handleAddGroup}
              className="px-3 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-3 border-t border-[var(--border)]">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all"
          >
            <Save size={14} />
            <span>Save All Preferences</span>
          </button>
        </div>
      </form>

      {/* Backup & Persistence Operations */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)] pb-2 border-b border-[var(--border)]">
          Data Backup & Disaster Recovery
        </h2>

        <p className="text-xs text-[var(--text-secondary)]">
          Export a complete, self-contained JSON snapshot containing all tasks, user stories, dual ADO configs, defect records, team rosters, and historical 1-on-1 reviews.
        </p>

        {importStatus && (
          <div className="p-3 rounded-xl bg-[var(--low-bg)] text-[var(--low)] text-xs font-bold border border-[var(--low-border)]">
            {importStatus}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Download size={14} className="text-[var(--primary)]" />
            <span>Export Snapshot (.json)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--text-primary)] bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-xl shadow-xs transition-all cursor-pointer">
            <Upload size={14} className="text-[var(--primary)]" />
            <span>Restore from File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all tasks, stories, and defects to original sample workspace data?')) {
                onResetData();
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--critical)] bg-[var(--critical-bg)] hover:bg-[var(--critical-bg)] border border-[var(--critical-border)] rounded-xl shadow-xs transition-all ml-auto cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Reset to Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};

