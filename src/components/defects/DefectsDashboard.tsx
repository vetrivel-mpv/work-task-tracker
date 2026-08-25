import React, { useState, useMemo } from 'react';
import { Defect, Release, UserStory, TeamMember, TestCase, AppState } from '../../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Flame, 
  ShieldAlert, 
  Download, 
  Mail,
  TrendingUp,
  Layers,
  Activity,
  Rocket,
  Gauge,
  BookOpen
} from 'lucide-react';
import { buildQaStatusReport } from '../../services/emailService';
import { matchesReleaseOrIteration, formatReleaseDisplayName } from '../../utils/adoPaths';
import { DefectImpactMatrix } from './DefectImpactMatrix';
import { QeVelocityWidgets } from './QeVelocityWidgets';
import { QeProcessPlaybook } from './QeProcessPlaybook';

interface DefectsDashboardProps {
  defects: Defect[];
  releases: Release[];
  userStories: UserStory[];
  testCases?: TestCase[];
  team: TeamMember[];
  state: AppState;
  selectedReleaseId?: string | null;
  onOpenQaStatusEmail: () => void;
}

const SEVERITY_COLORS: { [key: string]: string } = {
  critical: '#9B1D32',
  high: '#B42318',
  medium: '#D97706',
  low: '#0F6E62'
};

const STATUS_COLORS: { [key: string]: string } = {
  New: '#84918A',
  Active: '#B42318',
  Fixed: '#0284C7',
  Retest: '#7C3AED',
  Closed: '#0C6E5E'
};

export const DefectsDashboard: React.FC<DefectsDashboardProps> = ({
  defects,
  releases,
  userStories,
  testCases = [],
  team,
  state,
  selectedReleaseId,
  onOpenQaStatusEmail
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'velocity' | 'playbook'>('analytics');

  // Scoped datasets based on global top header release selector
  const activeRelease = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return null;
    return releases.find(r => r.id === selectedReleaseId);
  }, [releases, selectedReleaseId]);

  const activeDefects = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return defects;
    return defects.filter(d => matchesReleaseOrIteration(d, selectedReleaseId, releases));
  }, [defects, selectedReleaseId, releases]);

  const activeStories = useMemo(() => {
    if (!selectedReleaseId || selectedReleaseId === 'all') return userStories;
    return userStories.filter(s => matchesReleaseOrIteration(s, selectedReleaseId, releases));
  }, [userStories, selectedReleaseId, releases]);

  // KPI Calculations
  const totalDefects = activeDefects.length;
  const criticalCount = activeDefects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const highCount = activeDefects.filter(d => d.severity === 'high' && d.status !== 'Closed').length;
  const closedDefects = activeDefects.filter(d => d.status === 'Closed').length;
  const resolutionRate = totalDefects > 0 ? Math.round((closedDefects / totalDefects) * 100) : 0;
  
  const totalStories = activeStories.length;
  const passedStories = activeStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
  const qaPassRate = totalStories > 0 ? Math.round((passedStories / totalStories) * 100) : 0;

  // Chart Data: Severity
  const severityData = [
    { name: 'Critical', value: activeDefects.filter(d => d.severity === 'critical').length, key: 'critical' },
    { name: 'High', value: activeDefects.filter(d => d.severity === 'high').length, key: 'high' },
    { name: 'Medium', value: activeDefects.filter(d => d.severity === 'medium').length, key: 'medium' },
    { name: 'Low', value: activeDefects.filter(d => d.severity === 'low').length, key: 'low' }
  ].filter(d => d.value > 0);

  // Chart Data: Status
  const statusData = ['New', 'Active', 'Fixed', 'Retest', 'Closed'].map(st => ({
    name: st,
    count: activeDefects.filter(d => d.status === st).length,
    fill: STATUS_COLORS[st]
  }));

  // Chart Data: Release breakdown
  const releaseData = releases.map(rel => {
    const relBugs = defects.filter(d => matchesReleaseOrIteration(d, rel.id, releases));
    return {
      name: rel.name.split('-')[0].trim().slice(0, 14),
      open: relBugs.filter(d => d.status !== 'Closed').length,
      closed: relBugs.filter(d => d.status === 'Closed').length
    };
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">QA Health & Defects Analytics</h1>
            {activeRelease && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
                <Rocket size={12} />
                {formatReleaseDisplayName(activeRelease.name, activeRelease.releaseNumber)}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Defect resolution velocity, release risk indices, and QA pass rates
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-tab Navigation */}
          <div className="flex items-center p-1 bg-[var(--surface-hover)] border border-[var(--border)] rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'analytics'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BarChart3 size={14} />
              <span>QA Analytics</span>
            </button>
            <button
              onClick={() => setActiveTab('velocity')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'velocity'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Gauge size={14} />
              <span>QE Velocity</span>
            </button>
            <button
              onClick={() => setActiveTab('playbook')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'playbook'
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen size={14} />
              <span>Process & Playbook</span>
            </button>
          </div>

          <button
            onClick={onOpenQaStatusEmail}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Mail size={14} />
            <span>Broadcast QA Report</span>
          </button>
        </div>
      </div>

      {activeTab === 'velocity' && (
        <QeVelocityWidgets
          defects={activeDefects}
          testCases={testCases}
          userStories={activeStories}
          selectedRelease={activeRelease}
        />
      )}

      {activeTab === 'playbook' && (
        <QeProcessPlaybook />
      )}

      {activeTab === 'analytics' && (
        <>
          {/* Top Level KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>Total Logged Defects</span>
                <BarChart3 size={16} className="text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-black text-[var(--text-primary)] mt-2">{totalDefects}</div>
              <div className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                {closedDefects} closed &bull; {totalDefects - closedDefects} active
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--critical)] uppercase tracking-wider">
                <span>Active Critical Blockers</span>
                <Flame size={16} className="text-[var(--critical)]" />
              </div>
              <div className="text-2xl font-black text-[var(--critical)] mt-2">{criticalCount}</div>
              <div className="text-xs text-[var(--critical)] font-semibold mt-1">
                {highCount} high severity open
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>Defect Resolution Rate</span>
                <CheckCircle2 size={16} className="text-[var(--low)]" />
              </div>
              <div className="text-2xl font-black text-[var(--low)] mt-2">{resolutionRate}%</div>
              <div className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                Target: &gt;85% for Staging cut
              </div>
            </div>

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                <span>User Story QA Pass</span>
                <TrendingUp size={16} className="text-[var(--primary)]" />
              </div>
              <div className="text-2xl font-black text-[var(--primary)] mt-2">{qaPassRate}%</div>
              <div className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
                {passedStories}/{totalStories} stories verified
              </div>
            </div>
          </div>

          {/* Visual Impact Matrix (Technical Debt Visualizer) */}
          <DefectImpactMatrix
            defects={defects}
            releases={releases}
            team={team}
            selectedReleaseId={selectedReleaseId}
          />

          {/* Visual Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity Distribution Donut */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Defects by Severity</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={SEVERITY_COLORS[entry.key]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Status Breakdown Bar */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Defect Pipeline Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <XAxis dataKey="name" fontSize={11} stroke="var(--text-muted)" />
                    <YAxis fontSize={11} allowDecimals={false} stroke="var(--text-muted)" />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Defects by Release Comparison */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Release Scope & Bug Burn-down</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={releaseData}>
                  <XAxis dataKey="name" fontSize={11} stroke="var(--text-muted)" />
                  <YAxis fontSize={11} allowDecimals={false} stroke="var(--text-muted)" />
                  <Tooltip />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="open" name="Active Bugs" fill="#B42318" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="closed" name="Resolved Bugs" fill="var(--low)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
