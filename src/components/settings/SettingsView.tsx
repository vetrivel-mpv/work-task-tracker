import React, { useState } from 'react';
import { AppState, TeamGroup, ThemeId, LayoutDensity } from '../../types';
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
  FolderGit2,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Rows3,
  LayoutGrid,
  Laptop,
  MailCheck,
  BookmarkPlus,
  Compass,
  Layers,
  ChevronRight
} from 'lucide-react';
import { exportBackupJSON, importBackupJSON } from '../../utils/storage';
import { generateId } from '../../utils/date';

interface SettingsViewProps {
  state: AppState;
  onUpdateState: (state: AppState) => void;
  onResetData: () => void;
  onOpenAdoModal?: () => void;
}

const DENSITY_OPTIONS: {
  id: LayoutDensity;
  name: string;
  badge: string;
  description: string;
  cardPadding: string;
  rowHeight: string;
  densityBoost: string;
}[] = [
  {
    id: 'comfortable',
    name: 'Comfortable Spacing (Default)',
    badge: 'Relaxed',
    description: 'Generous 14px card padding and breathable 44px table rows. Perfect for touch, presentations, and comfortable reading.',
    cardPadding: '14px padding',
    rowHeight: '44px height',
    densityBoost: 'Standard Rhythm'
  },
  {
    id: 'compact',
    name: 'Compact Spacing (High Density)',
    badge: 'Condensed',
    description: 'Condensed 8px card padding and streamlined 28px table rows. Maximizes visible items per screen with +40% data density.',
    cardPadding: '8px padding',
    rowHeight: '28px height',
    densityBoost: '+40% Screen Real Estate'
  }
];

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

export interface ProjectPreset {
  id: string;
  name: string;
  appName: string;
  projectCode: string;
  projectSubtitle: string;
  clientName?: string;
  description: string;
  iconBg: string;
  isCustom?: boolean;
}

