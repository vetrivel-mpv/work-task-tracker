import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileCode, 
  Copy, 
  Check, 
  AlertTriangle, 
  Layers, 
  Terminal,
  Code,
  Zap
} from 'lucide-react';
import { ApiAutomationCollection } from '../../types/apiAutomation';
import { parsePostmanCollection } from '../../utils/apiAutomationEngine';
import { generateBruFile, parseBruFile, generateBrunoCollectionJson } from '../../utils/brunoEngine';

interface PostmanImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCollection: (collection: ApiAutomationCollection) => void;
  activeCollection?: ApiAutomationCollection;
}

export const PostmanImportExportModal: React.FC<PostmanImportExportModalProps> = ({
  isOpen,
  onClose,
  onImportCollection,
  activeCollection
}) => {
  const [activeTab, setActiveTab] = useState<'import' | 'export_bruno' | 'export_postman' | 'export_playwright'>('import');
  const [importJson, setImportJson] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleImport = () => {
    setError(null);
    try {
      if (!importJson.trim()) {
        throw new Error('Please paste Postman Collection JSON or Bruno (.bru) format or upload a file.');
      }

      // Detect Bruno .bru format
      if (importJson.includes('meta {') || importJson.includes('seq:') || importJson.includes('assert {')) {
        const parsedReq = parseBruFile(importJson);
        const fullCol: ApiAutomationCollection = {
          id: `col_bru_${Date.now()}`,
          name: parsedReq.name || 'Imported Bruno Request',
          description: 'Imported from Bruno (.bru) format',
          category: 'integration',
          baseUrl: '{{baseUrl}}',
          variables: { baseUrl: 'http://localhost:3000' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          requests: [
            {
              id: parsedReq.id || `req_${Date.now()}`,
              name: parsedReq.name || 'Bruno Request Step',
              method: parsedReq.method || 'GET',
              url: parsedReq.url || '/api/health',
              headers: parsedReq.headers || [],
              params: parsedReq.params || [],
              bodyType: parsedReq.bodyType || 'none',
              bodyContent: parsedReq.bodyContent || '',
              assertions: parsedReq.assertions || [],
              extractVariables: parsedReq.extractVariables || [],
              enabled: true
            }
          ]
        };
        onImportCollection(fullCol);
        onClose();
        return;
      }

      // Otherwise parse as Postman JSON
      const partialCol = parsePostmanCollection(importJson);
      if (!partialCol.requests || partialCol.requests.length === 0) {
        throw new Error('No valid requests found in this Postman collection JSON.');
      }

      const fullCol: ApiAutomationCollection = {
        id: partialCol.id || `col_${Date.now()}`,
        name: partialCol.name || 'Imported Postman Collection',
        description: partialCol.description || 'Imported from Postman JSON',
        category: 'integration',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        requests: partialCol.requests
      };

      onImportCollection(fullCol);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid format. Please check your Postman JSON or Bruno format.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
    };
    reader.readAsText(file);
  };

  // Construct Postman v2.1 export JSON
  const generatePostmanJson = (col: ApiAutomationCollection) => {
    const postman = {
      info: {
        _postman_id: col.id,
        name: col.name,
        description: col.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: col.requests.map(r => ({
        name: r.name,
        request: {
          method: r.method,
          header: r.headers.map(h => ({ key: h.key, value: h.value })),
          url: {
            raw: r.url,
            host: ['{{baseUrl}}']
          },
          body: r.bodyType === 'json' ? {
            mode: 'raw',
            raw: r.bodyContent,
            options: { raw: { language: 'json' } }
          } : undefined
        }
      }))
    };
    return JSON.stringify(postman, null, 2);
  };

  // Construct Bruno collection representation
  const generateBrunoExport = (col: ApiAutomationCollection) => {
    const manifest = generateBrunoCollectionJson(col);
    const bruFiles = col.requests.map((r, idx) => `// ================= [ File: ${r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.bru ] =================\n` + generateBruFile(r, idx + 1)).join('\n\n');
    return `// ================= [ File: bruno.json ] =================\n${manifest}\n\n${bruFiles}`;
  };

  // Construct Playwright test script
  const generatePlaywrightScript = (col: ApiAutomationCollection) => {
    return `import { test, expect } from '@playwright/test';

test.describe('${col.name}', () => {
  let authToken = '';

${col.requests.map((r, i) => `  test('${r.name}', async ({ request }) => {
    const response = await request.${r.method.toLowerCase()}('${r.url}', {
      headers: {
        'Accept': 'application/json',
        ${r.headers.filter(h => h.enabled).map(h => `'${h.key}': '${h.value}'`).join(',\n        ')}
      }${r.bodyType === 'json' && r.bodyContent ? `,\n      data: ${r.bodyContent}` : ''}
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json).toBeDefined();
  });`).join('\n\n')}
});
`;
  };

  const currentCol = activeCollection || {
    id: 'demo',
    name: 'Sample API Automation Suite',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    requests: []
  };

  const exportedPostman = activeCollection ? generatePostmanJson(activeCollection) : '';
  const exportedBruno = activeCollection ? generateBrunoExport(activeCollection) : '';
  const exportedPlaywright = activeCollection ? generatePlaywrightScript(activeCollection) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Zap size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                Bruno & Postman Import / Export Hub
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Export to Bruno (.bru) Git files, Postman v2.1 JSON collections, and Playwright TypeScript suites
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="px-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 overflow-x-auto shrink-0 py-2">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Upload size={13} className="inline mr-1.5" />
            <span>Import (.json / .bru)</span>
          </button>
          <button
            onClick={() => setActiveTab('export_bruno')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'export_bruno'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Zap size={13} className="inline mr-1.5" />
            <span>Export Bruno (.bru)</span>
          </button>
          <button
            onClick={() => setActiveTab('export_postman')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'export_postman'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Download size={13} className="inline mr-1.5" />
            <span>Export Postman v2.1</span>
          </button>
          <button
            onClick={() => setActiveTab('export_playwright')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'export_playwright'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Code size={13} className="inline mr-1.5" />
            <span>Export Playwright (TS)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'import' && (
            <div className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-primary)]">
                    Paste Bruno (.bru) DSL or Postman Collection JSON
                  </label>
                  <label className="text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer">
                    <span>Or Upload .bru / .json file</span>
                    <input
                      type="file"
                      accept=".json,.bru,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  rows={10}
                  placeholder={`meta {\n  name: Sample API Step\n  type: http\n  seq: 1\n}\n\nget {\n  url: {{baseUrl}}/api/health\n}\n\nassert {\n  res.status: eq 200\n}`}
                  className="w-full p-3 rounded-xl border border-[var(--border)] bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleImport}
                  className="px-5 py-2 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  Import and Build Suite
                </button>
              </div>
            </div>
          )}

          {activeTab === 'export_bruno' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                  <Zap size={13} />
                  <span>Bruno Collection & .bru Files Bundle</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(exportedBruno, 'bruno_all')}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedKey === 'bruno_all' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'bruno_all' ? 'Copied' : 'Copy All .bru Files'}</span>
                  </button>
                </div>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 text-purple-300 font-mono text-xs leading-relaxed overflow-x-auto max-h-80 border border-purple-900/40 selection:bg-purple-500/30">
                {exportedBruno || 'No collection selected for export.'}
              </pre>
            </div>
          )}

          {activeTab === 'export_postman' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)]">
                  Postman v2.1 Collection JSON
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(exportedPostman, 'pm_json')}
                    className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedKey === 'pm_json' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedKey === 'pm_json' ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-80 border border-slate-800">
                {exportedPostman || 'No collection selected for export.'}
              </pre>
            </div>
          )}

          {activeTab === 'export_playwright' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-muted)]">
                  Playwright API Test Script (TypeScript)
                </span>
                <button
                  onClick={() => handleCopy(exportedPlaywright, 'pw_script')}
                  className="px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedKey === 'pw_script' ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedKey === 'pw_script' ? 'Copied' : 'Copy Script'}</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-80 border border-slate-800">
                {exportedPlaywright || 'No collection selected for export.'}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
