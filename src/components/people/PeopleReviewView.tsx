import React, { useState, useMemo } from 'react';
import { 
  TeamMember, 
  TeamGroup, 
  Task, 
  UserStory, 
  Defect, 
  PeopleReviewNote 
} from '../../types';
import { 
  Users, 
  UserCheck,
  Plus, 
  Award, 
  CheckCircle2, 
  Sparkles, 
  Edit3, 
  Trash2, 
  Calendar, 
  Heart, 
  MessageSquareCheck,
  ShieldCheck,
  TrendingUp,
  Activity,
  Zap,
  Target,
  BarChart3,
  Layers,
  Bug,
  Clock,
  ChevronRight,
  Flame,
  CheckCircle,
  Star,
  Search
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  ComposedChart
} from 'recharts';
import { generateAppreciationNote } from '../../services/aiService';
import { generateId, toDateStr, shiftDate, formatDisplayDate } from '../../utils/date';

interface PeopleReviewViewProps {
  team: TeamMember[];
  groups: TeamGroup[];
  tasks: Task[];
  userStories: UserStory[];
  defects: Defect[];
  peopleReviews: PeopleReviewNote[];
  geminiApiKey?: string;
  onAddMember: (member: TeamMember) => void;
  onUpdateMember: (member: TeamMember) => void;
  onDeleteMember: (memberId: string) => void;
  onAddGroup: (group: TeamGroup) => void;
  onAddReviewNote: (note: PeopleReviewNote) => void;
}

type ChartMetricMode = 'all' | 'completed' | 'workload' | 'quality';
type TeamFilterSection = 'all' | 'my_team' | 'assigned_to' | 'created_by';

