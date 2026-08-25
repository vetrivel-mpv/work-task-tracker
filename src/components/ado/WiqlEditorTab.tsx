import React, { useState } from 'react';
import { 
  Play, 
  Download, 
  Terminal, 
  Code2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  Layers, 
  FolderGit2,
  Filter, 
  Copy, 
  Check, 
  Bug, 
  BookOpen, 
  FileCheck2, 
  Search,
  Zap
} from 'lucide-react';
import { adoService, AdoSyncResponse } from '../../services/adoService';
import { parseAdoTarget } from '../../utils/adoPaths';

interface WiqlEditorTabProps {
  org: string;
  project: string;
  pat: string;
  areaPath: string;
  iterationPath: string;
  onExecuteAndSync: (customWiql: string) => Promise<void>;
  isSyncing: boolean;
}

interface WiqlTemplate {
  id: string;
  name: string;
  description: string;
  category: 'All' | 'Stories' | 'Defects' | 'Test Cases' | 'Sprint' | 'Tasks';
  icon: any;
  buildQuery: (project: string, area?: string, iter?: string) => string;
}

export const WiqlEditorTab: React.FC<WiqlEditorTabProps> = ({
  org,
  project,
  pat,
  areaPath,
  iterationPath,
  onExecuteAndSync,
  isSyncing
}) => {
  const parsed = parseAdoTarget(org, project);
  const currentOrg = parsed.cleanOrg;
  const currentProject = parsed.cleanProject;
  const currentPat = pat;
  const currentArea = areaPath;
  const currentIteration = iterationPath;


  const defaultQuery = `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [System.AssignedTo], 
    [System.WorkItemType], 
    [System.AreaPath], 
    [System.IterationPath] 
FROM WorkItems 
WHERE [System.TeamProject] = @project
ORDER BY [System.Id] DESC`;

  const [query, setQuery] = useState<string>(defaultQuery);
  const [isExecutingPreview, setIsExecutingPreview] = useState(false);
  const [previewResponse, setPreviewResponse] = useState<AdoSyncResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [filterView, setFilterView] = useState<'all' | 'stories' | 'defects' | 'testCases' | 'tasks'>('all');
  const [copiedQuery, setCopiedQuery] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const templates: WiqlTemplate[] = [
    {
      id: 'all_items',
      name: 'All Work Items',
      description: 'Fetch all stories, defects, test cases, and tasks in project',
      category: 'All',
      icon: Database,
      buildQuery: (proj) => `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [System.AssignedTo], 
    [System.WorkItemType], 
    [System.AreaPath], 
    [System.IterationPath] 
FROM WorkItems 
WHERE [System.TeamProject] = @project 
ORDER BY [System.Id] DESC`
    },
    {
      id: 'stories_only',
      name: 'User Stories & Backlog',
      description: 'Fetch backlog items, user stories, requirements & epics',
      category: 'Stories',
      icon: BookOpen,
      buildQuery: (proj) => `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [System.AssignedTo], 
    [System.WorkItemType], 
    [System.AreaPath], 
    [System.IterationPath] 
FROM WorkItems 
WHERE [System.TeamProject] = @project 
  AND [System.WorkItemType] IN ('User Story', 'Product Backlog Item', 'Requirement', 'Feature', 'Epic') 
ORDER BY [System.Id] DESC`
    },
    {
      id: 'bugs_defects',
      name: 'Bugs & Defects Only',
      description: 'Fetch active/retest bugs and quality defects with severity',
      category: 'Defects',
      icon: Bug,
      buildQuery: (proj) => `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [Microsoft.VSTS.Common.Severity], 
    [System.AssignedTo], 
    [System.WorkItemType], 
    [System.AreaPath], 
    [System.IterationPath] 
FROM WorkItems 
WHERE [System.TeamProject] = @project 
  AND [System.WorkItemType] IN ('Bug', 'Defect', 'Issue', 'Incident', 'Impediment') 
ORDER BY [System.Id] DESC`
    },
    {
      id: 'test_cases',
      name: 'Test Cases & Suites',
      description: 'Fetch QA test cases, test suites, and automation assets',
      category: 'Test Cases',
      icon: FileCheck2,
      buildQuery: (proj) => `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [System.AssignedTo], 
    [System.WorkItemType], 
    [System.AreaPath], 
    [System.IterationPath] 
FROM WorkItems 
WHERE [System.TeamProject] = @project 
  AND [System.WorkItemType] IN ('Test Case', 'Test Suite', 'Test Plan', 'Shared Steps') 
ORDER BY [System.Id] DESC`
    },
    {
      id: 'sprint_iteration',
      name: 'Current Iteration / Sprint',
      description: 'Query work items specifically under configured sprint iteration',
      category: 'Sprint',
      icon: Layers,
      buildQuery: (proj, _, iter) => `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [System.AssignedTo], 
    [System.WorkItemType], 
    [System.IterationPath] 
FROM WorkItems 
WHERE [System.TeamProject] = @project 
  AND ([System.IterationPath] UNDER '${iter || proj}' OR [System.IterationPath] = '${iter || proj}') 
ORDER BY [System.Id] DESC`
    },
    {
      id: 'active_in_progress',
      name: 'Active / Open Tickets',
      description: 'Filter out closed and completed items to focus on open workload',
      category: 'All',
      icon: Zap,
      buildQuery: (proj) => `SELECT 
    [System.Id], 
    [System.Title], 
    [System.State], 
    [System.AssignedTo], 
    [System.WorkItemType] 
FROM WorkItems 
WHERE [System.TeamProject] = @project 
  AND [System.State] NOT IN ('Closed', 'Done', 'Resolved', 'Removed', 'Completed') 
ORDER BY [System.ChangedDate] DESC`
    }
  ];

  const quickSnippets = [
    { label: "+ [System.WorkItemType] IN ('User Story', 'Bug')", insert: " AND [System.WorkItemType] IN ('User Story', 'Bug')" },
    { label: "+ [System.State] = 'Active'", insert: " AND [System.State] = 'Active'" },
    { label: "+ [System.State] NOT IN ('Closed', 'Done')", insert: " AND [System.State] NOT IN ('Closed', 'Done')" },
    { label: "+ [System.AssignedTo] = @me", insert: " AND [System.AssignedTo] = @me" },
    { label: "+ [System.ChangedDate] >= @today - 7", insert: " AND [System.ChangedDate] >= @today - 7" },
    { label: "+ ORDER BY [System.ChangedDate] DESC", insert: " ORDER BY [System.ChangedDate] DESC" }
  ];

  const handleApplyTemplate = (tmpl: WiqlTemplate) => {
    const generated = tmpl.buildQuery(currentProject || 'MyProject', currentArea, currentIteration);
    setQuery(generated);
  };

  const handleInsertSnippet = (snippet: string) => {
    setQuery(prev => prev + snippet);
  };

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(query);
    setCopiedQuery(true);
    setTimeout(() => setCopiedQuery(false), 2000);
  };

  // Test / Hit WIQL query to get live preview
  const handleHitWiql = async () => {
    if (!currentOrg || !currentProject) {
      setPreviewError('Please specify Azure DevOps Organization and Project under Connection settings.');
      return;
    }

    setIsExecutingPreview(true);
    setPreviewError(null);
    try {
      const response = await adoService.syncWorkItems({
        org: currentOrg,
        project: currentProject,
        pat: currentPat,
        customWiql: query
      });

      setPreviewResponse(response);
      if (!response.ok) {
        setPreviewError(response.error || 'WIQL query failed.');
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to execute WIQL query.');
    } finally {
      setIsExecutingPreview(false);
    }
  };

  // Execute and sync directly into app
  const handleSyncIntoApp = async () => {
    if (!currentOrg || !currentProject) {
      setPreviewError('Please specify Azure DevOps Organization and Project under Connection settings.');
      return;
    }
    await onExecuteAndSync(query);
  };

  const allItems = [
    ...(previewResponse?.stories || []).map(s => ({ ...s, category: 'Story' as const })),
    ...(previewResponse?.defects || []).map(d => ({ ...d, category: 'Defect' as const })),
    ...(previewResponse?.testCases || []).map(tc => ({ ...tc, category: 'TestCase' as const })),
    ...(previewResponse?.tasks || []).map(t => ({ ...t, category: 'Task' as const }))
  ];

  const filteredItems = allItems.filter(item => {
    if (filterView === 'stories' && item.category !== 'Story') return false;
    if (filterView === 'defects' && item.category !== 'Defect') return false;
    if (filterView === 'testCases' && item.category !== 'TestCase') return false;
    if (filterView === 'tasks' && item.category !== 'Task') return false;
    
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      const matchTitle = (item.title || '').toLowerCase().includes(q);
      const matchId = String(item.adoId || '').includes(q);
      const matchAssignee = (item.assigneeName || '').toLowerCase().includes(q);
      const matchState = (item.status || '').toLowerCase().includes(q);
      return matchTitle || matchId || matchAssignee || matchState;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-bold shadow-xs">
            <Code2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--text-primary)]">
                Azure DevOps WIQL Interactive Query Console
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-mono">
                WIQL 7.0
              </span>
            </div>
            <p className="text-[11.5px] text-[var(--text-secondary)]">
              Write, edit, and hit custom Work Item Query Language (WIQL) queries directly against your Azure DevOps project.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)]">
          <FolderGit2 size={14} className="text-[var(--primary)]" />
          <span>{currentOrg || 'Organization'}/{currentProject || 'Project'}</span>
        </div>
      </div>

      {/* Preset Query Templates */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            <span>Quick Query Presets & Templates</span>
          </label>
          <span className="text-[11px] text-[var(--text-secondary)]">
            Click any template to load it into the editor
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {templates.map(tmpl => {
            const Icon = tmpl.icon;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="p-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]/20 transition-all text-left flex flex-col gap-1 cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 text-[var(--primary)] group-hover:scale-105 transition-transform">
                  <Icon size={14} />
                  <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">{tmpl.name}</span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)] line-clamp-2 leading-tight">
                  {tmpl.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Code Editor Area */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-[var(--text-secondary)]" />
            <span className="text-xs font-bold text-[var(--text-primary)]">Editable WIQL Query</span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              (Use <code className="bg-[var(--bg-subtle)] px-1 rounded text-[var(--primary)]">@project</code> or your project name)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyQuery}
              className="text-[11px] font-medium px-2 py-1 rounded-md bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copiedQuery ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              <span>{copiedQuery ? 'Copied!' : 'Copy WIQL'}</span>
            </button>
            <button
              type="button"
              onClick={() => setQuery(defaultQuery)}
              className="text-[11px] font-medium px-2 py-1 rounded-md bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Reset Default
            </button>
          </div>
        </div>

        {/* Syntax-styled Textarea */}
        <div className="relative rounded-xl border border-[#1E293B] bg-[#0B0F17] overflow-hidden shadow-inner font-mono text-xs">
          <div className="bg-[#1E293B]/80 px-3 py-1.5 flex items-center justify-between border-b border-[#334155] text-[11px] text-[#94A3B8]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block"></span>
              <span className="font-semibold ml-1 text-slate-300">wiql-query.sql</span>
            </div>
            <span className="text-[10px] text-[#64748B]">Target: {currentOrg || 'Org'}/{currentProject || 'Project'}</span>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={7}
            spellCheck={false}
            className="w-full p-3 bg-transparent text-[#38BDF8] font-mono text-xs outline-none resize-y leading-relaxed selection:bg-blue-600/40"
            placeholder="SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = @project..."
          />
        </div>

        {/* Quick Clause Snippets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-bold text-[var(--text-secondary)] flex items-center gap-1">
            <Filter size={11} /> Quick Clauses:
          </span>
          {quickSnippets.map((snip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleInsertSnippet(snip.insert)}
              className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]/30 transition-all cursor-pointer"
            >
              {snip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Execute Actions Bar */}
      <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="text-xs">
            <span className="font-bold text-[var(--text-primary)] block">Execute Query Against Azure DevOps</span>
            <span className="text-[11px] text-[var(--text-secondary)]">
              Hit "Test / Preview Query" to inspect results without modifying local state, or "Run & Ingest" to sync immediately.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Button 1: Hit & Preview */}
          <button
            type="button"
            disabled={isExecutingPreview || isSyncing}
            onClick={handleHitWiql}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary-light)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Play size={14} className={isExecutingPreview ? 'animate-spin' : 'fill-current'} />
            <span>{isExecutingPreview ? 'Hitting ADO API...' : '⚡ Hit / Test WIQL & Preview'}</span>
          </button>

          {/* Button 2: Execute & Sync into App */}
          <button
            type="button"
            disabled={isExecutingPreview || isSyncing}
            onClick={handleSyncIntoApp}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Download size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Ingesting Data...' : '📥 Run WIQL & Ingest into App'}</span>
          </button>
        </div>
      </div>

      {/* Error Message if query failed */}
      {previewError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200 flex items-start gap-2 animate-in fade-in">
          <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-bold block">Azure DevOps WIQL Error</span>
            <p className="font-mono text-[11px] mt-0.5 break-words">{previewError}</p>
          </div>
        </div>
      )}

      {/* Live Results Preview Box */}
      {previewResponse && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col gap-3 animate-in fade-in">
          {/* Summary Metrics Header */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Query Execution Results</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold">
                {allItems.length} Total Work Items
              </span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                ({previewResponse.durationMs || 0}ms)
              </span>
            </div>

            {/* Sub-tabs for filtering preview */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterView('all')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  filterView === 'all'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All ({allItems.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('stories')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  filterView === 'stories'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Stories ({previewResponse.stories?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('defects')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  filterView === 'defects'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Defects ({previewResponse.defects?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('testCases')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  filterView === 'testCases'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Test Cases ({previewResponse.testCases?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFilterView('tasks')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  filterView === 'tasks'
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Tasks ({previewResponse.tasks?.length || 0})
              </button>

              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="ml-2 px-2 py-1 text-[10.5px] font-bold rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] flex items-center gap-1 cursor-pointer"
              >
                <Code2 size={12} />
                <span>{showRawJson ? 'Hide JSON' : 'Raw JSON'}</span>
              </button>
            </div>
          </div>

          {/* Quick Filter Search inside results */}
          {allItems.length > 0 && !showRawJson && (
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Filter returned preview items by title, ID, state, or assignee..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg outline-none text-[var(--text-primary)]"
              />
            </div>
          )}

          {/* Raw JSON View */}
          {showRawJson ? (
            <div className="rounded-xl bg-[#0B0F17] text-[#94A3B8] p-3 font-mono text-[11px] max-h-60 overflow-y-auto border border-[#1E293B]">
              <pre>{JSON.stringify(previewResponse.rawPayload || previewResponse, null, 2)}</pre>
            </div>
          ) : (
            /* Tabular Results */
            <div className="max-h-64 overflow-y-auto border border-[var(--border)] rounded-xl overflow-hidden">
              {filteredItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  {allItems.length === 0 
                    ? 'No work items returned by this WIQL query in Azure DevOps.' 
                    : 'No items match current filter view or search keyword.'}
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-bold text-[11px] border-b border-[var(--border)]">
                      <th className="py-2 px-3">ID</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Title</th>
                      <th className="py-2 px-3">State</th>
                      <th className="py-2 px-3">Assignee</th>
                      <th className="py-2 px-3">Iteration Path</th>
                      <th className="py-2 px-3">Area Path</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredItems.map(item => {
                      const badgeColor = 
                        item.category === 'Story' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' :
                        item.category === 'Defect' ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300' :
                        item.category === 'TestCase' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';

                      return (
                        <tr key={item.id || item.adoId} className="hover:bg-[var(--surface-hover)] transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-[var(--primary)]">
                            #{item.adoId}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeColor}`}>
                              {item.category}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-[var(--text-primary)] max-w-xs truncate" title={item.title}>
                            {item.title}
                          </td>
                          <td className="py-2 px-3 font-medium text-[11px] text-[var(--text-secondary)]">
                            {item.status}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-[var(--text-secondary)]">
                            {item.assigneeName || 'Unassigned'}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10.5px] text-[var(--text-muted)] truncate max-w-[140px]" title={item.iterationPath}>
                            {item.iterationPath || '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10.5px] text-[var(--text-muted)] truncate max-w-[140px]" title={item.areaPath}>
                            {item.areaPath || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
