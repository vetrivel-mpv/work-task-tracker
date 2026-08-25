import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Globe, 
  CheckCircle2, 
  Key, 
  Layers, 
  ShieldCheck 
} from 'lucide-react';
import { ApiEnvironment } from '../../types/apiAutomation';
import { generateId } from '../../utils/date';

interface EnvironmentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: ApiEnvironment[];
  activeEnvironmentId: string;
  onSelectEnvironment: (id: string) => void;
  onUpdateEnvironments: (envs: ApiEnvironment[]) => void;
}

export const EnvironmentManagerModal: React.FC<EnvironmentManagerModalProps> = ({
  isOpen,
  onClose,
  environments,
  activeEnvironmentId,
  onSelectEnvironment,
  onUpdateEnvironments
}) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string>(activeEnvironmentId || environments[0]?.id || '');
  const [envList, setEnvList] = useState<ApiEnvironment[]>(environments);

  if (!isOpen) return null;

  const currentEnv = envList.find(e => e.id === selectedEnvId) || envList[0];

  const handleUpdateCurrentEnv = (updates: Partial<ApiEnvironment>) => {
    if (!currentEnv) return;
    const updatedList = envList.map(e => e.id === currentEnv.id ? { ...e, ...updates } : e);
    setEnvList(updatedList);
    onUpdateEnvironments(updatedList);
  };

  const handleAddNewEnv = () => {
    const newEnv: ApiEnvironment = {
      id: generateId('env'),
      name: 'New Test Environment',
      baseUrl: 'http://localhost:3000',
      description: 'Custom target server environment',
      variables: {
        baseUrl: 'http://localhost:3000',
        apiKey: 'secret-token'
      },
      headers: [
        { key: 'Accept', value: 'application/json', enabled: true }
      ]
    };
    const updated = [...envList, newEnv];
    setEnvList(updated);
    setSelectedEnvId(newEnv.id);
    onUpdateEnvironments(updated);
  };

  const handleDeleteEnv = (id: string) => {
    if (envList.length <= 1) return;
    const updated = envList.filter(e => e.id !== id);
    setEnvList(updated);
    if (selectedEnvId === id) {
      setSelectedEnvId(updated[0].id);
    }
    onUpdateEnvironments(updated);
  };

  const handleVariableChange = (oldKey: string, newKey: string, newVal: string) => {
    if (!currentEnv) return;
    const vars = { ...currentEnv.variables };
    if (oldKey !== newKey) {
      delete vars[oldKey];
    }
    vars[newKey] = newVal;
    handleUpdateCurrentEnv({ variables: vars });
  };

  const handleAddVariable = () => {
    if (!currentEnv) return;
    const vars = { ...currentEnv.variables, [`var_${Date.now()}`]: '' };
    handleUpdateCurrentEnv({ variables: vars });
  };

  const handleRemoveVariable = (key: string) => {
    if (!currentEnv) return;
    const vars = { ...currentEnv.variables };
    delete vars[key];
    handleUpdateCurrentEnv({ variables: vars });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-sm">
              <Globe size={18} />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                Environment & Variable Manager
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Configure target server URLs, secret API tokens, and variable dictionaries
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

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left: Environment List (4 cols) */}
          <div className="md:col-span-4 border-r border-[var(--border)] p-4 flex flex-col overflow-y-auto bg-[var(--bg-subtle)]/50 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                Environments
              </span>
              <button
                onClick={handleAddNewEnv}
                className="p-1 text-[var(--primary)] hover:bg-[var(--primary-light)] rounded-lg cursor-pointer"
                title="Add Environment"
              >
                <Plus size={14} />
              </button>
            </div>

            {envList.map(env => (
              <div
                key={env.id}
                onClick={() => setSelectedEnvId(env.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedEnvId === env.id 
                    ? 'bg-[var(--surface)] border-[var(--primary)] shadow-sm' 
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">{env.name}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)] truncate font-mono">{env.baseUrl}</div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeEnvironmentId === env.id && (
                    <span className="text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">
                      Active
                    </span>
                  )}
                  {envList.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEnv(env.id);
                      }}
                      className="p-1 text-rose-500 hover:bg-rose-500/10 rounded cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Environment Detail & Variables (8 cols) */}
          <div className="md:col-span-8 p-6 overflow-y-auto space-y-5 bg-[var(--surface)]">
            {currentEnv ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[var(--text-muted)]">Environment Name</label>
                    <input
                      type="text"
                      value={currentEnv.name}
                      onChange={(e) => handleUpdateCurrentEnv({ name: e.target.value })}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-hidden"
                    />
                  </div>

                  <button
                    onClick={() => {
                      onSelectEnvironment(currentEnv.id);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold shadow-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer"
                  >
                    Set as Active Environment
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[var(--text-muted)]">Base URL (Target Gateway)</label>
                  <input
                    type="text"
                    value={currentEnv.baseUrl}
                    onChange={(e) => handleUpdateCurrentEnv({ baseUrl: e.target.value })}
                    placeholder="https://api.example.com"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-hidden"
                  />
                </div>

                {/* Variables Map */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text-muted)]">
                      Environment Variables ({Object.keys(currentEnv.variables || {}).length})
                    </span>
                    <button
                      onClick={handleAddVariable}
                      className="text-xs font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={13} />
                      <span>Add Variable</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(currentEnv.variables || {}).map(([key, val], idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={key}
                          onChange={(e) => handleVariableChange(key, e.target.value, val)}
                          placeholder="Variable Key"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono font-bold text-[var(--primary)]"
                        />
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleVariableChange(key, key, e.target.value)}
                          placeholder="Value"
                          className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-mono text-[var(--text-primary)]"
                        />
                        <button
                          onClick={() => handleRemoveVariable(key)}
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-hover)]/30 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