export const PeopleReviewView: React.FC<PeopleReviewViewProps> = ({
  team,
  groups,
  tasks,
  userStories,
  defects,
  peopleReviews,
  geminiApiKey,
  onAddMember,
  onUpdateMember,
  onDeleteMember,
  onAddGroup,
  onAddReviewNote
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [activeMemberId, setActiveMemberId] = useState<string>(team[0]?.id || '');
  const [chartMetricMode, setChartMetricMode] = useState<ChartMetricMode>('all');
  const [showTableDetails, setShowTableDetails] = useState(false);
  const [teamSectionFilter, setTeamSectionFilter] = useState<TeamFilterSection>('all');
  const [searchMember, setSearchMember] = useState('');
  
  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Member form
  const [memberName, setMemberName] = useState('');
  const [memberRole, setMemberRole] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberIsMyTeam, setMemberIsMyTeam] = useState(false);

  // Review form
  const [highlights, setHighlights] = useState('');
  const [areasOfGrowth, setAreasOfGrowth] = useState('');
  const [appreciationNote, setAppreciationNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const activeMember = team.find(t => t.id === activeMemberId) || team[0];

  // Calculated overall metrics for active member
  const memberTasks = tasks.filter(t => t.assigneeIds.includes(activeMember?.id || ''));
  const completedTasks = memberTasks.filter(t => t.status === 'complete').length;

  const memberStories = userStories.filter(s => s.assigneeId === activeMember?.id || s.createdById === activeMember?.id);
  const storyPointsDelivered = memberStories
    .filter(s => s.status === 'QA Passed' || s.status === 'Done')
    .reduce((acc, s) => acc + (s.storyPoints || 0), 0);

  const memberDefects = defects.filter(d => d.assigneeId === activeMember?.id || d.createdById === activeMember?.id);
  const defectsResolved = memberDefects.filter(d => d.status === 'Closed' || d.status === 'Fixed').length;

  const memberReviews = peopleReviews.filter(r => r.memberId === activeMember?.id);

  // Split team into My Team vs other sections
  const myTeamMembers = useMemo(() => {
    return team.filter(m => m.isMyTeam);
  }, [team]);

  const assignedToMembers = useMemo(() => {
    return team.filter(m => m.adoSource === 'assigned_to');
  }, [team]);

  const createdByMembers = useMemo(() => {
    return team.filter(m => m.adoSource === 'created_by');
  }, [team]);

  // Filtered members list for left sidebar roster
  const filteredTeam = useMemo(() => {
    return team.filter(m => {
      // Text search
      if (searchMember.trim()) {
        const query = searchMember.toLowerCase();
        const matchName = m.name.toLowerCase().includes(query);
        const matchRole = m.role.toLowerCase().includes(query);
        const matchEmail = m.email.toLowerCase().includes(query);
        if (!matchName && !matchRole && !matchEmail) return false;
      }

      // Section filter
      if (teamSectionFilter === 'my_team') return !!m.isMyTeam;
      if (teamSectionFilter === 'assigned_to') return m.adoSource === 'assigned_to';
      if (teamSectionFilter === 'created_by') return m.adoSource === 'created_by';
      return true;
    });
  }, [team, teamSectionFilter, searchMember]);

  // Toggle "My Team" status for a member
  const handleToggleMyTeam = (member: TeamMember, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onUpdateMember({
      ...member,
      isMyTeam: !member.isMyTeam
    });
  };

  // --- 7-Day Contribution Trend Data Computation ---
  const todayStr = toDateStr(new Date());

  const last7Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push(shiftDate(todayStr, -i));
    }
    return days;
  }, [todayStr]);

  const trendData = useMemo(() => {
    if (!activeMember) return [];

    return last7Days.map(dateStr => {
      const displayDate = formatDisplayDate(dateStr);
      // Format short label e.g., "Aug 14 (Thu)" or "Thu 14"
      const parts = displayDate.split(', ');
      const weekday = parts[0] || '';
      const monthDay = parts[1] || '';
      const dayLabel = `${weekday} ${monthDay.split(' ')[1] || ''}`.trim() || displayDate;

      // Tasks for active member on this date
      const dayMemberTasks = tasks.filter(
        t => t.dateStr === dateStr && t.assigneeIds.includes(activeMember.id)
      );
      const completedOnDay = dayMemberTasks.filter(t => t.status === 'complete').length;
      const assignedOnDay = dayMemberTasks.length;
      const pendingOnDay = dayMemberTasks.filter(t => t.status !== 'complete').length;

      // Defects resolved on or assigned to member
      const memberDefectsActive = defects.filter(
        d => d.assigneeId === activeMember.id && (d.createdAt?.startsWith(dateStr) || d.updatedAt?.startsWith(dateStr))
      ).length;

      // Story points delivered on this date
      const pointsOnDay = userStories
        .filter(s => s.assigneeId === activeMember.id && s.updatedAt?.startsWith(dateStr) && (s.status === 'QA Passed' || s.status === 'Done'))
        .reduce((sum, s) => sum + (s.storyPoints || 0), 0);

      // Team average for comparison context
      const allTeamTasksOnDay = tasks.filter(t => t.dateStr === dateStr && t.status === 'complete').length;
      const teamAvgCompleted = team.length > 0 ? parseFloat((allTeamTasksOnDay / team.length).toFixed(1)) : 0;

      // Weighted daily velocity score
      const velocityScore = (completedOnDay * 10) + (memberDefectsActive * 5) + (pointsOnDay * 3);

      return {
        dateStr,
        dayLabel,
        fullDate: displayDate,
        completedTasks: completedOnDay,
        assignedTasks: assignedOnDay,
        pendingTasks: pendingOnDay,
        defectsResolved: memberDefectsActive,
        storyPoints: pointsOnDay,
        teamAvgCompleted,
        velocityScore
      };
    });
  }, [activeMember, last7Days, tasks, defects, userStories, team.length]);

  // 7-day aggregate calculations
  const sevenDayMetrics = useMemo(() => {
    const totalCompleted = trendData.reduce((acc, d) => acc + d.completedTasks, 0);
    const totalAssigned = trendData.reduce((acc, d) => acc + d.assignedTasks, 0);
    const totalDefects = trendData.reduce((acc, d) => acc + d.defectsResolved, 0);
    const totalPoints = trendData.reduce((acc, d) => acc + d.storyPoints, 0);
    const avgDailyCompleted = parseFloat((totalCompleted / 7).toFixed(1));
    const completionRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : (totalCompleted > 0 ? 100 : 0);

    // Find peak day
    let peakDay = trendData[0];
    trendData.forEach(d => {
      if (d.completedTasks > (peakDay?.completedTasks || 0)) {
        peakDay = d;
      }
    });

    return {
      totalCompleted,
      totalAssigned,
      totalDefects,
      totalPoints,
      avgDailyCompleted,
      completionRate,
      peakDayLabel: peakDay ? `${peakDay.dayLabel} (${peakDay.completedTasks} tasks)` : 'N/A'
    };
  }, [trendData]);

  const handleOpenMemberModal = (member?: TeamMember) => {
    if (member) {
      setEditingMember(member);
      setMemberName(member.name);
      setMemberRole(member.role);
      setMemberEmail(member.email);
      setMemberIsMyTeam(!!member.isMyTeam);
    } else {
      setEditingMember(null);
      setMemberName('');
      setMemberRole('');
      setMemberEmail('');
      setMemberIsMyTeam(false);
    }
    setMemberModalOpen(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) return;

    if (editingMember) {
      onUpdateMember({
        ...editingMember,
        name: memberName.trim(),
        role: memberRole.trim() || 'Software Engineer',
        email: memberEmail.trim(),
        isMyTeam: memberIsMyTeam
      });
    } else {
      onAddMember({
        id: generateId('tm'),
        name: memberName.trim(),
        role: memberRole.trim() || 'Software Engineer',
        email: memberEmail.trim(),
        avatarColor: '#4F46E5',
        active: true,
        isMyTeam: memberIsMyTeam,
        adoSource: 'manual'
      });
    }

    setMemberModalOpen(false);
  };

  const handleDraftAiAppreciation = async () => {
    if (!activeMember) return;
    setAiLoading(true);
    const res = await generateAppreciationNote(
      activeMember,
      completedTasks,
      highlights || 'Consistently delivering high-velocity technical features and maintaining high test quality.',
      selectedPeriod,
      geminiApiKey
    );
    setAiLoading(false);
    if (res.ok && res.text) {
      setAppreciationNote(res.text);
    }
  };

  const handleSaveReviewNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember || !highlights.trim()) return;

    onAddReviewNote({
      id: generateId('rev'),
      memberId: activeMember.id,
      dateStr: toDateStr(new Date()),
      period: selectedPeriod,
      highlights: highlights.trim(),
      areasOfGrowth: areasOfGrowth.trim(),
      appreciationNote: appreciationNote.trim() || undefined,
      author: 'Alex Rivera (Lead)',
      createdAt: toDateStr(new Date())
    });

    setHighlights('');
    setAreasOfGrowth('');
    setAppreciationNote('');
    setReviewModalOpen(false);
  };

  // Custom Chart Tooltip Component
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0].payload;
      return (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 shadow-lg backdrop-blur-md text-xs min-w-[200px]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border)]">
            <span className="font-bold text-[var(--text-primary)]">{dataItem.fullDate}</span>
            <span className="text-[10px] font-semibold text-[var(--text-muted)] bg-[var(--bg-subtle)] px-2 py-0.5 rounded">
              7-Day Window
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-[var(--text-secondary)]">{entry.name}:</span>
                </div>
                <span className="font-bold text-[var(--text-primary)] font-mono-token">
                  {entry.value}
                </span>
              </div>
            ))}
          </div>
          {dataItem.velocityScore > 0 && (
            <div className="mt-2 pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--primary)] font-semibold">
              <span>Contribution Index:</span>
              <span className="font-bold font-mono-token">{dataItem.velocityScore} pts</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full pb-16">
      {/* Header & Period Switcher */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">Peoples, People & Performance</h1>
            {myTeamMembers.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] text-[10.5px] font-bold">
                {myTeamMembers.length} in My Team
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
            Dedicated My Team view, ADO Assigned To & Created By peoples, 7-day contribution trends, and 1-on-1s
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Toggle */}
          <div className="flex bg-[var(--bg-subtle)] border border-[var(--border)] p-1 rounded-xl text-xs font-bold">
            {(['month', 'quarter', 'year'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${
                  selectedPeriod === p
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleOpenMemberModal()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>Add Person</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Directory & Performance Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Team Directory (4 cols) */}
        <div className="lg:col-span-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
          {/* Roster Header and Section Filter */}
          <div className="flex flex-col gap-2.5 pb-2 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-primary)]">People & Team Roster ({team.length})</span>
            </div>

            {/* Filter Tabs: All, My Team, Assigned To, Created By */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-[10px] font-bold">
              <button
                onClick={() => setTeamSectionFilter('all')}
                className={`py-1 px-1 rounded-lg text-center truncate transition-all ${
                  teamSectionFilter === 'all'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="All team members and peoples"
              >
                All ({team.length})
              </button>

              <button
                onClick={() => setTeamSectionFilter('my_team')}
                className={`py-1 px-1 rounded-lg text-center truncate transition-all flex items-center justify-center gap-0.5 ${
                  teamSectionFilter === 'my_team'
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="My direct team members"
              >
                <Star size={10} className={teamSectionFilter === 'my_team' ? 'fill-white' : ''} />
                <span>My Team ({myTeamMembers.length})</span>
              </button>

              <button
                onClick={() => setTeamSectionFilter('assigned_to')}
                className={`py-1 px-1 rounded-lg text-center truncate transition-all ${
                  teamSectionFilter === 'assigned_to'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="People from ADO Assigned To parameter"
              >
                Assigned ({assignedToMembers.length})
              </button>

              <button
                onClick={() => setTeamSectionFilter('created_by')}
                className={`py-1 px-1 rounded-lg text-center truncate transition-all ${
                  teamSectionFilter === 'created_by'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="People from ADO Created By parameter"
              >
                Created ({createdByMembers.length})
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search peoples by name or role..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
              />
            </div>
          </div>

          {/* Render List */}
          <div className="flex flex-col gap-2 max-h-[580px] overflow-y-auto pr-1">
            {filteredTeam.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] flex flex-col items-center gap-2">
                <Users size={24} className="opacity-40" />
                <p>
                  {teamSectionFilter === 'my_team' 
                    ? 'No members marked in My Team yet. Click the star icon on any person to add them to My Team.' 
                    : 'No matching people found.'}
                </p>
              </div>
            ) : (
              filteredTeam.map(member => {
                const isSelected = member.id === activeMember?.id;
                const isMyTeam = !!member.isMyTeam;
                const memberGroupNames = groups
                  .filter(g => (member.groupIds || []).includes(g.id))
                  .map(g => g.name);

                // Quick 7-day task count for preview
                const member7DayDone = tasks.filter(
                  t => t.assigneeIds.includes(member.id) && t.status === 'complete' && last7Days.includes(t.dateStr)
                ).length;

                return (
                  <div
                    key={member.id}
                    onClick={() => setActiveMemberId(member.id)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[var(--primary-light)] border-[var(--primary)] text-[var(--primary-text)] shadow-xs'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs flex-shrink-0 relative"
                          style={{ backgroundColor: member.avatarColor || '#4F46E5' }}
                        >
                          {member.name[0]}
                          {isMyTeam && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-white border border-[var(--surface)]">
                              ★
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold truncate">{member.name}</span>
                            {isMyTeam && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                My Team
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] truncate">
                            <span className="truncate">{member.role}</span>
                            {member.adoSource && (
                              <span className="text-[9px] font-semibold px-1 rounded bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-muted)]">
                                {member.adoSource === 'assigned_to' ? 'ADO Assigned' : member.adoSource === 'created_by' ? 'ADO Creator' : 'Manual'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Toggle My Team Star Button */}
                        <button
                          onClick={(e) => handleToggleMyTeam(member, e)}
                          className={`p-1 rounded-md transition-all ${
                            isMyTeam 
                              ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10' 
                              : 'text-[var(--text-muted)] hover:text-amber-500'
                          }`}
                          title={isMyTeam ? 'Remove from My Team' : 'Add to My Team'}
                        >
                          <Star size={13} className={isMyTeam ? 'fill-amber-500' : ''} />
                        </button>

                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]" title="7-day tasks completed">
                          {member7DayDone} done
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMemberModal(member);
                          }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          title="Edit member"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>

                    {memberGroupNames.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {memberGroupNames.map((gn, idx) => (
                          <span key={idx} className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)]">
                            {gn}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Member Performance Dashboard (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {activeMember && (
            <>
              {/* Member Profile & Overall Metrics Header */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold text-white shadow-xs relative"
                      style={{ backgroundColor: activeMember.avatarColor || '#4F46E5' }}
                    >
                      {activeMember.name.split(' ').map(n => n[0]).join('')}
                      {activeMember.isMyTeam && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[10px] text-white border-2 border-[var(--surface)]">
                          ★
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[var(--text-primary)]">{activeMember.name}</h2>
                        {activeMember.isMyTeam ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Star size={11} className="fill-amber-500" />
                            <span>My Team Member</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleMyTeam(activeMember)}
                            className="text-[10.5px] font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                          >
                            <Star size={11} />
                            <span>Add to My Team</span>
                          </button>
                        )}
                        {activeMember.adoSource && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]">
                            {activeMember.adoSource === 'assigned_to' ? 'ADO Assigned To' : activeMember.adoSource === 'created_by' ? 'ADO Created By' : 'Manual Entry'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">{activeMember.role} &bull; {activeMember.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleMyTeam(activeMember)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all ${
                        activeMember.isMyTeam
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Star size={13} className={activeMember.isMyTeam ? 'fill-amber-500' : ''} />
                      <span>{activeMember.isMyTeam ? 'In My Team' : '+ Add to My Team'}</span>
                    </button>

                    <button
                      onClick={() => setReviewModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs transition-all"
                    >
                      <Award size={14} />
                      <span>Log 1-on-1 Review</span>
                    </button>
                  </div>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3.5 text-center">
                    <div className="text-2xl font-black text-[var(--primary)]">{completedTasks}</div>
                    <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Tasks Completed (Total)</div>
                  </div>

                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3.5 text-center">
                    <div className="text-2xl font-black text-[var(--secondary-accent)]">{storyPointsDelivered}</div>
                    <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Story Points Delivered</div>
                  </div>

                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3.5 text-center">
                    <div className="text-2xl font-black text-[var(--critical)]">{defectsResolved}</div>
                    <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase mt-0.5">Defects Handled & Fixed</div>
                  </div>
                </div>
              </div>

              {/* --- 7-DAY RECHARTS CONTRIBUTION TREND LINE CHART --- */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-5">
                {/* Header with Title & Metric Filter Mode */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        7-Day Contribution & Velocity Trends
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Daily task completions, defects, and delivery volume for {activeMember.name}
                      </p>
                    </div>
                  </div>

                  {/* Mode Selector */}
                  <div className="flex bg-[var(--bg-subtle)] border border-[var(--border)] p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setChartMetricMode('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetricMode === 'all'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      All Streams
                    </button>
                    <button
                      onClick={() => setChartMetricMode('completed')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetricMode === 'completed'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Completed vs Team Avg
                    </button>
                    <button
                      onClick={() => setChartMetricMode('workload')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetricMode === 'workload'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Workload (Assigned vs Done)
                    </button>
                    <button
                      onClick={() => setChartMetricMode('quality')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        chartMetricMode === 'quality'
                          ? 'bg-[var(--primary)] text-white shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Defects & Points
                    </button>
                  </div>
                </div>

                {/* 7-Day Quick Metric Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">7-Day Completed</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-black text-[var(--primary)] font-mono-token">
                        {sevenDayMetrics.totalCompleted}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] font-medium">tasks</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Avg Daily Velocity</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-black text-[var(--secondary-accent)] font-mono-token">
                        {sevenDayMetrics.avgDailyCompleted}
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] font-medium">tasks/day</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Completion Rate</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-black text-[#16A34A] font-mono-token">
                        {sevenDayMetrics.completionRate}%
                      </span>
                      <span className="text-[11px] text-[var(--text-secondary)] font-medium">of assigned</span>
                    </div>
                  </div>

                  <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-3 flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Peak Day</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xs font-bold text-[var(--text-primary)] truncate" title={sevenDayMetrics.peakDayLabel}>
                        {sevenDayMetrics.peakDayLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recharts Line Chart Container */}
                <div className="w-full h-[280px] pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} />
                      <XAxis 
                        dataKey="dayLabel" 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={{ stroke: 'var(--border)' }}
                      />
                      <YAxis 
                        stroke="var(--text-muted)" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={{ stroke: 'var(--border)' }}
                        allowDecimals={false} 
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Legend 
                        wrapperStyle={{ paddingTop: 10, fontSize: 11, fontWeight: 600 }} 
                        iconType="circle"
                      />

                      {/* Primary Completed Tasks Line */}
                      {(chartMetricMode === 'all' || chartMetricMode === 'completed' || chartMetricMode === 'workload') && (
                        <Line
                          type="monotone"
                          dataKey="completedTasks"
                          name="Completed Tasks"
                          stroke="#4F46E5"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: '#FFFFFF' }}
                          activeDot={{ r: 7, stroke: '#4F46E5', strokeWidth: 2, fill: '#FFFFFF' }}
                        />
                      )}

                      {/* Total Assigned Workload Line */}
                      {(chartMetricMode === 'all' || chartMetricMode === 'workload') && (
                        <Line
                          type="monotone"
                          dataKey="assignedTasks"
                          name="Assigned Tasks"
                          stroke="#0284C7"
                          strokeWidth={2}
                          strokeDasharray="4 2"
                          dot={{ r: 3.5, fill: '#0284C7' }}
                          activeDot={{ r: 6 }}
                        />
                      )}

                      {/* Team Average Line for Context */}
                      {(chartMetricMode === 'all' || chartMetricMode === 'completed') && (
                        <Line
                          type="monotone"
                          dataKey="teamAvgCompleted"
                          name="Team Average"
                          stroke="#94A3B8"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      )}

                      {/* Defects Handled */}
                      {(chartMetricMode === 'all' || chartMetricMode === 'quality') && (
                        <Line
                          type="monotone"
                          dataKey="defectsResolved"
                          name="Defects Handled"
                          stroke="#DC2626"
                          strokeWidth={2}
                          dot={{ r: 3.5, fill: '#DC2626' }}
                          activeDot={{ r: 6 }}
                        />
                      )}

                      {/* Story Points */}
                      {chartMetricMode === 'quality' && (
                        <Line
                          type="monotone"
                          dataKey="storyPoints"
                          name="Story Points"
                          stroke="#7C3AED"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#7C3AED' }}
                          activeDot={{ r: 6 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Collapsible Daily Breakdown Toggle */}
                <div className="pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => setShowTableDetails(!showTableDetails)}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                  >
                    <span>{showTableDetails ? 'Hide Daily Table Breakdown' : 'View Day-by-Day Contribution Table'}</span>
                    <ChevronRight size={13} className={`transition-transform ${showTableDetails ? 'rotate-90' : ''}`} />
                  </button>

                  {showTableDetails && (
                    <div className="mt-3 overflow-x-auto border border-[var(--border)] rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] font-bold uppercase text-[10px] border-b border-[var(--border)]">
                          <tr>
                            <th className="px-3.5 py-2.5">Date</th>
                            <th className="px-3.5 py-2.5 text-center">Completed Tasks</th>
                            <th className="px-3.5 py-2.5 text-center">Assigned Tasks</th>
                            <th className="px-3.5 py-2.5 text-center">Defects Fixed</th>
                            <th className="px-3.5 py-2.5 text-center">Team Avg</th>
                            <th className="px-3.5 py-2.5 text-right">Contribution Index</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)] text-[var(--text-primary)]">
                          {trendData.map(d => (
                            <tr key={d.dateStr} className="hover:bg-[var(--surface-hover)]">
                              <td className="px-3.5 py-2 font-semibold">{d.fullDate}</td>
                              <td className="px-3.5 py-2 text-center font-bold text-[var(--primary)] font-mono-token">
                                {d.completedTasks}
                              </td>
                              <td className="px-3.5 py-2 text-center text-[var(--text-secondary)] font-mono-token">
                                {d.assignedTasks}
                              </td>
                              <td className="px-3.5 py-2 text-center font-mono-token text-[var(--critical)]">
                                {d.defectsResolved}
                              </td>
                              <td className="px-3.5 py-2 text-center text-[var(--text-muted)] font-mono-token">
                                {d.teamAvgCompleted}
                              </td>
                              <td className="px-3.5 py-2 text-right font-bold text-[var(--text-primary)] font-mono-token">
                                {d.velocityScore} pts
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* 1-on-1 History & Reviews */}
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-xs flex flex-col gap-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">1-on-1 & Growth Notes History</h3>

                {memberReviews.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {memberReviews.map(rev => (
                      <div key={rev.id} className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pb-1 border-b border-[var(--border)]">
                          <span className="font-bold text-[var(--text-primary)] capitalize">{rev.period} Review &bull; {rev.author}</span>
                          <span>{formatDisplayDate(rev.dateStr)}</span>
                        </div>
                        <div className="text-xs text-[var(--text-primary)] leading-relaxed">
                          <strong>Key Highlights:</strong> {rev.highlights}
                        </div>
                        {rev.areasOfGrowth && (
                          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            <strong>Areas for Growth:</strong> {rev.areasOfGrowth}
                          </div>
                        )}
                        {rev.appreciationNote && (
                          <div className="mt-2 p-3 bg-[var(--surface)] border border-[var(--critical-border)] rounded-lg text-xs text-[var(--critical)] leading-relaxed flex items-start gap-2">
                            <Heart size={14} className="text-[var(--critical)] flex-shrink-0 mt-0.5" />
                            <div>
                              <strong>Appreciation:</strong> {rev.appreciationNote}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">No review notes recorded yet for {activeMember.name}.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Member Edit / Add Modal */}
      {memberModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-md w-full shadow-xl p-6 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">
              {editingMember ? 'Edit Teammate' : 'Add Team Member'}
            </h2>
            <form onSubmit={handleSaveMember} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Patel"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Role</label>
                <input
                  type="text"
                  placeholder="e.g. Senior QA Automation Engineer"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">Email</label>
                <input
                  type="email"
                  placeholder="e.g. maya.patel@careflow.io"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
                />
              </div>

              {/* My Team Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl">
                <input
                  type="checkbox"
                  id="myTeamCheck"
                  checked={memberIsMyTeam}
                  onChange={(e) => setMemberIsMyTeam(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--primary)]"
                />
                <label htmlFor="myTeamCheck" className="text-xs font-bold text-[var(--text-primary)] cursor-pointer flex items-center gap-1">
                  <Star size={13} className={memberIsMyTeam ? 'fill-amber-500 text-amber-500' : 'text-[var(--text-muted)]'} />
                  <span>Mark as member of My Team</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs"
                >
                  Save Teammate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1-on-1 Review Modal with AI Drafter */}
      {reviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Log 1-on-1 & Performance Check-in: {activeMember?.name}
              </h2>
              <button
                onClick={() => setReviewModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveReviewNote} className="p-6 flex flex-col gap-4 max-h-[calc(85vh-80px)] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Key Delivery Highlights & Achievements <span className="text-[var(--critical)]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="What key outcomes, leadership moments, or code quality highlights did they achieve?"
                  value={highlights}
                  onChange={(e) => setHighlights(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Areas of Growth & Coaching Goals
                </label>
                <textarea
                  rows={2}
                  placeholder="What can they focus on in the next sprint or quarter?"
                  value={areasOfGrowth}
                  onChange={(e) => setAreasOfGrowth(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
                />
              </div>

              {/* AI Appreciation Drafter */}
              <div className="bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">Appreciation Letter (Optional)</span>
                  <button
                    type="button"
                    onClick={handleDraftAiAppreciation}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline"
                  >
                    <Sparkles size={13} />
                    <span>{aiLoading ? 'Drafting…' : '✨ Draft with Gemini'}</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Sincere appreciation note to share directly with the engineer..."
                  value={appreciationNote}
                  onChange={(e) => setAppreciationNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] rounded-xl shadow-xs"
                >
                  Save Review Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
