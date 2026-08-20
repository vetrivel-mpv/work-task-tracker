import React from 'react';
import { Defect, Release, UserStory, TeamMember, AppState } from '../../types';
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
  TrendingUp
} from 'lucide-react';
import { buildQaStatusReport } from '../../services/emailService';

interface DefectsDashboardProps {
  defects: Defect[];
  releases: Release[];
  userStories: UserStory[];
  team: TeamMember[];
  state: AppState;
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
  team,
  state,
  onOpenQaStatusEmail
}) => {
  // KPI Calculations
  const totalDefects = defects.length;
  const criticalCount = defects.filter(d => d.severity === 'critical' && d.status !== 'Closed').length;
  const highCount = defects.filter(d => d.severity === 'high' && d.status !== 'Closed').length;
  const closedDefects = defects.filter(d => d.status === 'Closed').length;
  const resolutionRate = totalDefects > 0 ? Math.round((closedDefects / totalDefects) * 100) : 0;
  
  const totalStories = userStories.length;
  const passedStories = userStories.filter(s => s.status === 'QA Passed' || s.status === 'Done').length;
  const qaPassRate = totalStories > 0 ? Math.round((passedStories / totalStories) * 100) : 0;

  // Chart Data: Severity
  const severityData = [
    { name: 'Critical', value: defects.filter(d => d.severity === 'critical').length, key: 'critical' },
    { name: 'High', value: defects.filter(d => d.severity === 'high').length, key: 'high' },
    { name: 'Medium', value: defects.filter(d => d.severity === 'medium').length, key: 'medium' },
    { name: 'Low', value: defects.filter(d => d.severity === 'low').length, key: 'low' }
  ].filter(d => d.value > 0);

  // Chart Data: Status
  const statusData = ['New', 'Active', 'Fixed', 'Retest', 'Closed'].map(st => ({
    name: st,
    count: defects.filter(d => d.status === st).length,
    fill: STATUS_COLORS[st]
  }));

  // Chart Data: Release breakdown
  const releaseData = releases.map(rel => {
    const relBugs = defects.filter(d => d.releaseId === rel.id);
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
          <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">QA Health & Defects Analytics</h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Defect resolution velocity, release risk indices, and QA pass rates
          </p>
        </div>

        <button
          onClick={onOpenQaStatusEmail}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Mail size={14} />
          <span>Broadcast QA Report</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
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
    </div>
  );
};