const DEFAULT_PROJECT_PRESETS: ProjectPreset[] = [
  {
    id: 'acm',
    name: 'ACM (AT&T Connection Manager)',
    appName: 'ACM (AT&T Connection Manager) Delivery',
    projectCode: 'ACM',
    projectSubtitle: 'AT&T Connection Manager Delivery Hub',
    clientName: 'AT&T',
    description: 'Specialized enterprise delivery portal for AT&T Connection Manager modules, VPN clients, and telecom releases.',
    iconBg: '#0284C7'
  },
  {
    id: 'spectrum',
    name: 'Charter Spectrum Mobile & Broadband',
    appName: 'Charter Spectrum Delivery Engine',
    projectCode: 'SPEC',
    projectSubtitle: 'Spectrum Wireless & Broadband Operations',
    clientName: 'Charter Spectrum',
    description: 'Telecom edge delivery portal for fiber connectivity, mobile activations, and router firmware rollouts.',
    iconBg: '#0284C7'
  },
  {
    id: 'verizon',
    name: 'Verizon 5G Enterprise & Telematics',
    appName: 'Verizon 5G Enterprise Delivery',
    projectCode: 'VZN',
    projectSubtitle: 'Verizon 5G Edge & Telematics Operations',
    clientName: 'Verizon Enterprise',
    description: 'Mission-critical fleet telemetry, edge network slicing, and enterprise IoT sprint delivery.',
    iconBg: '#DC2626'
  },
  {
    id: 'northstar',
    name: 'Northstar Delivery Hub',
    appName: 'Northstar Delivery Hub',
    projectCode: 'NDH',
    projectSubtitle: 'Unified Engineering & QA Operations Portal',
    clientName: 'Northstar Systems',
    description: 'Cross-functional agile delivery, daily standup tracking, defect triage, and executive reporting.',
    iconBg: '#0C6E5E'
  },
  {
    id: 'careflow',
    name: 'CareFlow Health Platform',
    appName: 'CareFlow Health Delivery',
    projectCode: 'CFH',
    projectSubtitle: 'Clinical Telehealth & Patient Experience Portal',
    clientName: 'CareFlow Health',
    description: 'Healthcare workflows, HIPAA clinical milestones, telemedicine integrations, and QA compliance.',
    iconBg: '#7C3AED'
  },
  {
    id: 'cloud_migration',
    name: 'Enterprise Cloud Modernization',
    appName: 'Enterprise Cloud Delivery Hub',
    projectCode: 'ECM',
    projectSubtitle: 'Infrastructure Modernization & Microservices',
    clientName: 'Enterprise Cloud Co.',
    description: 'Large-scale cloud modernization, Kubernetes containerization, and platform engineering governance.',
    iconBg: '#D97706'
  }
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateState,
  onResetData,
  onOpenAdoModal
}) => {
  const [appName, setAppName] = useState(state.settings.appName || 'ACM (AT&T Connection Manager) Delivery');
  const [projectCode, setProjectCode] = useState(state.settings.projectCode || 'ACM');
  const [projectSubtitle, setProjectSubtitle] = useState(state.settings.projectSubtitle || 'AT&T Connection Manager Delivery Hub');
  const [clientName, setClientName] = useState(state.settings.clientName || 'AT&T');
  const [emailRecipient, setEmailRecipient] = useState(state.settings.emailRecipient || 'engineering-leads@careflow.io');
  const [qaTeamEmail, setQaTeamEmail] = useState(state.settings.qaTeamEmail || 'qa-leads@careflow.io');
  const [devLeadEmail, setDevLeadEmail] = useState(state.settings.devLeadEmail || 'dev-leads@careflow.io');
  const [releaseManagerEmail, setReleaseManagerEmail] = useState(state.settings.releaseManagerEmail || 'release-managers@careflow.io');
  const [managerEmail, setManagerEmail] = useState(state.settings.managerEmail || 'engineering-managers@careflow.io');
  const [executiveEmail, setExecutiveEmail] = useState(state.settings.executiveEmail || 'executives@careflow.io');
  const [onCallEmail, setOnCallEmail] = useState(state.settings.onCallEmail || 'oncall@careflow.io');
  
  // SMTP Config
  const [smtpHost, setSmtpHost] = useState(state.settings.smtpConfig?.host || 'smtp.sendgrid.net');
  const [smtpPort, setSmtpPort] = useState(state.settings.smtpConfig?.port || 587);
  const [smtpUser, setSmtpUser] = useState(state.settings.smtpConfig?.user || 'apikey');
  const [smtpPassword, setSmtpPassword] = useState(state.settings.smtpConfig?.password || '');
  const [smtpFrom, setSmtpFrom] = useState(state.settings.smtpConfig?.fromAddress || 'notifications@northstar.delivery');
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<string | null>(null);

  const [geminiModel, setGeminiModel] = useState(state.settings.geminiModel || 'gemini-2.5-flash');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(state.settings.theme || 'executive_slate');
  const [selectedDensity, setSelectedDensity] = useState<LayoutDensity>(state.settings.density || 'comfortable');
  
  // Custom presets saved by the user
  const [customPresets, setCustomPresets] = useState<ProjectPreset[]>(state.settings.customPresets || []);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [previewTab, setPreviewTab] = useState<'header' | 'sidebar' | 'email' | 'tab'>('header');

  // Group state
  const [groups, setGroups] = useState<TeamGroup[]>(state.groups || []);
  const [newGroupName, setNewGroupName] = useState('');
  
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');

  const allPresets: ProjectPreset[] = [...DEFAULT_PROJECT_PRESETS, ...customPresets];

  const handleApplyPreset = (preset: ProjectPreset) => {
    setAppName(preset.appName);
    setProjectCode(preset.projectCode);
    setProjectSubtitle(preset.projectSubtitle);
    if (preset.clientName) {
      setClientName(preset.clientName);
    }
  };

  const handleSaveCustomPreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: ProjectPreset = {
      id: generateId('preset'),
      name: newPresetName.trim(),
      appName: appName.trim(),
      projectCode: projectCode.trim().toUpperCase() || 'PROJ',
      projectSubtitle: projectSubtitle.trim(),
      clientName: clientName.trim(),
      description: newPresetDesc.trim() || `Custom project branding for ${newPresetName.trim()}`,
      iconBg: '#0284C7',
      isCustom: true
    };
    const updated = [...customPresets, newPreset];
    setCustomPresets(updated);
    setShowSavePresetModal(false);
    setNewPresetName('');
    setNewPresetDesc('');
    
    // Auto-persist in state
    onUpdateState({
      ...state,
      settings: {
        ...state.settings,
        customPresets: updated
      }
    });
  };

  const handleDeleteCustomPreset = (presetId: string) => {
    const updated = customPresets.filter(p => p.id !== presetId);
    setCustomPresets(updated);
    onUpdateState({
      ...state,
      settings: {
        ...state.settings,
        customPresets: updated
      }
    });
  };

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

  const handleSelectDensity = (density: LayoutDensity) => {
    setSelectedDensity(density);
    document.documentElement.setAttribute('data-density', density);
    onUpdateState({
      ...state,
      settings: {
        ...state.settings,
        density
      }
    });
  };

  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    document.documentElement.setAttribute('data-theme', selectedTheme);
    document.documentElement.setAttribute('data-density', selectedDensity);
    document.title = appName;
    
    onUpdateState({
      ...state,
      groups,
      settings: {
        ...state.settings,
        appName,
        projectCode,
        projectSubtitle,
        clientName,
        customPresets,
        emailRecipient,
        qaTeamEmail,
        devLeadEmail,
        releaseManagerEmail,
        managerEmail,
        executiveEmail,
        onCallEmail,
        smtpConfig: {
          host: smtpHost,
          port: Number(smtpPort) || 587,
          user: smtpUser,
          password: smtpPassword,
          fromAddress: smtpFrom,
          secure: Number(smtpPort) === 465
        },
        geminiModel,
        theme: selectedTheme,
        density: selectedDensity
      }
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleTestSmtp = async () => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/email/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          from: smtpFrom
        })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSmtpTestResult(data.message || 'SMTP Connection Verified!');
      } else {
        setSmtpTestResult(`Failed: ${data.error || 'Connection error'}`);
      }
    } catch (err: any) {
      setSmtpTestResult(`Error: ${err.message}`);
    } finally {
      setSmtpTesting(false);
      setTimeout(() => setSmtpTestResult(null), 5000);
    }
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
        if (imported.settings?.density) {
          document.documentElement.setAttribute('data-density', imported.settings.density);
          setSelectedDensity(imported.settings.density);
        }
        if (imported.settings?.appName) {
          document.title = imported.settings.appName;
          setAppName(imported.settings.appName);
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

  const currentBrandInitial = projectCode ? projectCode[0].toUpperCase() : (appName ? appName[0].toUpperCase() : 'A');

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-16">
      {/* Header Banner */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
            System Settings, Project Branding & Themes
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Configure application title and branding for different client projects, layout density, and system backups
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--low-bg)] text-[var(--low)] text-xs font-bold animate-in fade-in border border-[var(--low-border)] shadow-xs">
            <CheckCircle2 size={14} />
            <span>Settings & branding saved</span>
          </div>
        )}
      </div>

      {/* PROJECT BRANDING & MULTI-PROJECT CONFIGURATION CARD */}
      <form onSubmit={handleSaveSettings} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-6">
        <div>
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <Building2 size={18} className="text-[var(--primary)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Project Identity, Branding & Multi-Project Configuration
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowSavePresetModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] cursor-pointer transition-all shadow-2xs"
            >
              <BookmarkPlus size={13} className="text-[var(--primary)]" />
              <span>Save Current as Preset</span>
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Configure the application title (<strong className="text-[var(--text-primary)]">ACM (AT&T Connection Manager) Delivery</strong>), client organization, project code badge, and subtitle to customize the portal for specific client accounts or engagements.
          </p>
        </div>

        {/* Project Presets Switcher */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-[var(--text-primary)]">
              Client Project Presets & Templates
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">
              Click any preset to load its branding profile
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allPresets.map((preset) => {
              const isCurrent = appName === preset.appName && projectCode === preset.projectCode;
              return (
                <div
                  key={preset.id}
                  onClick={() => handleApplyPreset(preset)}
                  className={`p-3 rounded-xl text-left border-2 transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative group ${
                    isCurrent
                      ? 'border-[var(--primary)] bg-[var(--primary-light)]/40 shadow-xs'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-2xs"
                      style={{ backgroundColor: preset.iconBg }}
                    >
                      {preset.projectCode.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {preset.name}
                        </span>
                      </div>
                      {preset.clientName && (
                        <span className="text-[10px] font-semibold text-[var(--primary)] block">
                          Client: {preset.clientName}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-tight">
                    {preset.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10.5px]">
                    <span className="font-mono text-[var(--text-muted)] font-semibold">
                      Code: {preset.projectCode}
                    </span>
                    {isCurrent ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[var(--primary)] text-white">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[var(--primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                        Apply Preset &rarr;
                      </span>
                    )}
                  </div>

                  {preset.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomPreset(preset.id);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--critical)] hover:bg-[var(--critical-bg)] transition-colors"
                      title="Delete custom preset"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Project Branding Custom Fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[var(--border)]">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              Project / Application Title
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. ACM (AT&T Connection Manager) Delivery"
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] transition-colors"
            />
            <span className="text-[10.5px] text-[var(--text-muted)] mt-1 block">
              Displayed in the top navigation header bar, browser tab title, and generated digest emails.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              Project Code / Prefix
            </label>
            <input
              type="text"
              value={projectCode}
              maxLength={8}
              onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
              placeholder="e.g. ACM"
              className="w-full text-xs font-mono font-bold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] uppercase transition-colors"
            />
            <span className="text-[10.5px] text-[var(--text-muted)] mt-1 block">
              Used for badge tags, ticket references, and the logo emblem.
            </span>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              Project Subtitle / Domain Scope
            </label>
            <input
              type="text"
              value={projectSubtitle}
              onChange={(e) => setProjectSubtitle(e.target.value)}
              placeholder="e.g. AT&T Connection Manager Delivery Hub"
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] transition-colors"
            />
            <span className="text-[10.5px] text-[var(--text-muted)] mt-1 block">
              Contextual subtitle shown below the main application title.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
              Client / Account Organization
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. AT&T, Charter, Verizon"
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] transition-colors"
            />
            <span className="text-[10.5px] text-[var(--text-muted)] mt-1 block">
              The client or stakeholder account organization name.
            </span>
          </div>
        </div>

        {/* Live Multi-Surface Brand Preview */}
        <div className="p-4 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Live Branding Multi-Surface Preview
              </span>
              <span className="text-[10px] font-mono text-[var(--primary)] font-semibold bg-[var(--primary-light)] px-1.5 py-0.5 rounded">
                Dynamic Simulation
              </span>
            </div>
            <div className="inline-flex p-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setPreviewTab('header')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  previewTab === 'header' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Top Header
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('sidebar')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  previewTab === 'sidebar' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Sidebar Emblem
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('email')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  previewTab === 'email' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Email Digest
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('tab')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  previewTab === 'tab' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Browser Tab
              </button>
            </div>
          </div>

          {/* Tab 1: Header Preview */}
          {previewTab === 'header' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white flex items-center justify-center font-extrabold text-sm shadow-xs uppercase">
                {currentBrandInitial}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-[var(--text-primary)] leading-tight">
                    {appName || 'Project Delivery Portal'}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                    {projectCode || 'PROJ'}
                  </span>
                </div>
                <span className="text-[10.5px] text-[var(--text-muted)] font-medium leading-none">
                  {projectSubtitle || 'Enterprise Delivery Hub'}
                </span>
              </div>
            </div>
          )}

          {/* Tab 2: Sidebar Preview */}
          {previewTab === 'sidebar' && (
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs max-w-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] text-white flex items-center justify-center font-extrabold text-base shadow-xs uppercase">
                {currentBrandInitial}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-[var(--text-primary)] truncate">
                    {appName || 'Delivery Portal'}
                  </span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)] font-medium truncate">
                  Client: {clientName || 'Enterprise Account'} &bull; {projectCode || 'PROJ'}
                </span>
              </div>
            </div>
          )}

          {/* Tab 3: Email Digest Preview */}
          {previewTab === 'email' && (
            <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col gap-2 font-sans text-xs">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  Subject: <strong className="text-[var(--text-primary)]">[Standup] {appName || 'Delivery'} Summary &bull; 2026-03-05</strong>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold">
                  Client Ready
                </span>
              </div>
              <div className="text-[11.5px] text-[var(--text-secondary)]">
                <p>Hello {clientName ? `${clientName} Stakeholders` : 'Team'},</p>
                <p className="mt-1">Here is the daily engineering delivery progress report for <strong>{appName}</strong> ({projectCode}). All sprint milestones and quality metrics are tracked below.</p>
              </div>
            </div>
          )}

          {/* Tab 4: Browser Tab Preview */}
          {previewTab === 'tab' && (
            <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex items-center gap-2 max-w-md">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] min-w-0 flex-1">
                <div className="w-3.5 h-3.5 rounded bg-[var(--primary)] text-white text-[8px] flex items-center justify-center font-bold">
                  {currentBrandInitial}
                </div>
                <span className="truncate">{appName || 'Project Delivery Portal'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Email Automation Routing & Notification Matrix */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-[var(--primary)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
              Email Automation & Recipient Routing Matrix
            </h3>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Define default recipient lists mapped to automated delivery triggers (Daily Standup, QA Gate, Capacity, Escalations).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                Engineering Leads & Standup Digest Recipient
              </label>
              <input
                type="text"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="engineering-leads@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                QA Leads & System Testing Daily Recipient
              </label>
              <input
                type="text"
                value={qaTeamEmail}
                onChange={(e) => setQaTeamEmail(e.target.value)}
                placeholder="qa-leads@careflow.io, release-managers@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                Dev Leads & Dev-to-Dev Integration Testing Recipient
              </label>
              <input
                type="text"
                value={devLeadEmail}
                onChange={(e) => setDevLeadEmail(e.target.value)}
                placeholder="dev-leads@careflow.io, component-owners@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                Release Managers & Go/No-Go Sign-Off Recipient
              </label>
              <input
                type="text"
                value={releaseManagerEmail}
                onChange={(e) => setReleaseManagerEmail(e.target.value)}
                placeholder="release-managers@careflow.io, pmo@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                Engineering Managers & Capacity Report Recipient
              </label>
              <input
                type="text"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="engineering-managers@careflow.io, scrum-masters@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                Executive Delivery Pulse & C-Suite Recipient
              </label>
              <input
                type="text"
                value={executiveEmail}
                onChange={(e) => setExecutiveEmail(e.target.value)}
                placeholder="executives@careflow.io, vps@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-[var(--text-primary)] mb-1">
                Critical Defect Escalation & On-Call Recipient (P0/P1)
              </label>
              <input
                type="text"
                value={onCallEmail}
                onChange={(e) => setOnCallEmail(e.target.value)}
                placeholder="oncall@careflow.io, incident-commander@careflow.io"
                className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Enterprise SMTP Dispatch Engine Config */}
        <div className="pt-4 border-t border-[var(--border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MailCheck size={16} className="text-[var(--primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Enterprise SMTP Server & Relay Config
              </h3>
            </div>
            <button
              type="button"
              onClick={handleTestSmtp}
              disabled={smtpTesting}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-xs font-bold rounded-xl text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
            >
              <Mail size={13} className="text-[var(--primary)]" />
              <span>{smtpTesting ? 'Testing...' : 'Test SMTP Connection'}</span>
            </button>
          </div>

          {smtpTestResult && (
            <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
              smtpTestResult.startsWith('Failed') || smtpTestResult.startsWith('Error')
                ? 'bg-rose-500/10 border border-rose-500/20 text-rose-600'
                : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600'
            }`}>
              <CheckCircle2 size={15} />
              <span>{smtpTestResult}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10.5px] font-bold text-[var(--text-primary)] mb-1">SMTP Host</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.sendgrid.net"
                className="w-full text-xs font-mono px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-[var(--text-primary)] mb-1">Port</label>
              <input
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(Number(e.target.value))}
                placeholder="587"
                className="w-full text-xs font-mono px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-bold text-[var(--text-primary)] mb-1">From Sender Address</label>
              <input
                type="text"
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                placeholder="notifications@northstar.delivery"
                className="w-full text-xs font-mono px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Global Preference Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[var(--border)]">
          <div>
            <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Gemini AI Model Engine</label>
            <select
              value={geminiModel}
              onChange={(e) => setGeminiModel(e.target.value)}
              className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] transition-colors"
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
                  className="text-[var(--text-muted)] hover:text-[var(--critical)] cursor-pointer"
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
              className="px-3 py-1.5 bg-[var(--surface-hover)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold rounded-xl cursor-pointer"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              const acmPreset = DEFAULT_PROJECT_PRESETS[0];
              handleApplyPreset(acmPreset);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-subtle)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset to ACM Default</span>
          </button>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Save size={14} />
            <span>Save & Apply Project Preferences</span>
          </button>
        </div>
      </form>

      {/* MODAL: SAVE AS CUSTOM PRESET */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <BookmarkPlus size={16} className="text-[var(--primary)]" />
                <span>Save Current Configuration as Preset</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              Save this project branding configuration into your preset library so team leads can switch client profiles with 1-click.
            </p>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Preset Display Name
                </label>
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="e.g. Spectrum Mobile Enterprise"
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  placeholder="e.g. Multi-region telecom rollout for Spectrum Enterprise."
                  className="w-full text-xs px-3 py-2 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl outline-none focus:border-[var(--primary)] text-[var(--text-primary)] resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomPreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 rounded-xl shadow-xs"
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DENSITY TOGGLE CARD */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal size={18} className="text-[var(--primary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Layout Spacing & Density Engine
            </h2>
          </div>
          
          {/* Quick Segmented Toggle */}
          <div className="inline-flex p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] text-xs font-bold">
            <button
              type="button"
              onClick={() => handleSelectDensity('compact')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedDensity === 'compact'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Minimize2 size={13} />
              <span>Compact</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectDensity('comfortable')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                selectedDensity === 'comfortable'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Maximize2 size={13} />
              <span>Comfortable</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          Toggle spacing scale for task cards on Kanban sprint boards and row padding across all data tables. Changes update instantly across all views.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DENSITY_OPTIONS.map((opt) => {
            const isSelected = selectedDensity === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectDensity(opt.id)}
                className={`p-4 rounded-xl text-left border-2 transition-all flex flex-col justify-between gap-3.5 cursor-pointer ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--primary-light)]/30 shadow-xs'
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/40 hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'}`}>
                      {opt.id === 'compact' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{opt.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                          isSelected 
                            ? 'bg-[var(--primary)] text-white' 
                            : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border)]'
                        }`}>
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                        {opt.description}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[var(--primary)] text-white flex items-center justify-center flex-shrink-0">
                      <Check size={12} />
                    </div>
                  )}
                </div>

                {/* Visual Preview Box */}
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-2.5 flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {opt.id === 'compact' ? 'Compact Preview (8px padding / 28px row)' : 'Comfortable Preview (14px padding / 44px row)'}
                  </div>
                  
                  {/* Mini Card Preview */}
                  <div className={`border border-[var(--border)] rounded-md bg-[var(--surface-hover)] ${
                    opt.id === 'compact' ? 'p-1.5' : 'p-3'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded bg-[var(--primary)]/20 border border-[var(--primary)] flex items-center justify-center text-[8px] text-[var(--primary)] font-bold">✓</div>
                        <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate max-w-[200px]">
                          {appName || 'Deploy Telehealth Ingress Service'}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono-token text-[var(--text-muted)]">#{projectCode || '3910'}</span>
                    </div>
                    <div className={`flex items-center gap-1.5 ${opt.id === 'compact' ? 'mt-1' : 'mt-2'}`}>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--primary-light)] text-[var(--primary)] font-bold">Dev ADO</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--low-bg)] text-[var(--low)] font-bold">Sprint 24.2</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)] text-[10.5px] text-[var(--text-secondary)]">
                  <span><strong>Task Cards:</strong> {opt.cardPadding}</span>
                  <span><strong>Tables:</strong> {opt.rowHeight}</span>
                  <span className="font-mono-token text-[var(--primary)] font-bold">{opt.densityBoost}</span>
                </div>
              </button>
            );
          })}
        </div>
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
                  <span className="text-[10px] text-[var(--text-muted)] font-mono ml-auto">
                    {theme.primary}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* AZURE DEVOPS INTEGRATION & SYNCHRONIZATION HUB */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <FolderGit2 size={18} className="text-[var(--primary)]" />
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Azure DevOps Integration & Synchronization Hub
            </h2>
          </div>
          {onOpenAdoModal && (
            <button
              type="button"
              onClick={onOpenAdoModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <FolderGit2 size={13} />
              <span>Launch ADO Hub</span>
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Manage your personal access tokens (PAT), organizational endpoint mapping, dual ADO synchronization (Internal Dev & External Customer), WIQL query consoles, and bidirectional issue tracking.
        </p>

        {/* Current Configuration Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Primary Internal ADO
              </span>
              <span className="text-[10px] uppercase font-bold text-[var(--primary)] bg-[var(--primary-light)] px-1.5 py-0.2 rounded border border-[var(--primary)]/20">
                Active
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-[var(--text-primary)] mt-1">
              {state.dualAdoConfig?.internal?.organization || 'simetricwdh'} / {state.dualAdoConfig?.internal?.project || 'ACM'}
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] font-medium">
              Area: {state.dualAdoConfig?.internal?.areaPath || 'ACM\\Delivery'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${state.dualAdoConfig?.external?.organization ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                External Customer ADO
              </span>
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] bg-[var(--surface)] px-1.5 py-0.2 rounded border border-[var(--border)]">
                {state.dualAdoConfig?.external?.organization ? 'Configured' : 'Optional'}
              </span>
            </div>
            <div className="text-xs font-mono font-bold text-[var(--text-primary)] mt-1">
              {state.dualAdoConfig?.external?.organization ? `${state.dualAdoConfig.external.organization} / ${state.dualAdoConfig.external.project}` : 'No external customer instance mapped'}
            </div>
            <div className="text-[10.5px] text-[var(--text-muted)] font-medium">
              Area: {state.dualAdoConfig?.external?.areaPath || 'Optional Client Mirror'}
            </div>
          </div>
        </div>

        {onOpenAdoModal && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-[var(--text-muted)]">
              Click to open the full modal for schema diagnostics, work item mapping, and live token verification.
            </span>
            <button
              type="button"
              onClick={onOpenAdoModal}
              className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Open ADO Sync Engine & Diagnostics</span>
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Backup & Persistence Operations */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
        <h2 className="text-sm font-bold text-[var(--text-primary)] pb-2 border-b border-[var(--border)]">
          Data Backup & Disaster Recovery
        </h2>

        <p className="text-xs text-[var(--text-secondary)]">
          Export a complete, self-contained JSON snapshot containing all tasks, user stories, dual ADO configs, defect records, client presets, and sprint history.
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
              if (window.confirm('Clear all tasks, user stories, defects, and sprint records to start with a clean workspace?')) {
                onResetData();
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[var(--critical)] bg-[var(--critical-bg)] hover:bg-[var(--critical-bg)] border border-[var(--critical-border)] rounded-xl shadow-xs transition-all ml-auto cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Clear Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
};
