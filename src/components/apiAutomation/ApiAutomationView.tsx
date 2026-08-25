import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Plus, 
  Sparkles, 
  Upload, 
  Cpu, 
  Globe, 
  Link2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Layers, 
  Trash2, 
  Edit3, 
  Search, 
  RotateCw, 
  Filter,
  Check,
  ChevronRight,
  Zap,
  Activity,
  ShieldCheck,
  FileCode,
  Download,
  BookOpen,
  GitBranch,
  Terminal
} from 'lucide-react';
import { 
  ApiAutomationCollection, 
  ApiEnvironment, 
  ApiRequestItem, 
  ApiTestExecutionRun,
  ApiTestFlow
} from '../../types/apiAutomation';
import { generateId } from '../../utils/date';
import { getSampleBrunoFlows } from '../../utils/brunoEngine';
import { TechStackGuideModal } from './TechStackGuideModal';
import { CollectionRunnerModal } from './CollectionRunnerModal';
import { EndpointEditorModal } from './EndpointEditorModal';
import { AiSuiteGeneratorModal } from './AiSuiteGeneratorModal';
import { PostmanImportExportModal } from './PostmanImportExportModal';
import { EnvironmentManagerModal } from './EnvironmentManagerModal';
import { WebhookIntegrationModal } from './WebhookIntegrationModal';
import { BrunoStudioModal } from './BrunoStudioModal';
import { ApiFlowsStudio } from './ApiFlowsStudio';

interface ApiAutomationViewProps {
  collections: ApiAutomationCollection[];
  environments: ApiEnvironment[];
  executionRuns: ApiTestExecutionRun[];
  activeEnvironmentId?: string;
  onUpdateCollections: (collections: ApiAutomationCollection[]) => void;
  onUpdateEnvironments: (environments: ApiEnvironment[]) => void;
  onSaveExecutionRun: (run: ApiTestExecutionRun) => void;
  onSelectEnvironment: (envId: string) => void;
}

