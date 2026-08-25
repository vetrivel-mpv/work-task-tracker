import React, { useState } from 'react';
import { 
  AbsenceRecord, 
  AbsenceType, 
  AbsenceCategory, 
  AbsenceStatus, 
  TeamMember, 
  AppUser 
} from '../../types';
import { 
  Calendar, 
  Clock, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Search, 
  UserCheck, 
  UserX, 
  Sun, 
  Moon, 
  ShieldAlert, 
  Trash2, 
  Check, 
  X,
  Sparkles,
  Info,
  CalendarRange
} from 'lucide-react';
import { generateId, toDateStr, formatDisplayDate } from '../../utils/date';

interface AbsenceTrackerViewProps {
  team: TeamMember[];
  absences: AbsenceRecord[];
  currentDateStr: string;
  currentUser?: AppUser;
  onAddAbsence: (record: AbsenceRecord) => void;
  onUpdateAbsence: (record: AbsenceRecord) => void;
  onDeleteAbsence: (id: string) => void;
}

export const AbsenceTrackerView: React.FC<AbsenceTrackerViewProps> = ({
  team,
  absences = [],
  currentDateStr,
  currentUser,
  onAddAbsence,
  onUpdateAbsence,
  onDeleteAbsence
}) => {
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchMember, setSearchMember] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(currentDateStr);

  // Form state for creating new absence/permission
  const [formMemberId, setFormMemberId] = useState<string>(team[0]?.id || '');
  const [formDate, setFormDate] = useState<string>(currentDateStr);
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formType, setFormType] = useState<AbsenceType>('hourly_permission');
  const [formHours, setFormHours] = useState<number>(2);
  const [formTimeWindow, setFormTimeWindow] = useState<string>('10:00 AM - 12:00 PM');
  const [formCategory, setFormCategory] = useState<AbsenceCategory>('doctor_appointment');
  const [formReason, setFormReason] = useState<string>('');
  const [formImpactNotes, setFormImpactNotes] = useState<string>('');

  // Calculate Capacity for Selected Date
  const activeTeamMembers = team.filter(m => m.active !== false);
  const totalBaseHours = activeTeamMembers.length * 8; // 8 hours standard day

  const dayAbsences = absences.filter(a => {
    if (a.status === 'cancelled') return false;
    if (a.endDateStr && a.endDateStr >= a.dateStr) {
      return selectedDate >= a.dateStr && selectedDate <= a.endDateStr;
    }
    return a.dateStr === selectedDate;
  });

  let lostHours = 0;
  dayAbsences.forEach(a => {
    if (a.type === 'full_day') {
      lostHours += 8;
    } else if (a.type === 'half_day_morning' || a.type === 'half_day_afternoon') {
      lostHours += 4;
    } else if (a.type === 'hourly_permission') {
      lostHours += a.permissionHours || 2;
    }
  });

  const availableHours = Math.max(0, totalBaseHours - lostHours);
  const capacityPct = totalBaseHours > 0 ? Math.round((availableHours / totalBaseHours) * 100) : 100;

  // Filtered records
  const filteredAbsences = absences.filter(record => {
    if (filterType !== 'all' && record.type !== filterType) return false;
    if (filterStatus !== 'all' && record.status !== filterStatus) return false;
    if (searchMember && !record.memberName.toLowerCase().includes(searchMember.toLowerCase())) return false;
    return true;
  });

  const handleOpenNewModal = () => {
    setFormMemberId(team[0]?.id || '');
    setFormDate(selectedDate || currentDateStr);
    setFormEndDate('');
    setFormType('hourly_permission');
    setFormHours(2);
    setFormTimeWindow('10:00 AM - 12:00 PM');
    setFormCategory('doctor_appointment');
    setFormReason('');
    setFormImpactNotes('');
    setModalOpen(true);
  };

  const handleSaveAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    const targetMember = team.find(m => m.id === formMemberId);
    if (!targetMember || !formDate || !formReason.trim()) return;

    let timeWindowStr = formTimeWindow;
    if (formType === 'half_day_morning') {
      timeWindowStr = 'First Half (9:00 AM - 1:00 PM)';
    } else if (formType === 'half_day_afternoon') {
      timeWindowStr = 'Second Half (1:30 PM - 5:30 PM)';
    } else if (formType === 'full_day') {
      timeWindowStr = 'Full Work Day (8.0 Hours)';
    }

    const newRecord: AbsenceRecord = {
      id: generateId('abs'),
      memberId: targetMember.id,
      memberName: targetMember.name,
      memberEmail: targetMember.email,
      dateStr: formDate,
      endDateStr: formEndDate.trim() || undefined,
      type: formType,
      permissionHours: formType === 'hourly_permission' ? Number(formHours) : (formType.startsWith('half_day') ? 4 : 8),
      timeWindow: timeWindowStr,
      reason: formReason.trim(),
      category: formCategory,
      status: 'approved',
      impactNotes: formImpactNotes.trim() || undefined,
      approvedBy: currentUser?.name || 'Manager Approved',
      createdAt: new Date().toISOString()
    };

    onAddAbsence(newRecord);
    setModalOpen(false);
  };

  const getTypeBadge = (type: AbsenceType, hours?: number) => {
    switch (type) {
      case 'hourly_permission':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-200 dark:border-amber-800">
            <Clock size={13} className="text-amber-600 dark:text-amber-400" />
            {hours || 2}h Permission
          </span>
        );
      case 'half_day_morning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-sky-800">
            <Sun size={13} className="text-sky-600 dark:text-sky-400" />
            Morning Half-Day
          </span>
        );
      case 'half_day_afternoon':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
            <Moon size={13} className="text-indigo-600 dark:text-indigo-400" />
            Afternoon Half-Day
          </span>
        );
      case 'full_day':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-800">
            <UserX size={13} className="text-rose-600 dark:text-rose-400" />
            Full Day Leave
          </span>
        );
    }
  };

  const getStatusBadge = (status: AbsenceStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-semibold border border-amber-200 dark:border-amber-800">
            <Clock size={12} /> Pending Review
          </span>
        );
      case 'taken':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-medium">
            Availed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-[11px] line-through">
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Selected Day Capacity */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date Capacity</span>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{capacityPct}%</span>
              <span className="text-xs font-semibold text-slate-500">{availableHours}h / {totalBaseHours}h Avail</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  capacityPct >= 85 ? 'bg-emerald-500' : capacityPct >= 65 ? 'bg-amber-500' : 'bg-rose-500'
                }`}
                style={{ width: `${capacityPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Today Absences */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active On Leave</span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
              <UserX size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {dayAbsences.filter(a => a.type === 'full_day').length} <span className="text-xs font-normal text-slate-500">engineers</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Full-day planned PTO & sick leaves</p>
          </div>
        </div>

        {/* Card 3: Permissions & Half Days */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Partial / Permissions</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {dayAbsences.filter(a => a.type !== 'full_day').length} <span className="text-xs font-normal text-slate-500">logged</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">1-2h permissions & half-days</p>
          </div>
        </div>

        {/* Card 4: Total Logged Records */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">All-Time Records</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <CalendarRange size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{absences.length}</div>
            <p className="text-xs text-slate-500 mt-1">Total trackable attendance entries</p>
          </div>
        </div>
      </div>

      {/* Action Strip & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Member */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder="Search member..."
              value={searchMember}
              onChange={(e) => setSearchMember(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
          >
            <option value="all">All Absence Types</option>
            <option value="hourly_permission">Hourly Permissions (1-2h)</option>
            <option value="half_day_morning">Morning Half-Day (1st Half)</option>
            <option value="half_day_afternoon">Afternoon Half-Day (2nd Half)</option>
            <option value="full_day">Full Day Leaves (PTO/Sick)</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending Review</option>
            <option value="taken">Availed / Taken</option>
          </select>
        </div>

        {/* Log Permission/Absence Button */}
        <button
          id="btn-log-absence"
          onClick={handleOpenNewModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/20 transition-all active:scale-95 w-full sm:w-auto"
        >
          <Plus size={16} />
          Log Absence / Permission
        </button>
      </div>

      {/* Absences & Permissions List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Absence & Permission Logs</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold">
              {filteredAbsences.length}
            </span>
          </div>
          <span className="text-xs text-slate-400">Automatic Capacity Calculation & Standup Sync Enabled</span>
        </div>

        {filteredAbsences.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <UserCheck size={28} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Full Team Attendance</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              No absences or hourly permissions match the selected filter. Click "Log Absence / Permission" to record time off.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Team Member</th>
                  <th className="py-3 px-4">Type & Duration</th>
                  <th className="py-3 px-4">Date & Time Window</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAbsences.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-xs font-black text-slate-700 dark:text-slate-200 uppercase">
                          {record.memberName.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{record.memberName}</div>
                          {record.memberEmail && (
                            <div className="text-[11px] text-slate-400">{record.memberEmail}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {getTypeBadge(record.type, record.permissionHours)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatDisplayDate(record.dateStr)}
                        {record.endDateStr && record.endDateStr !== record.dateStr && ` to ${formatDisplayDate(record.endDateStr)}`}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> {record.timeWindow || 'Standard Day'}
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <div className="font-medium text-slate-700 dark:text-slate-300 truncate" title={record.reason}>
                        {record.reason}
                      </div>
                      {record.impactNotes && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          Note: {record.impactNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {record.status === 'pending' && (
                          <button
                            onClick={() => onUpdateAbsence({ ...record, status: 'approved' })}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                            title="Approve Permission"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteAbsence(record.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Absence & Permission Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Log Absence / Permission</h3>
                  <p className="text-xs text-slate-500">Record leave, half-day, or hourly permission</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAbsence} className="p-5 space-y-4 overflow-y-auto">
              {/* Member Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Team Member <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formMemberId}
                  onChange={(e) => setFormMemberId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role || 'Member'})</option>
                  ))}
                </select>
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Absence / Permission Type <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'hourly_permission', label: '🕒 Hour Permission', desc: '1 - 3 hours' },
                    { id: 'half_day_morning', label: '🌤️ Morning Half Day', desc: 'First Half (9-1)' },
                    { id: 'half_day_afternoon', label: '🌙 Afternoon Half Day', desc: 'Second Half (1:30-5:30)' },
                    { id: 'full_day', label: '🏖️ Full Day Leave', desc: 'Full Day (8 hrs)' }
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFormType(item.id as AbsenceType)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        formType === item.id 
                          ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 shadow-sm' 
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.label}</div>
                      <div className="text-[11px] text-slate-400">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hourly Permission Specific Fields */}
              {formType === 'hourly_permission' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 mb-1">
                      Duration (Hours)
                    </label>
                    <select
                      value={formHours}
                      onChange={(e) => setFormHours(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white"
                    >
                      <option value={0.5}>0.5 Hour (30 mins)</option>
                      <option value={1}>1.0 Hour</option>
                      <option value={1.5}>1.5 Hours</option>
                      <option value={2}>2.0 Hours</option>
                      <option value={2.5}>2.5 Hours</option>
                      <option value={3}>3.0 Hours</option>
                      <option value={4}>4.0 Hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 mb-1">
                      Time Window
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. 10:00 AM - 12:00 PM"
                      value={formTimeWindow}
                      onChange={(e) => setFormTimeWindow(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                {formType === 'full_day' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      End Date (Optional)
                    </label>
                    <input 
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      min={formDate}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as AbsenceCategory)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="doctor_appointment">🏥 Doctor / Medical Appointment</option>
                  <option value="personal_errand">🔑 Personal Errand / Emergency</option>
                  <option value="planned_pto">🏖️ Planned Vacation / PTO</option>
                  <option value="sick_leave">🤒 Sick Leave / Health</option>
                  <option value="wfh">🏠 Remote / Special WFH Permission</option>
                  <option value="other">📝 Other</option>
                </select>
              </div>

              {/* Reason Details */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason & Details <span className="text-rose-500">*</span>
                </label>
                <textarea 
                  rows={2}
                  placeholder="e.g. 2 hour permission for dentist appointment from 10am to 12pm."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Impact / Handover Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Task Coverage / Handover Note (Optional)
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Morning standup covered by Vetrivel, tasks on track"
                  value={formImpactNotes}
                  onChange={(e) => setFormImpactNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-md shadow-rose-500/20 transition-all active:scale-95"
                >
                  Record & Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
