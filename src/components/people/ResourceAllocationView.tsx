import React, { useState, useMemo } from 'react';
import { 
  TeamMember, 
  Task, 
  UserStory, 
  Defect, 
  AbsenceRecord, 
  AppUser,
  Priority 
} from '../../types';
import { 
  Calendar, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  UserCheck, 
  UserX, 
  Sparkles, 
  SlidersHorizontal, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft, 
  ArrowRight, 
  RefreshCw, 
  Copy, 
  Check, 
  Download, 
  Layers, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Info, 
  ShieldAlert, 
  Zap, 
  Plus, 
  Edit3, 
  Users, 
  CalendarDays,
  CalendarRange,
  Flame,
  HelpCircle,
  FolderSync
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';
import { 
  generateResourceCapacityAdvice, 
  ResourceCapacityAdviceResult 
} from '../../services/aiService';
import { 
  toDateStr, 
  fromDateStr, 
  shiftDate, 
  formatDisplayDate 
} from '../../utils/date';

interface ResourceAllocationViewProps {
  team: TeamMember[];
  tasks: Task[];
  userStories: UserStory[];
  defects: Defect[];
  absences?: AbsenceRecord[];
  currentDateStr: string;
  currentUser?: AppUser;
  geminiApiKey?: string;
  onUpdateMember?: (member: TeamMember) => void;
  onUpdateTask?: (task: Task) => void;
  onUpdateStory?: (story: UserStory) => void;
  onUpdateDefect?: (defect: Defect) => void;
}

type ViewMode = 'roster' | 'daily_heatmap' | 'charts';
type StatusFilter = 'all' | 'overloaded' | 'balanced' | 'available' | 'on_leave';
type TeamSectionFilter = 'all' | 'my_team' | 'assigned_to' | 'created_by';

// Estimate hours for tasks, stories, and defects
function parseTaskHours(task: Task): number {
  if (task.time) {
    const num = parseFloat(task.time.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) return num;
  }
  if (task.ticketType === 'test_run') return 3;
  if (task.ticketType === 'customer_defect') return 4;
  if (task.ticketType === 'dev_activity') return 4.5;
  if (task.priority === 'critical') return 5;
  if (task.priority === 'high') return 4;
  return 3;
}

function parseStoryHours(story: UserStory): number {
  const sp = story.storyPoints || 3;
  // 1 story point ≈ 5.5 hours of development & QA effort
  return Math.round(sp * 5.5);
}

function parseDefectHours(defect: Defect): number {
  if (defect.severity === 'critical') return 6;
  if (defect.severity === 'high') return 4;
  if (defect.severity === 'medium') return 2.5;
  return 1.5;
}

export const ResourceAllocationView: React.FC<ResourceAllocationViewProps> = ({
  team,
  tasks,
  userStories,
  defects,
  absences = [],
  currentDateStr,
  currentUser,
  geminiApiKey,
  onUpdateMember,
  onUpdateTask,
  onUpdateStory,
  onUpdateDefect
}) => {
  // Navigation & Date State
  const [selectedAnchorDate, setSelectedAnchorDate] = useState<string>(currentDateStr);
  const [viewMode, setViewMode] = useState<ViewMode>('roster');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [teamSectionFilter, setTeamSectionFilter] = useState<TeamSectionFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusCapacityPct, setFocusCapacityPct] = useState<number>(85); // 85% focus work, 15% meetings/slack
  
  // Expanded member row states
  const [expandedMemberIds, setExpandedMemberIds] = useState<Record<string, boolean>>({});
  
  // Member capacity override modal
  const [capacityModalMember, setCapacityModalMember] = useState<TeamMember | null>(null);
  const [modalCapacityHours, setModalCapacityHours] = useState<number>(40);

  // Quick Task Reassignment Modal
  const [reassignItem, setReassignItem] = useState<{
    id: string;
    type: 'task' | 'story' | 'defect';
    title: string;
    currentAssigneeId: string;
    hours: number;
  } | null>(null);
  const [targetReassignMemberId, setTargetReassignMemberId] = useState<string>('');

  // AI Resource Advisor State
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiAdvice, setAiAdvice] = useState<ResourceCapacityAdviceResult | null>(null);
  const [showAiAdvisor, setShowAiAdvisor] = useState<boolean>(false);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Calculate Monday through Friday for current selected week
  const weekDays = useMemo(() => {
    const d = fromDateStr(selectedAnchorDate);
    const dayOfWeek = d.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
    // Calculate distance to Monday
    const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + distToMon);

    const days: Array<{
      dateStr: string;
      dayName: string;
      dayShort: string;
      displayStr: string;
      isToday: boolean;
    }> = [];

    for (let i = 0; i < 5; i++) {
      const cur = new Date(monday);
      cur.setDate(monday.getDate() + i);
      const str = toDateStr(cur);
      days.push({
        dateStr: str,
        dayName: cur.toLocaleDateString('en-US', { weekday: 'long' }),
        dayShort: cur.toLocaleDateString('en-US', { weekday: 'short' }),
        displayStr: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: str === currentDateStr
      });
    }

    return days;
  }, [selectedAnchorDate, currentDateStr]);

  const weekStartStr = weekDays[0]?.dateStr || selectedAnchorDate;
  const weekEndStr = weekDays[weekDays.length - 1]?.dateStr || selectedAnchorDate;
  const weekRangeLabel = `${formatDisplayDate(weekStartStr)} – ${formatDisplayDate(weekEndStr)}`;

  // Navigate Weeks
  const handlePrevWeek = () => {
    setSelectedAnchorDate(prev => shiftDate(prev, -7));
  };
  const handleNextWeek = () => {
    setSelectedAnchorDate(prev => shiftDate(prev, 7));
  };
  const handleCurrentWeek = () => {
    setSelectedAnchorDate(currentDateStr);
  };

  const toggleExpandMember = (id: string) => {
    setExpandedMemberIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleExpandAll = () => {
    const allExpanded = team.every(m => expandedMemberIds[m.id]);
    const newState: Record<string, boolean> = {};
    if (!allExpanded) {
      team.forEach(m => { newState[m.id] = true; });
    }
    setExpandedMemberIds(newState);
  };

  // Compute detailed resource allocation metrics for each team member
  const memberAllocations = useMemo(() => {
    const activeTeam = team.filter(m => m.active !== false);

    return activeTeam.map(member => {
      const baselineGrossHours = member.weeklyCapacityHours || 40;

      // 1. Calculate Absences / Leaves for this week
      const memberWeekAbsences = absences.filter(a => {
        if (a.memberId !== member.id || a.status === 'cancelled') return false;
        // Check if absence date falls in this week
        if (a.endDateStr && a.endDateStr >= a.dateStr) {
          return weekDays.some(w => w.dateStr >= a.dateStr && w.dateStr <= (a.endDateStr || ''));
        }
        return weekDays.some(w => w.dateStr === a.dateStr);
      });

      let totalLeaveHoursDeducted = 0;
      const dayLeaveHoursMap: Record<string, number> = {};

      weekDays.forEach(wd => {
        dayLeaveHoursMap[wd.dateStr] = 0;
      });

      memberWeekAbsences.forEach(a => {
        weekDays.forEach(wd => {
          let dayApplies = false;
          if (a.endDateStr && a.endDateStr >= a.dateStr) {
            dayApplies = wd.dateStr >= a.dateStr && wd.dateStr <= a.endDateStr;
          } else {
            dayApplies = wd.dateStr === a.dateStr;
          }

          if (dayApplies) {
            let deducted = 0;
            if (a.type === 'full_day') {
              deducted = 8;
            } else if (a.type === 'half_day_morning' || a.type === 'half_day_afternoon') {
              deducted = 4;
            } else if (a.type === 'hourly_permission') {
              deducted = a.permissionHours || 2;
            }
            dayLeaveHoursMap[wd.dateStr] = Math.min(8, (dayLeaveHoursMap[wd.dateStr] || 0) + deducted);
          }
        });
      });

      totalLeaveHoursDeducted = Object.values(dayLeaveHoursMap).reduce((sum, h) => sum + h, 0);
      const netWorkingCapacity = Math.max(0, baselineGrossHours - totalLeaveHoursDeducted);
      const effectiveTargetCapacity = Math.round(netWorkingCapacity * (focusCapacityPct / 100));

      // 2. Gather Planned Tasks assigned to this member
      // Included: tasks scheduled in this week, or active incomplete tasks assigned to member
      const memberTasks = tasks.filter(t => {
        const isAssigned = (t.assigneeIds && t.assigneeIds.includes(member.id)) || t.assigneeId === member.id;
        if (!isAssigned) return false;
        // In week or incomplete
        const inWeek = weekDays.some(wd => wd.dateStr === t.dateStr || wd.dateStr === t.dueDate);
        return inWeek || t.status !== 'complete';
      });

      // Tasks mapped by day for heatmap
      const dayTasksMap: Record<string, Task[]> = {};
      weekDays.forEach(wd => { dayTasksMap[wd.dateStr] = []; });

      memberTasks.forEach(t => {
        const targetDay = weekDays.find(wd => wd.dateStr === t.dateStr || wd.dateStr === t.dueDate);
        if (targetDay) {
          dayTasksMap[targetDay.dateStr].push(t);
        } else if (t.status !== 'complete' && weekDays[0]) {
          // Spread across week if pending
          dayTasksMap[weekDays[0].dateStr].push(t);
        }
      });

      const totalTaskHours = memberTasks.reduce((sum, t) => sum + parseTaskHours(t), 0);

      // 3. Gather Active User Stories assigned to this member
      const memberStories = userStories.filter(s => 
        (s.assigneeId === member.id) && 
        (s.status === 'Dev In Progress' || s.status === 'QA In Progress' || s.status === 'QA Ready' || s.status === 'In Analysis')
      );
      const totalStoryHours = memberStories.reduce((sum, s) => sum + parseStoryHours(s), 0);

      // 4. Gather Active Defects assigned to this member
      const memberDefects = defects.filter(d => 
        (d.assigneeId === member.id) && 
        (d.status === 'New' || d.status === 'Active' || d.status === 'Retest')
      );
      const totalDefectHours = memberDefects.reduce((sum, d) => sum + parseDefectHours(d), 0);

      // Total Planned Hours
      const totalPlannedHours = totalTaskHours + totalStoryHours + totalDefectHours;

      // Utilization & Capacity Status
      const capacityDenominator = effectiveTargetCapacity > 0 ? effectiveTargetCapacity : baselineGrossHours;
      const utilizationPct = capacityDenominator > 0 ? Math.round((totalPlannedHours / capacityDenominator) * 100) : 100;
      const deltaHours = effectiveTargetCapacity - totalPlannedHours;

      let statusCategory: 'overloaded' | 'balanced' | 'available' | 'on_leave' = 'balanced';
      if (netWorkingCapacity === 0 || totalLeaveHoursDeducted >= 24) {
        statusCategory = 'on_leave';
      } else if (utilizationPct > 100) {
        statusCategory = 'overloaded';
      } else if (utilizationPct < 75) {
        statusCategory = 'available';
      } else {
        statusCategory = 'balanced';
      }

      // Day by day details for heatmap
      const dailyDetails = weekDays.map(wd => {
        const dayLeave = dayLeaveHoursMap[wd.dateStr] || 0;
        const dayCapacity = Math.max(0, 8 - dayLeave);
        const dayTaskList = dayTasksMap[wd.dateStr] || [];
        const dayPlannedHours = dayTaskList.reduce((s, t) => s + parseTaskHours(t), 0);
        const dayUtilPct = dayCapacity > 0 ? Math.round((dayPlannedHours / dayCapacity) * 100) : (dayPlannedHours > 0 ? 200 : 0);

        return {
          dateStr: wd.dateStr,
          dayShort: wd.dayShort,
          dayCapacity,
          dayLeave,
          dayPlannedHours,
          dayTaskList,
          dayUtilPct,
          isFullLeave: dayLeave >= 8,
          isHalfLeave: dayLeave >= 4 && dayLeave < 8
        };
      });

      return {
        member,
        baselineGrossHours,
        totalLeaveHoursDeducted,
        netWorkingCapacity,
        effectiveTargetCapacity,
        totalPlannedHours,
        totalTaskHours,
        totalStoryHours,
        totalDefectHours,
        utilizationPct,
        deltaHours,
        statusCategory,
        memberTasks,
        memberStories,
        memberDefects,
        memberWeekAbsences,
        dailyDetails
      };
    });
  }, [team, tasks, userStories, defects, absences, weekDays, focusCapacityPct]);

  // Filtered allocations based on search & filter controls
  const filteredAllocations = useMemo(() => {
    return memberAllocations.filter(item => {
      // 1. Team section filter
      if (teamSectionFilter === 'my_team' && !item.member.isMyTeam) return false;
      if (teamSectionFilter === 'assigned_to' && item.member.adoSource !== 'assigned_to') return false;
      if (teamSectionFilter === 'created_by' && item.member.adoSource !== 'created_by') return false;

      // 2. Status filter
      if (statusFilter !== 'all' && item.statusCategory !== statusFilter) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.member.name.toLowerCase().includes(q);
        const matchesRole = item.member.role.toLowerCase().includes(q);
        const matchesEmail = item.member.email.toLowerCase().includes(q);
        const matchesTasks = item.memberTasks.some(t => t.title.toLowerCase().includes(q));
        const matchesStories = item.memberStories.some(s => s.title.toLowerCase().includes(q));
        const matchesDefects = item.memberDefects.some(d => d.title.toLowerCase().includes(q));
        if (!matchesName && !matchesRole && !matchesEmail && !matchesTasks && !matchesStories && !matchesDefects) {
          return false;
        }
      }

      return true;
    });
  }, [memberAllocations, teamSectionFilter, statusFilter, searchQuery]);

  // Overall Aggregate Team Summary
  const teamAggregateMetrics = useMemo(() => {
    const totalGross = memberAllocations.reduce((s, i) => s + i.baselineGrossHours, 0);
    const totalLeaves = memberAllocations.reduce((s, i) => s + i.totalLeaveHoursDeducted, 0);
    const totalNet = memberAllocations.reduce((s, i) => s + i.netWorkingCapacity, 0);
    const totalEffectiveCapacity = memberAllocations.reduce((s, i) => s + i.effectiveTargetCapacity, 0);
    const totalPlanned = memberAllocations.reduce((s, i) => s + i.totalPlannedHours, 0);
    const totalTasksCount = memberAllocations.reduce((s, i) => s + i.memberTasks.length, 0);
    const totalStoriesCount = memberAllocations.reduce((s, i) => s + i.memberStories.length, 0);
    const totalDefectsCount = memberAllocations.reduce((s, i) => s + i.memberDefects.length, 0);

    const overallUtilPct = totalEffectiveCapacity > 0 
      ? Math.round((totalPlanned / totalEffectiveCapacity) * 100) 
      : 0;

    const overloadedCount = memberAllocations.filter(i => i.statusCategory === 'overloaded').length;
    const balancedCount = memberAllocations.filter(i => i.statusCategory === 'balanced').length;
    const availableCount = memberAllocations.filter(i => i.statusCategory === 'available').length;
    const onLeaveCount = memberAllocations.filter(i => i.statusCategory === 'on_leave').length;

    const availableHoursRunway = Math.max(0, totalEffectiveCapacity - totalPlanned);
    const deficitHours = Math.max(0, totalPlanned - totalEffectiveCapacity);

    return {
      totalGross,
      totalLeaves,
      totalNet,
      totalEffectiveCapacity,
      totalPlanned,
      totalTasksCount,
      totalStoriesCount,
      totalDefectsCount,
      overallUtilPct,
      overloadedCount,
      balancedCount,
      availableCount,
      onLeaveCount,
      availableHoursRunway,
      deficitHours
    };
  }, [memberAllocations]);

  // Chart Data for Workload Distribution
  const chartData = useMemo(() => {
    return memberAllocations.map(item => ({
      name: item.member.name.split(' ')[0] || item.member.name,
      fullName: item.member.name,
      role: item.member.role,
      capacity: item.effectiveTargetCapacity,
      plannedTasks: item.totalTaskHours,
      plannedStories: item.totalStoryHours,
      plannedDefects: item.totalDefectHours,
      totalPlanned: item.totalPlannedHours,
      utilizationPct: item.utilizationPct,
      isOverloaded: item.utilizationPct > 100
    }));
  }, [memberAllocations]);

  // Handle AI Advisor generation
  const handleGenerateAdvisor = async () => {
    setAiLoading(true);
    setShowAiAdvisor(true);

    const payload = {
      weekRangeStr: weekRangeLabel,
      totalTeamCapacityHours: teamAggregateMetrics.totalEffectiveCapacity,
      totalPlannedHours: teamAggregateMetrics.totalPlanned,
      teamUtilizationPct: teamAggregateMetrics.overallUtilPct,
      memberStats: memberAllocations.map(i => ({
        id: i.member.id,
        name: i.member.name,
        role: String(i.member.role),
        grossCapacity: i.baselineGrossHours,
        leaveHours: i.totalLeaveHoursDeducted,
        netCapacity: i.effectiveTargetCapacity,
        plannedHours: i.totalPlannedHours,
        utilizationPct: i.utilizationPct,
        taskCount: i.memberTasks.length,
        storyCount: i.memberStories.length,
        defectCount: i.memberDefects.length,
        topTasks: i.memberTasks.slice(0, 3).map(t => t.title),
        leaveNote: i.memberWeekAbsences.length > 0 ? i.memberWeekAbsences.map(a => `${a.reason} (${a.type})`).join(', ') : undefined
      }))
    };

    const res = await generateResourceCapacityAdvice(payload, geminiApiKey);
    setAiLoading(false);
    if (res.ok && res.advice) {
      setAiAdvice(res.advice);
    }
  };

  // Save member capacity override
  const handleSaveMemberCapacity = () => {
    if (!capacityModalMember || !onUpdateMember) return;
    onUpdateMember({
      ...capacityModalMember,
      weeklyCapacityHours: modalCapacityHours
    });
    setCapacityModalMember(null);
  };

  // Reassign task action
  const handleExecuteReassign = () => {
    if (!reassignItem || !targetReassignMemberId) return;

    const targetMember = team.find(m => m.id === targetReassignMemberId);

    if (reassignItem.type === 'task' && onUpdateTask) {
      const task = tasks.find(t => t.id === reassignItem.id);
      if (task) {
        onUpdateTask({
          ...task,
          assigneeId: targetReassignMemberId,
          assigneeIds: [targetReassignMemberId],
          assigneeName: targetMember?.name || task.assigneeName
        });
      }
    } else if (reassignItem.type === 'story' && onUpdateStory) {
      const story = userStories.find(s => s.id === reassignItem.id);
      if (story) {
        onUpdateStory({
          ...story,
          assigneeId: targetReassignMemberId,
          assigneeName: targetMember?.name || story.assigneeName
        });
      }
    } else if (reassignItem.type === 'defect' && onUpdateDefect) {
      const defect = defects.find(d => d.id === reassignItem.id);
      if (defect) {
        onUpdateDefect({
          ...defect,
          assigneeId: targetReassignMemberId,
          assigneeName: targetMember?.name || defect.assigneeName
        });
      }
    }

    setReassignItem(null);
    setTargetReassignMemberId('');
  };

  // Copy Weekly Allocation Summary to Clipboard
  const handleCopySummary = () => {
    const text = `
=====================================================
WEEKLY RESOURCE CAPACITY & ALLOCATION REPORT
Week: ${weekRangeLabel}
Focus Multiplier: ${focusCapacityPct}% Focus Time
=====================================================
TEAM TOTALS:
- Gross Capacity: ${teamAggregateMetrics.totalGross}h
- Absence / PTO Deductions: -${teamAggregateMetrics.totalLeaves}h
- Net Effective Capacity: ${teamAggregateMetrics.totalEffectiveCapacity}h
- Total Planned Workload: ${teamAggregateMetrics.totalPlanned}h
- Team Utilization Rate: ${teamAggregateMetrics.overallUtilPct}%
- Available Runway / Free Hours: ${teamAggregateMetrics.availableHoursRunway}h
- Overloaded Members (>100%): ${teamAggregateMetrics.overloadedCount}
- Balanced Members (75-100%): ${teamAggregateMetrics.balancedCount}
- Available Members (<75%): ${teamAggregateMetrics.availableCount}

INDIVIDUAL BREAKDOWN:
${memberAllocations.map(i => `• ${i.member.name} (${i.member.role}):
   Capacity: ${i.effectiveTargetCapacity}h (Gross: ${i.baselineGrossHours}h, Leave: -${i.totalLeaveHoursDeducted}h)
   Planned Workload: ${i.totalPlannedHours}h (${i.memberTasks.length} tasks, ${i.memberStories.length} stories, ${i.memberDefects.length} bugs)
   Utilization: ${i.utilizationPct}% [${i.statusCategory.toUpperCase()}]
   Headroom: ${i.deltaHours >= 0 ? `+${i.deltaHours}h free` : `${i.deltaHours}h over capacity`}
`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = ['Member Name', 'Role', 'Team Scope', 'Gross Capacity (h)', 'Absence Deductions (h)', 'Effective Capacity (h)', 'Planned Tasks (h)', 'Planned Stories (h)', 'Planned Defects (h)', 'Total Planned (h)', 'Utilization (%)', 'Headroom Delta (h)', 'Status'];
    const rows = memberAllocations.map(i => [
      `"${i.member.name}"`,
      `"${i.member.role}"`,
      `"${i.member.isMyTeam ? 'My Team' : i.member.adoSource || 'Standard'}"`,
      i.baselineGrossHours,
      i.totalLeaveHoursDeducted,
      i.effectiveTargetCapacity,
      i.totalTaskHours,
      i.totalStoryHours,
      i.totalDefectHours,
      i.totalPlannedHours,
      `${i.utilizationPct}%`,
      i.deltaHours,
      i.statusCategory
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Resource_Allocation_${weekStartStr}_to_${weekEndStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Week Navigation Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Resource Allocation & Capacity</h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                Weekly Planner
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
              Calculates individual weekly baseline capacity minus PTO/absences vs. assigned tasks, stories, and defect triage.
            </p>
          </div>
        </div>

        {/* Week Navigator & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Week Date Picker Navigation */}
          <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl p-1 shadow-xs">
            <button
              onClick={handlePrevWeek}
              title="Previous Week"
              className="p-1.5 hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 min-w-[170px] justify-center">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>{weekRangeLabel}</span>
            </div>

            <button
              onClick={handleNextWeek}
              title="Next Week"
              className="p-1.5 hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleCurrentWeek}
            className="px-3 py-1.5 text-xs font-bold bg-[var(--bg-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
          >
            This Week
          </button>

          {/* AI Advisor Button */}
          <button
            onClick={handleGenerateAdvisor}
            disabled={aiLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {aiLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>AI Capacity Advisor</span>
          </button>

          {/* Export / Copy Dropdown buttons */}
          <button
            onClick={handleCopySummary}
            title="Copy Weekly Capacity Summary"
            className="p-2 bg-[var(--bg-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
          >
            {copiedSummary ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={handleExportCsv}
            title="Export CSV"
            className="p-2 bg-[var(--bg-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Top 5 Aggregate Executive Capacity KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Net Capacity */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Weekly Net Capacity</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-[var(--text-primary)] font-mono-token">
              {teamAggregateMetrics.totalEffectiveCapacity}
              <span className="text-sm font-normal text-[var(--text-secondary)] ml-1">hrs</span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-1 flex items-center gap-1">
              <span>Gross {teamAggregateMetrics.totalGross}h</span>
              {teamAggregateMetrics.totalLeaves > 0 && (
                <span className="text-rose-500 font-semibold">(-{teamAggregateMetrics.totalLeaves}h PTO)</span>
              )}
            </div>
          </div>
        </div>

        {/* Planned Tasks & Workload */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Planned Workload</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-[var(--text-primary)] font-mono-token">
              {teamAggregateMetrics.totalPlanned}
              <span className="text-sm font-normal text-[var(--text-secondary)] ml-1">hrs</span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              {teamAggregateMetrics.totalTasksCount} tasks • {teamAggregateMetrics.totalStoriesCount} stories • {teamAggregateMetrics.totalDefectsCount} bugs
            </div>
          </div>
        </div>

        {/* Overall Team Utilization */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Team Utilization</span>
            <div className={`p-1.5 rounded-lg ${
              teamAggregateMetrics.overallUtilPct > 100 
                ? 'bg-rose-500/10 text-rose-500' 
                : teamAggregateMetrics.overallUtilPct >= 75 
                ? 'bg-emerald-500/10 text-emerald-500' 
                : 'bg-amber-500/10 text-amber-500'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black font-mono-token ${
                teamAggregateMetrics.overallUtilPct > 100 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : teamAggregateMetrics.overallUtilPct >= 75 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {teamAggregateMetrics.overallUtilPct}%
              </span>
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                {teamAggregateMetrics.overallUtilPct > 100 ? 'Over Capacity' : teamAggregateMetrics.overallUtilPct >= 75 ? 'Optimal' : 'Capacity Headroom'}
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-[var(--bg-subtle)] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  teamAggregateMetrics.overallUtilPct > 100 
                    ? 'bg-rose-500' 
                    : teamAggregateMetrics.overallUtilPct >= 75 
                    ? 'bg-emerald-500' 
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, teamAggregateMetrics.overallUtilPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Capacity Buffer / Runway */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Headroom Runway</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono-token">
              +{teamAggregateMetrics.availableHoursRunway}
              <span className="text-sm font-normal text-[var(--text-secondary)] ml-1">hrs</span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] mt-1">
              Uncommitted buffer available for spillover
            </div>
          </div>
        </div>

        {/* Resource Allocation Roster Health */}
        <div className="p-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs flex flex-col justify-between col-span-2 md:col-span-3 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Roster Health</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="text-center">
              <span className="block text-sm font-black text-rose-500 font-mono-token">{teamAggregateMetrics.overloadedCount}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Overload</span>
            </div>
            <div className="w-[1px] h-6 bg-[var(--border)]" />
            <div className="text-center">
              <span className="block text-sm font-black text-emerald-500 font-mono-token">{teamAggregateMetrics.balancedCount}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Balanced</span>
            </div>
            <div className="w-[1px] h-6 bg-[var(--border)]" />
            <div className="text-center">
              <span className="block text-sm font-black text-amber-500 font-mono-token">{teamAggregateMetrics.availableCount}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">Available</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Capacity Advisor Recommendation Drawer */}
      {showAiAdvisor && aiAdvice && (
        <div className="p-5 bg-gradient-to-br from-indigo-950/40 via-[var(--surface)] to-violet-950/30 border border-indigo-500/30 rounded-2xl shadow-md space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sparkles className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-[var(--text-primary)]">AI Capacity & Workload Advisor</h3>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                    aiAdvice.overallHealth === 'HEALTHY' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : aiAdvice.overallHealth === 'OVERLOADED'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {aiAdvice.overallHealth} (Health Score: {aiAdvice.healthScore}/100)
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{aiAdvice.summary}</p>
              </div>
            </div>

            <button
              onClick={() => setShowAiAdvisor(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-all cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
            {/* Bottlenecks */}
            {aiAdvice.bottlenecks && aiAdvice.bottlenecks.length > 0 && (
              <div className="p-3.5 bg-[var(--surface)]/80 border border-rose-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Bottlenecked Teammates ({aiAdvice.bottlenecks.length})</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {aiAdvice.bottlenecks.map((b, idx) => (
                    <div key={idx} className="text-xs bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border)]">
                      <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                        <span>{b.memberName}</span>
                        <span className="text-rose-500 font-mono-token">{b.utilizationPct}% ({b.plannedHours}h / {b.capacityHours}h)</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-1">{b.issue}</p>
                      <p className="text-[11px] text-indigo-400 font-medium mt-1">💡 {b.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Rebalances */}
            {aiAdvice.actionableRebalances && aiAdvice.actionableRebalances.length > 0 && (
              <div className="p-3.5 bg-[var(--surface)]/80 border border-indigo-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400">
                  <FolderSync className="w-3.5 h-3.5" />
                  <span>Suggested Workload Rebalances</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {aiAdvice.actionableRebalances.map((r, idx) => (
                    <div key={idx} className="text-xs bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border)]">
                      <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                        <span className="text-rose-400">{r.fromMember}</span>
                        <ArrowRight className="w-3 h-3 text-indigo-400" />
                        <span className="text-emerald-400">{r.toMember}</span>
                        <span className="ml-auto text-indigo-300 font-mono-token">+{r.hoursRelieved}h</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] font-medium mt-1">Task: {r.taskTitle}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{r.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Underutilized / Available Capacity */}
            {aiAdvice.underutilizedMembers && aiAdvice.underutilizedMembers.length > 0 && (
              <div className="p-3.5 bg-[var(--surface)]/80 border border-emerald-500/20 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Available Capacity Runway ({aiAdvice.underutilizedMembers.length})</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {aiAdvice.underutilizedMembers.map((u, idx) => (
                    <div key={idx} className="text-xs bg-[var(--bg-subtle)] p-2.5 rounded-lg border border-[var(--border)]">
                      <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                        <span>{u.memberName} ({u.role})</span>
                        <span className="text-emerald-400 font-mono-token">+{u.availableHours}h free</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {u.suggestedTaskTypes.map((t, tidx) => (
                          <span key={tidx} className="text-[10px] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter & View Mode Switcher Strip */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs">
        {/* Left: View Mode Toggles */}
        <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border)]">
          <button
            onClick={() => setViewMode('roster')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'roster'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Capacity Ledger</span>
          </button>

          <button
            onClick={() => setViewMode('daily_heatmap')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'daily_heatmap'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
            <span>Mon–Fri Heatmap</span>
          </button>

          <button
            onClick={() => setViewMode('charts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'charts'
                ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
            <span>Workload Chart</span>
          </button>
        </div>

        {/* Middle: Focus Multiplier Slider / Filter by Section */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Team Filter */}
          <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border)] text-xs font-semibold">
            {(['all', 'my_team', 'assigned_to'] as const).map(sec => (
              <button
                key={sec}
                onClick={() => setTeamSectionFilter(sec)}
                className={`px-2.5 py-1 rounded-lg transition-all capitalize cursor-pointer ${
                  teamSectionFilter === sec
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {sec === 'all' ? 'All Team' : sec === 'my_team' ? 'My Team' : 'ADO Assigned'}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-xl border border-[var(--border)] text-xs font-semibold">
            {(['all', 'overloaded', 'balanced', 'available'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded-lg transition-all capitalize cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-xs font-bold border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {st === 'all' ? 'All Status' : st === 'overloaded' ? 'Overloaded 🔥' : st === 'balanced' ? 'Balanced ✅' : 'Available ⚡'}
              </button>
            ))}
          </div>

          {/* Focus Factor Capacity Slider */}
          <div className="flex items-center gap-2 bg-[var(--bg-subtle)] px-3 py-1.5 rounded-xl border border-[var(--border)] text-xs">
            <span className="text-[var(--text-secondary)] font-medium">Focus:</span>
            <input
              type="range"
              min="60"
              max="100"
              step="5"
              value={focusCapacityPct}
              onChange={(e) => setFocusCapacityPct(parseInt(e.target.value))}
              className="w-16 accent-indigo-500 cursor-pointer"
            />
            <span className="font-bold font-mono-token text-[var(--text-primary)]">{focusCapacityPct}%</span>
          </div>
        </div>

        {/* Right: Search & Expand All */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 lg:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search member, role, task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-all"
            />
          </div>

          <button
            onClick={toggleExpandAll}
            className="px-2.5 py-1.5 text-xs font-bold bg-[var(--bg-subtle)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] rounded-xl transition-all cursor-pointer"
          >
            Toggle All
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: ROSTER CAPACITY LEDGER */}
      {viewMode === 'roster' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border)] text-[var(--text-secondary)] font-bold">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4 min-w-[220px]">Team Member & Role</th>
                  <th className="py-3 px-4 text-center min-w-[120px]">Weekly Gross</th>
                  <th className="py-3 px-4 text-center min-w-[130px]">Absences / PTO</th>
                  <th className="py-3 px-4 text-center min-w-[130px]">Effective Net Capacity</th>
                  <th className="py-3 px-4 text-center min-w-[140px]">Planned Workload</th>
                  <th className="py-3 px-4 min-w-[200px]">Capacity Utilization</th>
                  <th className="py-3 px-4 text-right min-w-[100px]">Headroom</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredAllocations.map(item => {
                  const isExpanded = Boolean(expandedMemberIds[item.member.id]);
                  return (
                    <React.Fragment key={item.member.id}>
                      <tr 
                        className={`hover:bg-[var(--bg-subtle)]/60 transition-colors ${
                          isExpanded ? 'bg-[var(--bg-subtle)]/40' : ''
                        }`}
                      >
                        {/* Expand Button */}
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => toggleExpandMember(item.member.id)}
                            className="p-1 hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded transition-all cursor-pointer"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-indigo-500" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Member Identity & Role */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-xs text-xs flex-shrink-0"
                              style={{ backgroundColor: item.member.avatarColor || '#4F46E5' }}
                            >
                              {item.member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-[var(--text-primary)] truncate">
                                  {item.member.name}
                                </span>
                                {item.member.isMyTeam && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                    My Team
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[var(--text-muted)] font-medium block truncate">
                                {item.member.role}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Weekly Gross Capacity */}
                        <td className="py-3 px-4 text-center font-mono-token font-bold text-[var(--text-primary)]">
                          <button
                            onClick={() => {
                              setCapacityModalMember(item.member);
                              setModalCapacityHours(item.baselineGrossHours);
                            }}
                            title="Click to override weekly baseline capacity"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] transition-all cursor-pointer group"
                          >
                            <span>{item.baselineGrossHours}h</span>
                            <Edit3 className="w-3 h-3 text-[var(--text-muted)] group-hover:text-indigo-500 transition-colors" />
                          </button>
                        </td>

                        {/* Absences / PTO Impact */}
                        <td className="py-3 px-4 text-center">
                          {item.totalLeaveHoursDeducted > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              <UserX className="w-3 h-3" />
                              <span>-{item.totalLeaveHoursDeducted}h PTO</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-muted)] font-medium">None (100% Present)</span>
                          )}
                        </td>

                        {/* Effective Net Working Capacity */}
                        <td className="py-3 px-4 text-center font-mono-token font-black text-indigo-600 dark:text-indigo-400">
                          {item.effectiveTargetCapacity}h
                          <span className="block text-[9px] text-[var(--text-muted)] font-sans font-normal">
                            ({focusCapacityPct}% focus)
                          </span>
                        </td>

                        {/* Planned Workload Hours */}
                        <td className="py-3 px-4 text-center font-mono-token font-black text-[var(--text-primary)]">
                          <span>{item.totalPlannedHours}h</span>
                          <span className="block text-[9px] text-[var(--text-muted)] font-sans font-normal">
                            {item.memberTasks.length} tasks • {item.memberStories.length} stories
                          </span>
                        </td>

                        {/* Capacity Utilization Progress Bar */}
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className={`font-bold font-mono-token ${
                                item.utilizationPct > 100 
                                  ? 'text-rose-600 dark:text-rose-400' 
                                  : item.utilizationPct >= 75 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {item.utilizationPct}%
                              </span>
                              <span className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                                item.statusCategory === 'overloaded'
                                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                  : item.statusCategory === 'balanced'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                  : item.statusCategory === 'on_leave'
                                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              }`}>
                                {item.statusCategory.toUpperCase()}
                              </span>
                            </div>
                            {/* Bar with 100% threshold marker */}
                            <div className="w-full bg-[var(--bg-subtle)] h-2 rounded-full overflow-hidden relative">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  item.utilizationPct > 100 
                                    ? 'bg-rose-500' 
                                    : item.utilizationPct >= 75 
                                    ? 'bg-emerald-500' 
                                    : 'bg-amber-500'
                                }`}
                                style={{ width: `${Math.min(100, item.utilizationPct)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Headroom / Delta Hours */}
                        <td className="py-3 px-4 text-right font-mono-token font-bold">
                          {item.deltaHours >= 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+{item.deltaHours}h free</span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 font-extrabold">{item.deltaHours}h deficit</span>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Detailed Task Ledger */}
                      {isExpanded && (
                        <tr className="bg-[var(--bg-subtle)]/70 border-b border-[var(--border)]">
                          <td colSpan={8} className="py-4 px-6">
                            <div className="space-y-4">
                              {/* Member Breakdown Header */}
                              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border)]">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-extrabold text-[var(--text-primary)] text-xs">
                                    Assigned Work Items for {item.member.name} ({weekRangeLabel})
                                  </h4>
                                  <span className="text-[10px] text-[var(--text-muted)]">
                                    {item.memberTasks.length + item.memberStories.length + item.memberDefects.length} Total Work Items
                                  </span>
                                </div>

                                {item.memberWeekAbsences.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-xs text-rose-500 font-semibold">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>
                                      PTO Logged: {item.memberWeekAbsences.map(a => `${a.reason} (${a.dateStr})`).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Task List Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {/* Planned Tasks */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                                    <span>Tasks ({item.memberTasks.length})</span>
                                    <span className="font-mono-token text-indigo-400">{item.totalTaskHours}h</span>
                                  </div>

                                  {item.memberTasks.length === 0 ? (
                                    <p className="text-[11px] text-[var(--text-muted)] italic p-2 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                                      No direct tasks assigned this week.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                      {item.memberTasks.map(t => {
                                        const hrs = parseTaskHours(t);
                                        return (
                                          <div
                                            key={t.id}
                                            className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs space-y-1 group hover:border-indigo-500/40 transition-all"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-[var(--text-primary)] line-clamp-1">
                                                {t.title}
                                              </span>
                                              <span className="font-mono-token font-bold text-indigo-500 text-[11px]">
                                                {hrs}h
                                              </span>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                                              <span className="capitalize">{t.status} • {t.priority}</span>
                                              <button
                                                onClick={() => setReassignItem({
                                                  id: t.id,
                                                  type: 'task',
                                                  title: t.title,
                                                  currentAssigneeId: item.member.id,
                                                  hours: hrs
                                                })}
                                                className="text-indigo-400 hover:text-indigo-300 font-semibold opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                                              >
                                                Reassign ⇄
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Active User Stories */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                                    <span>In-Flight Stories ({item.memberStories.length})</span>
                                    <span className="font-mono-token text-blue-400">{item.totalStoryHours}h</span>
                                  </div>

                                  {item.memberStories.length === 0 ? (
                                    <p className="text-[11px] text-[var(--text-muted)] italic p-2 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                                      No active user stories in flight.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                      {item.memberStories.map(s => {
                                        const hrs = parseStoryHours(s);
                                        return (
                                          <div
                                            key={s.id}
                                            className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs space-y-1 group hover:border-blue-500/40 transition-all"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-[var(--text-primary)] line-clamp-1">
                                                {s.title}
                                              </span>
                                              <span className="font-mono-token font-bold text-blue-500 text-[11px]">
                                                {hrs}h ({s.storyPoints || 3} pts)
                                              </span>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                                              <span>{s.status}</span>
                                              <button
                                                onClick={() => setReassignItem({
                                                  id: s.id,
                                                  type: 'story',
                                                  title: s.title,
                                                  currentAssigneeId: item.member.id,
                                                  hours: hrs
                                                })}
                                                className="text-blue-400 hover:text-blue-300 font-semibold opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                                              >
                                                Reassign ⇄
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Active Defects */}
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-[var(--text-secondary)]">
                                    <span>Assigned Defects ({item.memberDefects.length})</span>
                                    <span className="font-mono-token text-rose-400">{item.totalDefectHours}h</span>
                                  </div>

                                  {item.memberDefects.length === 0 ? (
                                    <p className="text-[11px] text-[var(--text-muted)] italic p-2 bg-[var(--surface)] rounded-xl border border-[var(--border)]">
                                      Zero active defects assigned.
                                    </p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                      {item.memberDefects.map(d => {
                                        const hrs = parseDefectHours(d);
                                        return (
                                          <div
                                            key={d.id}
                                            className="p-2.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-xs space-y-1 group hover:border-rose-500/40 transition-all"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-[var(--text-primary)] line-clamp-1">
                                                {d.title}
                                              </span>
                                              <span className="font-mono-token font-bold text-rose-500 text-[11px]">
                                                {hrs}h
                                              </span>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                                              <span className="capitalize">{d.status} • {d.severity}</span>
                                              <button
                                                onClick={() => setReassignItem({
                                                  id: d.id,
                                                  type: 'defect',
                                                  title: d.title,
                                                  currentAssigneeId: item.member.id,
                                                  hours: hrs
                                                })}
                                                className="text-rose-400 hover:text-rose-300 font-semibold opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer"
                                              >
                                                Reassign ⇄
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: MON-FRI DAILY HEATMAP */}
      {viewMode === 'daily_heatmap' && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
              Daily Capacity & Scheduled Task Distribution (Mon – Fri)
            </h3>
            <span className="text-xs text-[var(--text-secondary)]">
              Standard 8 hrs / day baseline per full-time member
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border)] text-[var(--text-secondary)] font-bold">
                  <th className="py-3 px-4 min-w-[200px]">Team Member</th>
                  {weekDays.map(wd => (
                    <th key={wd.dateStr} className="py-3 px-3 text-center min-w-[130px]">
                      <div className={wd.isToday ? 'text-indigo-500 font-extrabold' : ''}>
                        <span>{wd.dayName}</span>
                        <span className="block text-[10px] font-normal text-[var(--text-muted)]">
                          {wd.displayStr} {wd.isToday && '• Today'}
                        </span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center min-w-[110px]">Weekly Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredAllocations.map(item => (
                  <tr key={item.member.id} className="hover:bg-[var(--bg-subtle)]/40 transition-colors">
                    {/* Member */}
                    <td className="py-3.5 px-4 font-extrabold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-[11px]"
                          style={{ backgroundColor: item.member.avatarColor || '#4F46E5' }}
                        >
                          {item.member.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="block truncate">{item.member.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] font-normal block truncate">
                            {item.member.role}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Monday - Friday Cells */}
                    {item.dailyDetails.map(dd => {
                      return (
                        <td key={dd.dateStr} className="py-3 px-2 text-center">
                          {dd.isFullLeave ? (
                            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-bold">
                              🏖️ Full Day PTO
                            </div>
                          ) : (
                            <div className={`p-2 rounded-xl border text-center transition-all ${
                              dd.dayUtilPct > 100 
                                ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' 
                                : dd.dayUtilPct >= 75 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                                : 'bg-[var(--bg-subtle)] border-[var(--border)] text-[var(--text-primary)]'
                            }`}>
                              <div className="font-mono-token font-bold text-xs">
                                {dd.dayPlannedHours}h / {dd.dayCapacity}h
                              </div>
                              <div className="text-[10px] text-[var(--text-muted)] font-medium mt-0.5">
                                {dd.dayTaskList.length} tasks scheduled
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Weekly Net */}
                    <td className="py-3 px-4 text-center font-mono-token font-extrabold text-indigo-500">
                      {item.totalPlannedHours}h / {item.effectiveTargetCapacity}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 3: WORKLOAD DISTRIBUTION CHARTS */}
      {viewMode === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Composed Chart: Planned vs Capacity */}
          <div className="lg:col-span-2 p-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                  Capacity vs. Planned Task Workload
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Comparison of available hours (net of PTO) vs. total task, story, and defect demand
                </p>
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} 
                    interval={0}
                  />
                  <YAxis 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    unit="h"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="capacity" name="Available Net Capacity (h)" fill="#6366F1" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="plannedTasks" name="Tasks (h)" stackId="a" fill="#3B82F6" />
                  <Bar dataKey="plannedStories" name="User Stories (h)" stackId="a" fill="#8B5CF6" />
                  <Bar dataKey="plannedDefects" name="Defects (h)" stackId="a" fill="#F43F5E" radius={[6, 6, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Utilization Distribution Gauge */}
          <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Utilization Distribution</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">Allocation health across the active roster</p>
            </div>

            <div className="space-y-3">
              {/* Overloaded */}
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">Overloaded (&gt;100%)</span>
                </div>
                <span className="font-mono-token font-extrabold text-rose-500 text-sm">
                  {teamAggregateMetrics.overloadedCount} members
                </span>
              </div>

              {/* Balanced */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">Balanced (75%–100%)</span>
                </div>
                <span className="font-mono-token font-extrabold text-emerald-500 text-sm">
                  {teamAggregateMetrics.balancedCount} members
                </span>
              </div>

              {/* Available */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">Available (&lt;75%)</span>
                </div>
                <span className="font-mono-token font-extrabold text-amber-500 text-sm">
                  {teamAggregateMetrics.availableCount} members
                </span>
              </div>
            </div>

            <div className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1">
              <span className="font-bold text-[var(--text-primary)] block">Sprint Tip:</span>
              <p>
                Keep individual member focus allocation between 75%–85% to preserve slack for bug triages and unexpected production hotfixes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: OVERRIDE MEMBER CAPACITY */}
      {capacityModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                Adjust Weekly Capacity for {capacityModalMember.name}
              </h3>
              <button
                onClick={() => setCapacityModalMember(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-[var(--text-secondary)] block mb-1">
                  Baseline Weekly Hours (Standard: 40h)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[40, 35, 32, 20].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setModalCapacityHours(h)}
                      className={`py-2 rounded-xl font-mono-token font-bold text-xs border transition-all cursor-pointer ${
                        modalCapacityHours === h
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--surface)]'
                      }`}
                    >
                      {h}h / wk
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-[var(--text-secondary)] block mb-1">Custom Hours Override</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={modalCapacityHours}
                  onChange={(e) => setModalCapacityHours(Math.max(1, parseInt(e.target.value) || 40))}
                  className="w-full p-2.5 text-xs bg-[var(--bg-subtle)] border border-[var(--border)] rounded-xl text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 font-mono-token"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setCapacityModalMember(null)}
                className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMemberCapacity}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Save Capacity
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: QUICK TASK REASSIGNMENT */}
      {reassignItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                Reassign Work Item ({reassignItem.hours} hrs)
              </h3>
              <button
                onClick={() => setReassignItem(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border)]">
                <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">{reassignItem.type}</span>
                <p className="font-extrabold text-[var(--text-primary)] text-xs mt-0.5">{reassignItem.title}</p>
                <span className="text-[11px] text-indigo-400 font-semibold mt-1 block">
                  Estimated Effort: {reassignItem.hours} hours
                </span>
              </div>

              <div>
                <label className="font-bold text-[var(--text-secondary)] block mb-1.5">
                  Select Teammate with Available Capacity:
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {memberAllocations
                    .filter(m => m.member.id !== reassignItem.currentAssigneeId)
                    .map(m => (
                      <button
                        key={m.member.id}
                        type="button"
                        onClick={() => setTargetReassignMemberId(m.member.id)}
                        className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                          targetReassignMemberId === m.member.id
                            ? 'bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]'
                        }`}
                      >
                        <div>
                          <span className="font-extrabold text-xs block">{m.member.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)]">{m.member.role}</span>
                        </div>
                        <div className="text-right font-mono-token text-xs">
                          <span className={m.deltaHours >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                            {m.deltaHours >= 0 ? `+${m.deltaHours}h free` : `${m.deltaHours}h load`}
                          </span>
                          <span className="block text-[10px] text-[var(--text-muted)]">{m.utilizationPct}% util</span>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setReassignItem(null)}
                className="px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReassign}
                disabled={!targetReassignMemberId}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