export const ApiAutomationView: React.FC<ApiAutomationViewProps> = ({
  collections,
  environments,
  executionRuns,
  activeEnvironmentId = 'env-local',
  onUpdateCollections,
  onUpdateEnvironments,
  onSaveExecutionRun,
  onSelectEnvironment
}) => {
  // Main Studio View Mode
  const [viewMode, setViewMode] = useState<'collections' | 'flows'>('collections');

  // Flows State
  const [flows, setFlows] = useState<ApiTestFlow[]>(() => {
    try {
      const saved = localStorage.getItem('northstar_api_flows');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return getSampleBrunoFlows();
  });

  const handleUpdateFlows = (newFlows: ApiTestFlow[]) => {
    setFlows(newFlows);
    try {
      localStorage.setItem('northstar_api_flows', JSON.stringify(newFlows));
    } catch {}
  };

  // Active Selected Collection
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(
    collections[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'smoke' | 'regression' | 'integration' | 'security'>('all');

  // Modal States
  const [isTechStackModalOpen, setIsTechStackModalOpen] = useState<boolean>(false);
  const [isBrunoModalOpen, setIsBrunoModalOpen] = useState<boolean>(false);
  const [isRunnerModalOpen, setIsRunnerModalOpen] = useState<boolean>(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isEnvModalOpen, setIsEnvModalOpen] = useState<boolean>(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState<boolean>(false);
  const [editingRequestItem, setEditingRequestItem] = useState<ApiRequestItem | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // Active collection object
  const activeCollection = collections.find(c => c.id === selectedCollectionId) || collections[0];
  const activeEnvironment = environments.find(e => e.id === activeEnvironmentId) || environments[0] || {
    id: 'env-default',
    name: 'Local Server',
    baseUrl: 'http://localhost:3000',
    variables: { baseUrl: 'http://localhost:3000' }
  };

  // Filtered collections list
  const filteredCollections = collections.filter(col => {
    const matchesSearch = col.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (col.description && col.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || col.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Recent execution runs for this collection
  const collectionRuns = executionRuns.filter(r => r.collectionId === activeCollection?.id);
  const latestRun = collectionRuns[0];

  // Collection CRUD
  const handleCreateNewCollection = () => {
    const newCol: ApiAutomationCollection = {
      id: generateId('col'),
      name: 'New API Automation Suite',
      description: 'Automated test suite created via Northstar Portal',
      category: 'smoke',
      baseUrl: '{{baseUrl}}',
      variables: { baseUrl: 'http://localhost:3000' },
      webhookToken: `whk_${generateId('')}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requests: [
        {
          id: generateId('req'),
          name: '1. Health Check Endpoint',
          method: 'GET',
          url: '{{baseUrl}}/api/health',
          headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
          params: [],
          bodyType: 'none',
          bodyContent: '',
          assertions: [
            {
              id: generateId('as'),
              type: 'status_code',
              operator: 'equals',
              expectedValue: '200',
              description: 'Service is healthy (200 OK)',
              enabled: true
            }
          ],
          extractVariables: [],
          enabled: true,
          timeoutMs: 3000
        }
      ]
    };

    const updated = [newCol, ...collections];
    onUpdateCollections(updated);
    setSelectedCollectionId(newCol.id);
  };

  const handleDeleteCollection = (colId: string) => {
    if (collections.length <= 1) return;
    const updated = collections.filter(c => c.id !== colId);
    onUpdateCollections(updated);
    if (selectedCollectionId === colId) {
      setSelectedCollectionId(updated[0].id);
    }
  };

  const handleUpdateActiveCollection = (updates: Partial<ApiAutomationCollection>) => {
    if (!activeCollection) return;
    const updatedCol = { ...activeCollection, ...updates, updatedAt: new Date().toISOString() };
    const updatedList = collections.map(c => c.id === activeCollection.id ? updatedCol : c);
    onUpdateCollections(updatedList);
  };

  // Request item CRUD
  const handleSaveRequestItem = (item: ApiRequestItem) => {
    if (!activeCollection) return;
    const exists = activeCollection.requests.some(r => r.id === item.id);
    let updatedRequests: ApiRequestItem[];
    if (exists) {
      updatedRequests = activeCollection.requests.map(r => r.id === item.id ? item : r);
    } else {
      updatedRequests = [...activeCollection.requests, item];
    }
    handleUpdateActiveCollection({ requests: updatedRequests });
  };

  const handleDeleteRequestItem = (reqId: string) => {
    if (!activeCollection) return;
    const updatedRequests = activeCollection.requests.filter(r => r.id !== reqId);
    handleUpdateActiveCollection({ requests: updatedRequests });
  };

  const handleToggleRequestItem = (reqId: string) => {
    if (!activeCollection) return;
    const updatedRequests = activeCollection.requests.map(r => 
      r.id === reqId ? { ...r, enabled: !r.enabled } : r
    );
    handleUpdateActiveCollection({ requests: updatedRequests });
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      case 'POST': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
      case 'PUT': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'PATCH': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
      case 'DELETE': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      default: return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Top Banner Bar */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)] shrink-0 flex items-center justify-between gap-4 flex-wrap shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
            <Zap size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-[var(--text-primary)]">
                API Automation & Collection Runner
              </h1>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Live Proxy Engine Active
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-medium">
              Trigger automated test suites, evaluate assertions, chain session variables, and integrate CI/CD quality gates
            </p>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Environment Selector Button */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/60 text-xs font-bold">
            <Globe size={14} className="text-[var(--primary)]" />
            <select
              value={activeEnvironmentId}
              onChange={(e) => onSelectEnvironment(e.target.value)}
              className="bg-transparent border-0 text-xs font-bold text-[var(--text-primary)] focus:outline-hidden cursor-pointer"
            >
              {environments.map(env => (
                <option key={env.id} value={env.id}>
                  {env.name} ({env.baseUrl})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsBrunoModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Bruno (.bru) Studio & CLI"
          >
            <Zap size={13} />
            <span>Bruno (.bru) Hub</span>
          </button>

          <button
            onClick={() => setIsEnvModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Manage Environments"
          >
            <Globe size={13} />
            <span>Environments</span>
          </button>

          <button
            onClick={() => setIsTechStackModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <BookOpen size={13} />
            <span>Tech Stack Guide</span>
          </button>

          <button
            onClick={() => setIsAiModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Sparkles size={13} />
            <span>AI Suite Generator</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Upload size={13} />
            <span>Import / Export</span>
          </button>

          <button
            onClick={() => setIsWebhookModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="CI/CD Webhook Trigger"
          >
            <Link2 size={13} />
            <span>CI/CD Webhook</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Navigation Bar (Collections vs Flows) */}
      <div className="px-6 py-2.5 bg-[var(--bg-subtle)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('collections')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'collections'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Layers size={14} />
            <span>API Collections & Endpoints</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              viewMode === 'collections' ? 'bg-white/20 text-white' : 'bg-[var(--surface)] text-[var(--text-muted)]'
            }`}>
              {collections.length}
            </span>
          </button>

          <button
            onClick={() => setViewMode('flows')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'flows'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Zap size={14} />
            <span>API Test Flows (Bruno Engine)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              viewMode === 'flows' ? 'bg-white/20 text-white' : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
            }`}>
              {flows.length}
            </span>
          </button>
        </div>

        {viewMode === 'flows' && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            <span className="font-semibold text-purple-600 dark:text-purple-400">Bruno DSL & Sandbox Ready</span>
          </div>
        )}
      </div>

      {/* Main Studio View Rendering */}
      {viewMode === 'flows' ? (
        <div className="flex-1 overflow-y-auto p-6 bg-[var(--bg-main)]">
          <ApiFlowsStudio
            flows={flows}
            activeEnvironment={activeEnvironment}
            onUpdateFlows={handleUpdateFlows}
            onOpenBrunoModal={() => setIsBrunoModalOpen(true)}
          />
        </div>
      ) : (
      /* Main 2-Column Studio Layout */
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Sidebar: Collection Explorer (4 cols) */}
        <div className="lg:col-span-4 border-r border-[var(--border)] flex flex-col bg-[var(--surface)] overflow-hidden">
          {/* Collection Search & New CTA */}
          <div className="p-4 border-b border-[var(--border)] space-y-3 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                API Collections ({filteredCollections.length})
              </span>
              <button
                onClick={handleCreateNewCollection}
                className="px-2.5 py-1 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
              >
                <Plus size={13} />
                <span>New Suite</span>
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-hidden"
              />
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {(['all', 'smoke', 'regression', 'integration', 'security'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Collection Cards List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredCollections.map(col => {
              const isSelected = activeCollection?.id === col.id;
              const recentRun = executionRuns.find(r => r.collectionId === col.id);
              const totalSteps = col.requests.length;

              return (
                <div
                  key={col.id}
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                    isSelected
                      ? 'bg-[var(--primary-light)]/20 border-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]/30'
                      : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-black text-[var(--text-primary)] truncate">
                          {col.name}
                        </h3>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                        {col.description || 'No description provided'}
                      </p>
                    </div>

                    <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 border ${
                      col.category === 'smoke' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      col.category === 'regression' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                      col.category === 'security' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                      'bg-purple-500/10 text-purple-600 border-purple-500/20'
                    }`}>
                      {col.category || 'smoke'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[var(--border)]/60 text-[var(--text-muted)]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{totalSteps} Steps</span>
                      <span>•</span>
                      {recentRun ? (
                        <span className={`font-bold flex items-center gap-1 ${
                          recentRun.status === 'passed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {recentRun.status === 'passed' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          <span>{recentRun.passedRequests}/{recentRun.totalRequests} Passed</span>
                        </span>
                      ) : (
                        <span>Not run yet</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {collections.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCollection(col.id);
                          }}
                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                          title="Delete Collection"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Content Area: Active Suite Details & Request List (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-[var(--bg-subtle)]/40 overflow-hidden">
          {activeCollection ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Collection Header & Primary CTA Trigger */}
              <div className="p-6 bg-[var(--surface)] border-b border-[var(--border)] shrink-0 space-y-4 shadow-2xs">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-[var(--text-primary)]">
                        {activeCollection.name}
                      </h2>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        activeCollection.category === 'smoke' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                        activeCollection.category === 'regression' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                        activeCollection.category === 'security' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                        'bg-purple-500/10 text-purple-600 border-purple-500/20'
                      }`}>
                        {activeCollection.category || 'smoke'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      {activeCollection.description || 'Collection of automated HTTP tests with assertion gating and response chaining.'}
                    </p>
                  </div>

                  {/* Primary Trigger Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRequestItem(null);
                        setIsEditorOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Step</span>
                    </button>

                    <button
                      onClick={() => setIsRunnerModalOpen(true)}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <Play size={14} fill="currentColor" />
                      <span>Trigger Collection Run</span>
                    </button>
                  </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-muted)]">Total Endpoints</div>
                    <div className="text-lg font-black text-[var(--text-primary)] mt-0.5">
                      {activeCollection.requests.length}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-muted)]">Active Assertions</div>
                    <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {activeCollection.requests.reduce((sum, r) => sum + r.assertions.length, 0)}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-muted)]">Last Run Result</div>
                    <div className={`text-lg font-black mt-0.5 flex items-center gap-1.5 ${
                      !latestRun ? 'text-[var(--text-muted)]' :
                      latestRun.status === 'passed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {latestRun ? (
                        <>
                          {latestRun.status === 'passed' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <span>{latestRun.status.toUpperCase()}</span>
                        </>
                      ) : 'READY'}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface-hover)]/50 border border-[var(--border)]">
                    <div className="text-[11px] font-bold text-[var(--text-muted)]">Target Gateway</div>
                    <div className="text-xs font-mono font-bold text-[var(--text-primary)] truncate mt-1.5" title={activeEnvironment.baseUrl}>
                      {activeEnvironment.name}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sequential Request Steps List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">
                    Sequential Test Execution Pipeline ({activeCollection.requests.length} Steps)
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Steps execute in order, passing extracted variables forward
                  </span>
                </div>

                {activeCollection.requests.length === 0 ? (
                  <div className="p-12 text-center border border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)] space-y-3">
                    <Layers size={32} className="mx-auto text-[var(--text-muted)] opacity-40" />
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">No Request Steps in this Suite</h4>
                    <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                      Click "Add Step" or use the AI Generator to automatically scaffold your API endpoints and assertion rules.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activeCollection.requests.map((req, idx) => (
                      <div
                        key={req.id}
                        className={`p-4 rounded-2xl border bg-[var(--surface)] shadow-2xs hover:shadow-xs transition-all space-y-3 ${
                          !req.enabled ? 'opacity-50' : 'border-[var(--border)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-[var(--surface-hover)] text-[var(--text-muted)] text-xs font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border shrink-0 ${getMethodBadgeClass(req.method)}`}>
                              {req.method}
                            </span>
                            <div className="min-w-0">
                              <h4 className="text-xs font-extrabold text-[var(--text-primary)] truncate">
                                {req.name}
                              </h4>
                              <div className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-md">
                                {req.url}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Badges */}
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--surface-hover)] text-[var(--text-muted)]">
                              {req.assertions.length} Assertions
                            </span>
                            {req.extractVariables.length > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                {req.extractVariables.length} Chained
                              </span>
                            )}

                            {/* Actions */}
                            <button
                              onClick={() => handleToggleRequestItem(req.id)}
                              className="px-2 py-1 rounded-lg text-[10.5px] font-bold text-[var(--text-muted)] hover:bg-[var(--surface-hover)] cursor-pointer"
                              title={req.enabled ? 'Disable Step' : 'Enable Step'}
                            >
                              {req.enabled ? 'Active' : 'Disabled'}
                            </button>

                            <button
                              onClick={() => {
                                setEditingRequestItem(req);
                                setIsEditorOpen(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-primary)] cursor-pointer"
                              title="Edit Step Configuration"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              onClick={() => handleDeleteRequestItem(req.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 cursor-pointer"
                              title="Delete Step"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Assertion summary pills */}
                        {req.assertions.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[var(--border)]/50">
                            {req.assertions.map((as, aIdx) => (
                              <span
                                key={aIdx}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border)]"
                              >
                                ✓ {as.description || `${as.type} ${as.operator} ${as.expectedValue}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      )}

      {/* Modals */}
      {isBrunoModalOpen && (
        <BrunoStudioModal
          isOpen={isBrunoModalOpen}
          onClose={() => setIsBrunoModalOpen(false)}
          activeCollection={activeCollection}
          activeFlow={flows[0]}
          activeEnvironment={activeEnvironment}
          onImportCollection={(imported) => {
            const updated = [imported, ...collections];
            onUpdateCollections(updated);
            setSelectedCollectionId(imported.id);
          }}
          onImportFlow={(importedFlow) => {
            const updated = [importedFlow, ...flows];
            handleUpdateFlows(updated);
            setViewMode('flows');
          }}
        />
      )}
      {isTechStackModalOpen && (
        <TechStackGuideModal
          isOpen={isTechStackModalOpen}
          onClose={() => setIsTechStackModalOpen(false)}
          sampleCollection={activeCollection}
        />
      )}

      {isRunnerModalOpen && activeCollection && (
        <CollectionRunnerModal
          isOpen={isRunnerModalOpen}
          onClose={() => setIsRunnerModalOpen(false)}
          collection={activeCollection}
          environment={activeEnvironment}
          onSaveExecutionRun={onSaveExecutionRun}
        />
      )}

      {isEditorOpen && (
        <EndpointEditorModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingRequestItem(null);
          }}
          requestItem={editingRequestItem}
          onSave={handleSaveRequestItem}
          environment={activeEnvironment}
          collectionVariables={activeCollection?.variables}
        />
      )}

      {isAiModalOpen && (
        <AiSuiteGeneratorModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          onSuiteGenerated={(newSuite) => {
            const updated = [newSuite, ...collections];
            onUpdateCollections(updated);
            setSelectedCollectionId(newSuite.id);
          }}
        />
      )}

      {isImportModalOpen && (
        <PostmanImportExportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportCollection={(imported) => {
            const updated = [imported, ...collections];
            onUpdateCollections(updated);
            setSelectedCollectionId(imported.id);
          }}
          activeCollection={activeCollection}
        />
      )}

      {isEnvModalOpen && (
        <EnvironmentManagerModal
          isOpen={isEnvModalOpen}
          onClose={() => setIsEnvModalOpen(false)}
          environments={environments}
          activeEnvironmentId={activeEnvironmentId}
          onSelectEnvironment={onSelectEnvironment}
          onUpdateEnvironments={onUpdateEnvironments}
        />
      )}

      {isWebhookModalOpen && activeCollection && (
        <WebhookIntegrationModal
          isOpen={isWebhookModalOpen}
          onClose={() => setIsWebhookModalOpen(false)}
          collection={activeCollection}
        />
      )}
    </div>
  );
};
