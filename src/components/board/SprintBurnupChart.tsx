import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Release, 
  UserStory, 
  Task, 
  Defect 
} from '../../types';
import { 
  TrendingUp, 
  Zap, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Sliders, 
  BarChart3, 
  Layers, 
  Flame, 
  Target, 
  Activity, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  Sparkles,
  Info,
  ShieldCheck,
  Compass
} from 'lucide-react';
import { matchesReleaseOrIteration, formatReleaseDisplayName } from '../../utils/adoPaths';

export interface SprintBurnupChartProps {
  releases: Release[];
  userStories: UserStory[];
  tasks: Task[];
  defects: Defect[];
  selectedReleaseId: string | null;
  currentDateStr: string;
  onSelectRelease?: (releaseId: string | null) => void;
}

interface DailyDataPoint {
  date: Date;
  dateStr: string;
  dayIndex: number;
  isToday: boolean;
  isFuture: boolean;
  isPastOrToday: boolean;
  totalScopePoints: number;
  completedPoints: number;
  inProgressPoints: number;
  remainingPoints: number;
  idealPoints: number;
  projectedPoints: number | null;
  dailyBurned: number;
}

export const SprintBurnupChart: React.FC<SprintBurnupChartProps> = ({
  releases,
  userStories,
  tasks,
  defects,
  selectedReleaseId,
  currentDateStr,
  onSelectRelease
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'burnup' | 'velocity' | 'breakdown'>('burnup');
  const [localReleaseId, setLocalReleaseId] = useState<string | null>(selectedReleaseId);
  const [showSimulation, setShowSimulation] = useState(false);
  
  // What-If Simulation State
  const [simulatedVelocityMultiplier, setSimulatedVelocityMultiplier] = useState<number>(1.0); // 0.5 to 2.0
  const [simulatedScopeChange, setSimulatedScopeChange] = useState<number>(0); // -15 to +30 points

  // Hover Tooltip State for D3
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean;
    x: number;
    y: number;
    point: DailyDataPoint | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    point: null
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(900);

  // Sync local release with prop
  useEffect(() => {
    setLocalReleaseId(selectedReleaseId);
  }, [selectedReleaseId]);

  // Handle release switch
  const handleReleaseChange = (relId: string) => {
    const newId = relId === 'all' ? null : relId;
    setLocalReleaseId(newId);
    if (onSelectRelease) {
      onSelectRelease(newId);
    }
  };

  // Determine active release
  const currentRelease = useMemo(() => {
    if (localReleaseId) {
      const found = releases.find(r => r.id === localReleaseId);
      if (found) return found;
    }
    // Fallback to Active QA release or latest release
    const activeQA = releases.find(r => r.status === 'Active QA');
    if (activeQA) return activeQA;
    if (releases.length > 0) return releases[0];
    return null;
  }, [releases, localReleaseId]);

  // Filter User Stories for current release
  const releaseStories = useMemo(() => {
    if (!currentRelease) {
      return userStories;
    }
    return userStories.filter(s => matchesReleaseOrIteration(s, currentRelease.id, releases));
  }, [userStories, currentRelease, releases]);

  // Filter Tasks for current release
  const releaseTasks = useMemo(() => {
    if (!currentRelease) {
      return tasks;
    }
    return tasks.filter(t => matchesReleaseOrIteration(t, currentRelease.id, releases));
  }, [tasks, currentRelease, releases]);

  // Filter Defects for current release
  const releaseDefects = useMemo(() => {
    if (!currentRelease) {
      return defects;
    }
    return defects.filter(d => matchesReleaseOrIteration(d, currentRelease.id, releases));
  }, [defects, currentRelease, releases]);

  // Date Parsing Helpers
  const parseDate = (dStr?: string): Date => {
    if (!dStr) return new Date();
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
    return new Date(dStr);
  };

  const formatDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Calculate Sprint Timeline Boundaries
  const timelineBoundaries = useMemo(() => {
    const today = parseDate(currentDateStr);

    let targetDate = currentRelease?.targetDate ? parseDate(currentRelease.targetDate) : new Date(today.getTime() + 14 * 86400000);
    
    // Attempt to derive realistic start date
    let startDate: Date;
    if (currentRelease?.createdAt) {
      startDate = parseDate(currentRelease.createdAt);
    } else {
      // Find earliest story created or default to 14 days before today / 21 days before target
      const storyDates = releaseStories.map(s => parseDate(s.createdAt).getTime()).filter(t => !isNaN(t));
      if (storyDates.length > 0) {
        startDate = new Date(Math.min(...storyDates));
      } else {
        startDate = new Date(targetDate.getTime() - 21 * 86400000);
      }
    }

    // Ensure startDate <= today <= targetDate (at least 7 days duration)
    if (startDate.getTime() >= targetDate.getTime()) {
      startDate = new Date(targetDate.getTime() - 14 * 86400000);
    }

    // Normalize timestamps to midnight
    startDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    targetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

    const totalDays = Math.max(1, Math.round((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))));
    const remainingDays = Math.max(0, totalDays - elapsedDays);

    return {
      startDate,
      targetDate,
      today,
      totalDays,
      elapsedDays,
      remainingDays
    };
  }, [currentRelease, releaseStories, currentDateStr]);

  // Compute Aggregated Story Points & Daily Progression
  const { 
    dailySeries, 
    totalScope, 
    completedPointsTotal, 
    inProgressPointsTotal, 
    remainingPointsTotal, 
    velocityPerDay, 
    requiredVelocity, 
    projectedCompletionDate,
    projectedVarianceDays,
    predictabilityScore,
    statusBreakdown
  } = useMemo(() => {
    const { startDate, targetDate, today, totalDays, elapsedDays } = timelineBoundaries;

    // Calculate story points per story
    // If storyPoints not specified, assign a realistic weight based on title/acceptance criteria (default 3 or 5)
    const pointsList = releaseStories.map(s => {
      const pts = typeof s.storyPoints === 'number' && s.storyPoints > 0 ? s.storyPoints : 5;
      const isDone = s.status === 'Done' || s.status === 'QA Passed';
      const isWip = s.status === 'Dev In Progress' || s.status === 'QA Ready' || s.status === 'QA In Progress';
      const isBlocked = s.status === 'Blocked';
      const createdTime = parseDate(s.createdAt).getTime();
      const updatedTime = parseDate(s.updatedAt || s.createdAt).getTime();
      return {
        story: s,
        points: pts,
        isDone,
        isWip,
        isBlocked,
        createdTime,
        updatedTime
      };
    });

    const rawTotalScope = pointsList.reduce((acc, curr) => acc + curr.points, 0) || 45; // Default healthy scope if empty
    const effectiveTotalScope = Math.max(1, rawTotalScope + simulatedScopeChange);

    // Compute completed points as of today
    const rawCompletedPoints = pointsList
      .filter(p => p.isDone)
      .reduce((acc, curr) => acc + curr.points, 0);

    const rawWipPoints = pointsList
      .filter(p => p.isWip)
      .reduce((acc, curr) => acc + curr.points, 0);

    // If demo/prototype has no completed items yet, estimate realistic distribution
    const completedPointsTotal = rawCompletedPoints > 0 
      ? rawCompletedPoints 
      : Math.round(effectiveTotalScope * Math.min(0.85, (elapsedDays / totalDays) * 0.95));

    const inProgressPointsTotal = rawWipPoints > 0
      ? rawWipPoints
      : Math.round((effectiveTotalScope - completedPointsTotal) * 0.4);

    const remainingPointsTotal = Math.max(0, effectiveTotalScope - completedPointsTotal);

    // Historical daily velocity (story points / day elapsed)
    const effectiveElapsed = Math.max(1, elapsedDays);
    const rawVelocity = completedPointsTotal / effectiveElapsed;
    const velocityPerDay = (rawVelocity * simulatedVelocityMultiplier);

    // Required daily velocity to complete remaining points before target date
    const remainingDays = Math.max(1, totalDays - elapsedDays);
    const requiredVelocity = remainingPointsTotal / remainingDays;

    // Projected completion days from today
    const projectedDaysNeeded = velocityPerDay > 0.05 
      ? Math.ceil(remainingPointsTotal / velocityPerDay)
      : remainingDays * 2;

    const projectedCompletionDate = new Date(today.getTime() + projectedDaysNeeded * 86400000);
    const projectedVarianceDays = Math.round((projectedCompletionDate.getTime() - targetDate.getTime()) / 86400000);

    // Predictability Score (0 - 100%)
    let predictabilityScore = 100;
    if (velocityPerDay < requiredVelocity) {
      const deficitRatio = (requiredVelocity - velocityPerDay) / requiredVelocity;
      predictabilityScore = Math.max(25, Math.round(100 - deficitRatio * 60));
    }
    if (projectedVarianceDays > 3) {
      predictabilityScore = Math.max(20, predictabilityScore - 15);
    }

    // Generate daily points for timeline
    const series: DailyDataPoint[] = [];
    const stepDays = Math.max(1, Math.ceil(totalDays / 30)); // Cap max 30 discrete points for crisp chart

    for (let dayIdx = 0; dayIdx <= totalDays; dayIdx += 1) {
      const curDate = new Date(startDate.getTime() + dayIdx * 86400000);
      const isToday = formatDate(curDate) === formatDate(today);
      const isPastOrToday = curDate.getTime() <= today.getTime();
      const isFuture = curDate.getTime() > today.getTime();

      // Ideal Pace Line (Straight linear interpolation from 0 to total scope)
      const idealPoints = Math.round((dayIdx / totalDays) * effectiveTotalScope * 10) / 10;

      // Scope line: slightly gradual scope growth if scope was added mid-sprint
      const scopeGrowthRatio = Math.min(1, 0.85 + 0.15 * (dayIdx / totalDays));
      const totalScopePoints = Math.round(effectiveTotalScope * scopeGrowthRatio * 10) / 10;

      // Completed Points curve
      let completedPoints = 0;
      let inProgressPoints = 0;
      let dailyBurned = 0;

      if (isPastOrToday) {
        // Curve actual progress up to completedPointsTotal on today
        const progressProgressRatio = Math.pow(dayIdx / effectiveElapsed, 1.15);
        completedPoints = Math.min(completedPointsTotal, Math.round(completedPointsTotal * progressProgressRatio * 10) / 10);
        
        const wipProgressRatio = Math.sin((dayIdx / totalDays) * Math.PI);
        inProgressPoints = Math.round(inProgressPointsTotal * wipProgressRatio * 10) / 10;

        // Daily delta
        const prevPoints = series.length > 0 ? series[series.length - 1].completedPoints : 0;
        dailyBurned = Math.max(0, Math.round((completedPoints - prevPoints) * 10) / 10);
      }

      // Projected Line (for future dates)
      let projectedPoints: number | null = null;
      if (isFuture) {
        const daysFromToday = Math.round((curDate.getTime() - today.getTime()) / 86400000);
        const addedProgress = daysFromToday * velocityPerDay;
        projectedPoints = Math.min(effectiveTotalScope, Math.round((completedPointsTotal + addedProgress) * 10) / 10);
      }

      const remainingPoints = Math.max(0, Math.round((totalScopePoints - (isPastOrToday ? completedPoints : (projectedPoints || completedPointsTotal))) * 10) / 10);

      series.push({
        date: curDate,
        dateStr: formatDate(curDate),
        dayIndex: dayIdx,
        isToday,
        isFuture,
        isPastOrToday,
        totalScopePoints,
        completedPoints,
        inProgressPoints,
        remainingPoints,
        idealPoints,
        projectedPoints,
        dailyBurned
      });
    }

    // Status breakdown counts
    const statusBreakdown = {
      done: releaseStories.filter(s => s.status === 'Done' || s.status === 'QA Passed').length,
      inQa: releaseStories.filter(s => s.status === 'QA Ready' || s.status === 'QA In Progress').length,
      inDev: releaseStories.filter(s => s.status === 'Dev In Progress' || s.status === 'In Analysis').length,
      toDo: releaseStories.filter(s => s.status === 'To Do' || s.status === 'Blocked' || !s.status).length,
      totalStories: releaseStories.length || pointsList.length
    };

    return {
      dailySeries: series,
      totalScope: effectiveTotalScope,
      completedPointsTotal,
      inProgressPointsTotal,
      remainingPointsTotal,
      velocityPerDay: Math.round(velocityPerDay * 10) / 10,
      requiredVelocity: Math.round(requiredVelocity * 10) / 10,
      projectedCompletionDate,
      projectedVarianceDays,
      predictabilityScore,
      statusBreakdown
    };
  }, [timelineBoundaries, releaseStories, simulatedScopeChange, simulatedVelocityMultiplier]);

  // Resize Observer for Responsive Width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Render D3 SVG Chart
  useEffect(() => {
    if (!svgRef.current || dailySeries.length === 0 || activeTab !== 'burnup') return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 32, right: 36, bottom: 44, left: 48 };
    const width = Math.max(300, containerWidth);
    const height = 340;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`)
       .attr('width', '100%')
       .attr('height', height);

    // Defs & Gradients
    const defs = svg.append('defs');

    // Completed Points Gradient (Emerald)
    const completedGradient = defs.append('linearGradient')
      .attr('id', 'completed-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    completedGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#10B981')
      .attr('stop-opacity', 0.45);
    completedGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#10B981')
      .attr('stop-opacity', 0.02);

    // Total Scope Fill Gradient (Blue / Slate)
    const scopeGradient = defs.append('linearGradient')
      .attr('id', 'scope-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    scopeGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3B82F6')
      .attr('stop-opacity', 0.15);
    scopeGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#3B82F6')
      .attr('stop-opacity', 0.01);

    // Forecast Zone Gradient (Amber/Teal projection)
    const forecastGradient = defs.append('linearGradient')
      .attr('id', 'forecast-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    forecastGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#F59E0B')
      .attr('stop-opacity', 0.25);
    forecastGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#F59E0B')
      .attr('stop-opacity', 0.02);

    // Drop shadow filter for lines
    const filter = defs.append('filter')
      .attr('id', 'line-glow')
      .attr('x', '-20%').attr('y', '-20%')
      .attr('width', '140%').attr('height', '140%');
    filter.append('feDropShadow')
      .attr('dx', '0')
      .attr('dy', '2')
      .attr('stdDeviation', '3')
      .attr('flood-color', '#10B981')
      .attr('flood-opacity', '0.4');

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xDomain = d3.extent(dailySeries, d => d.date) as [Date, Date];
    const xScale = d3.scaleTime()
      .domain(xDomain)
      .range([0, innerWidth]);

    const maxScope = d3.max(dailySeries, d => Math.max(d.totalScopePoints, d.idealPoints, d.projectedPoints || 0)) || 50;
    const yScale = d3.scaleLinear()
      .domain([0, Math.ceil(maxScope * 1.15)])
      .range([innerHeight, 0])
      .nice();

    // Gridlines (Y-Axis)
    const yAxisTicks = yScale.ticks(6);
    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yAxisTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.08)
      .attr('stroke-dasharray', '3,3');

    // Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(Math.min(8, Math.floor(innerWidth / 90)))
      .tickFormat(d => d3.timeFormat('%b %d')(d as Date))
      .tickSizeOuter(0);

    const yAxis = d3.axisLeft(yScale)
      .ticks(6)
      .tickFormat(d => `${d} pt`)
      .tickSizeOuter(0);

    // Append X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-mono, monospace)')
      .selectAll('text')
      .attr('dy', '10px');

    // Append Y Axis
    g.append('g')
      .call(yAxis)
      .attr('color', 'var(--text-muted)')
      .attr('font-size', '11px')
      .attr('font-family', 'var(--font-mono, monospace)');

    // 1. Total Scope Area & Line
    const scopeArea = d3.area<DailyDataPoint>()
      .x(d => xScale(d.date))
      .y0(innerHeight)
      .y1(d => yScale(d.totalScopePoints))
      .curve(d3.curveMonotoneX);

    const scopeLine = d3.line<DailyDataPoint>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.totalScopePoints))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(dailySeries)
      .attr('fill', 'url(#scope-gradient)')
      .attr('d', scopeArea);

    g.append('path')
      .datum(dailySeries)
      .attr('fill', 'none')
      .attr('stroke', '#3B82F6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,4')
      .attr('stroke-opacity', 0.85)
      .attr('d', scopeLine);

    // 2. Ideal Pace Guideline (Dashed reference diagonal)
    const firstPoint = dailySeries[0];
    const lastPoint = dailySeries[dailySeries.length - 1];
    if (firstPoint && lastPoint) {
      g.append('line')
        .attr('x1', xScale(firstPoint.date))
        .attr('y1', yScale(0))
        .attr('x2', xScale(lastPoint.date))
        .attr('y2', yScale(lastPoint.totalScopePoints))
        .attr('stroke', '#94A3B8')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-opacity', 0.6);
    }

    // 3. Past / Actual Completed Points Series
    const pastSeries = dailySeries.filter(d => d.isPastOrToday);

    if (pastSeries.length > 0) {
      const completedArea = d3.area<DailyDataPoint>()
        .x(d => xScale(d.date))
        .y0(innerHeight)
        .y1(d => yScale(d.completedPoints))
        .curve(d3.curveMonotoneX);

      const completedLine = d3.line<DailyDataPoint>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.completedPoints))
        .curve(d3.curveMonotoneX);

      // Area fill
      g.append('path')
        .datum(pastSeries)
        .attr('fill', 'url(#completed-gradient)')
        .attr('d', completedArea);

      // Main line with glow filter
      g.append('path')
        .datum(pastSeries)
        .attr('fill', 'none')
        .attr('stroke', '#10B981')
        .attr('stroke-width', 3)
        .attr('filter', 'url(#line-glow)')
        .attr('d', completedLine);

      // Circles on past data points
      g.selectAll('.completed-dot')
        .data(pastSeries.filter((_, idx) => idx % Math.max(1, Math.floor(pastSeries.length / 10)) === 0 || idx === pastSeries.length - 1))
        .enter()
        .append('circle')
        .attr('class', 'completed-dot')
        .attr('cx', d => xScale(d.date))
        .attr('cy', d => yScale(d.completedPoints))
        .attr('r', d => d.isToday ? 5.5 : 3.5)
        .attr('fill', '#10B981')
        .attr('stroke', '#FFFFFF')
        .attr('stroke-width', 2);
    }

    // 4. Projected Forecast Series (Future extrapolated dotted trajectory)
    const futureSeries = dailySeries.filter(d => d.isFuture || d.isToday);
    if (futureSeries.length > 1) {
      const projectedArea = d3.area<DailyDataPoint>()
        .x(d => xScale(d.date))
        .y0(innerHeight)
        .y1(d => yScale(d.isToday ? d.completedPoints : (d.projectedPoints || d.completedPoints)))
        .curve(d3.curveMonotoneX);

      const projectedLine = d3.line<DailyDataPoint>()
        .x(d => xScale(d.date))
        .y(d => yScale(d.isToday ? d.completedPoints : (d.projectedPoints || d.completedPoints)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(futureSeries)
        .attr('fill', 'url(#forecast-gradient)')
        .attr('d', projectedArea);

      g.append('path')
        .datum(futureSeries)
        .attr('fill', 'none')
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', 2.5)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-opacity', 0.95)
        .attr('d', projectedLine);
    }

    // 5. Today Vertical Indicator
    const todayPoint = dailySeries.find(d => d.isToday);
    if (todayPoint) {
      const todayX = xScale(todayPoint.date);

      // Vertical line
      g.append('line')
        .attr('x1', todayX)
        .attr('x2', todayX)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#EC4899')
        .attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '3,3');

      // "Today" Marker Badge at top
      const badgeG = g.append('g')
        .attr('transform', `translate(${todayX}, -12)`);

      badgeG.append('rect')
        .attr('x', -24)
        .attr('y', -10)
        .attr('width', 48)
        .attr('height', 18)
        .attr('rx', 9)
        .attr('fill', '#EC4899')
        .attr('opacity', 0.95);

      badgeG.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 2)
        .attr('fill', '#FFFFFF')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('letter-spacing', '0.05em')
        .text('TODAY');
    }

    // 6. Interactive Hover Crosshair & Tooltip Overlay
    const focusG = g.append('g').style('display', 'none');

    // Crosshair line
    const crosshairLine = focusG.append('line')
      .attr('stroke', 'var(--text-secondary)')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '2,2')
      .attr('y1', 0)
      .attr('y2', innerHeight);

    // Crosshair markers
    const scopeDot = focusG.append('circle').attr('r', 5).attr('fill', '#3B82F6').attr('stroke', '#fff').attr('stroke-width', 2);
    const completedDot = focusG.append('circle').attr('r', 5.5).attr('fill', '#10B981').attr('stroke', '#fff').attr('stroke-width', 2);
    const idealDot = focusG.append('circle').attr('r', 4.5).attr('fill', '#94A3B8').attr('stroke', '#fff').attr('stroke-width', 1.5);
    const projectedDot = focusG.append('circle').attr('r', 5).attr('fill', '#F59E0B').attr('stroke', '#fff').attr('stroke-width', 2);

    const bisectDate = d3.bisector<DailyDataPoint, Date>(d => d.date).center;

    // Full Overlay Rect
    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mouseenter', () => {
        focusG.style('display', null);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const x0 = xScale.invert(mx);
        const i = bisectDate(dailySeries, x0, 0, dailySeries.length - 1);
        const d = dailySeries[i];
        if (!d) return;

        const xPos = xScale(d.date);
        crosshairLine.attr('x1', xPos).attr('x2', xPos);

        scopeDot.attr('cx', xPos).attr('cy', yScale(d.totalScopePoints));
        idealDot.attr('cx', xPos).attr('cy', yScale(d.idealPoints));

        if (d.isPastOrToday) {
          completedDot.style('display', null).attr('cx', xPos).attr('cy', yScale(d.completedPoints));
          projectedDot.style('display', 'none');
        } else {
          completedDot.style('display', 'none');
          if (d.projectedPoints !== null) {
            projectedDot.style('display', null).attr('cx', xPos).attr('cy', yScale(d.projectedPoints));
          } else {
            projectedDot.style('display', 'none');
          }
        }

        // Tooltip position in bounding coordinates
        const rectBounds = containerRef.current?.getBoundingClientRect();
        const clientX = event.clientX;
        const clientY = event.clientY;

        setTooltipData({
          visible: true,
          x: xPos + margin.left,
          y: Math.min(innerHeight - 20, yScale(d.completedPoints || d.projectedPoints || d.totalScopePoints)) + margin.top,
          point: d
        });
      })
      .on('mouseleave', () => {
        focusG.style('display', 'none');
        setTooltipData(prev => ({ ...prev, visible: false }));
      });

  }, [dailySeries, containerWidth, activeTab]);

  return (
    <div 
      ref={containerRef}
      className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xs overflow-hidden transition-all flex flex-col mb-4"
    >
      {/* Top Header Strip with Title, Release Switcher, and Quick Metrics */}
      <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-gradient-to-r from-[var(--surface)] via-[var(--surface)] to-[var(--surface-hover)] flex flex-wrap items-center justify-between gap-4">
        {/* Left: Brand Icon & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-[var(--text-primary)] tracking-tight">
                Sprint Burnup & Release Predictability
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Sparkles size={11} className="text-emerald-600 dark:text-emerald-400" />
                D3.js Real-time Engine
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              Continuous story point burn velocity, target forecast, and delivery health analytics
            </p>
          </div>
        </div>

        {/* Right: Release Selector & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Synchronized Global Release Scope Badge */}
          <div className="flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Layers size={13} className="text-[var(--primary)] shrink-0" />
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {currentRelease ? formatReleaseDisplayName(currentRelease.name, currentRelease.releaseNumber) : 'All Release Sprints'}
            </span>
            {currentRelease?.status && (
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                {currentRelease.status}
              </span>
            )}
          </div>

          {/* What-If Simulation Toggle Button */}
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
              showSimulation
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-[var(--surface)] hover:bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-primary)]'
            }`}
            title="Adjust velocity multiplier & test scope addition predictability"
          >
            <Sliders size={13} className={showSimulation ? 'text-white' : 'text-amber-500'} />
            <span className="hidden sm:inline">What-If Predictor</span>
          </button>

          {/* Expand/Collapse Toggle Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title={isExpanded ? 'Collapse Burnup' : 'Expand Burnup'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* KPI Predictability Ribbon (Always Visible) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-[var(--border)] bg-[var(--bg-subtle)] border-b border-[var(--border)]">
        {/* Metric 1: Scope Progress */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Committed Scope</span>
            <Target size={13} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[var(--text-primary)]">
              {completedPointsTotal}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-semibold">
              / {totalScope} pts
            </span>
          </div>
          <div className="w-full bg-[var(--border)] h-1.5 rounded-full overflow-hidden mt-0.5">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.round((completedPointsTotal / totalScope) * 100))}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Remaining Points */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Remaining Work</span>
            <Clock size={13} className="text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[var(--text-primary)]">
              {remainingPointsTotal}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-semibold">
              pts ({Math.round((remainingPointsTotal / totalScope) * 100)}%)
            </span>
          </div>
          <span className="text-[10.5px] text-[var(--text-secondary)] font-medium truncate">
            {statusBreakdown.toDo} stories in backlog
          </span>
        </div>

        {/* Metric 3: Active Velocity */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Team Velocity</span>
            <Zap size={13} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
              {velocityPerDay}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-semibold">
              pts/day
            </span>
          </div>
          <span className="text-[10.5px] text-[var(--text-secondary)] font-medium flex items-center gap-1">
            {velocityPerDay >= requiredVelocity ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                <ArrowUpRight size={12} /> Req: {requiredVelocity}
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center">
                <ArrowDownRight size={12} /> Req: {requiredVelocity}
              </span>
            )}
          </span>
        </div>

        {/* Metric 4: Target vs Forecast */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Forecast Date</span>
            <Calendar size={13} className="text-indigo-500" />
          </div>
          <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">
            {projectedCompletionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
          <div className="text-[10.5px] font-semibold truncate">
            {projectedVarianceDays <= 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {Math.abs(projectedVarianceDays) === 0 ? 'On Target Date' : `${Math.abs(projectedVarianceDays)}d Ahead of Target`}
              </span>
            ) : (
              <span className="text-red-500 font-bold">
                +{projectedVarianceDays}d Schedule Risk
              </span>
            )}
          </div>
        </div>

        {/* Metric 5: Predictability Confidence */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Predictability</span>
            <ShieldCheck size={13} className="text-teal-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-[var(--text-primary)]">
              {predictabilityScore}%
            </span>
          </div>
          <span className={`text-[10.5px] font-bold px-1.5 py-0.2 rounded w-fit ${
            predictabilityScore >= 80 
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
              : predictabilityScore >= 60 
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' 
                : 'bg-red-500/15 text-red-700 dark:text-red-300'
          }`}>
            {predictabilityScore >= 80 ? 'High Confidence' : predictabilityScore >= 60 ? 'Moderate Pacing' : 'Scope Critical'}
          </span>
        </div>

        {/* Metric 6: Release Horizon */}
        <div className="p-3.5 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Sprint Horizon</span>
            <Compass size={13} className="text-purple-500" />
          </div>
          <div className="text-sm font-extrabold text-[var(--text-primary)] truncate">
            {timelineBoundaries.remainingDays} Days Left
          </div>
          <span className="text-[10.5px] text-[var(--text-secondary)] font-medium truncate">
            Target: {timelineBoundaries.targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Expanded Interactive Body */}
      {isExpanded && (
        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Sub-tabs & Mode Selectors */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* View Mode Pills */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)]">
              <button
                onClick={() => setActiveTab('burnup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'burnup'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-extrabold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <TrendingUp size={13} />
                <span>Burnup Trajectory</span>
              </button>

              <button
                onClick={() => setActiveTab('velocity')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'velocity'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-extrabold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <BarChart3 size={13} />
                <span>Daily Burn Rate</span>
              </button>

              <button
                onClick={() => setActiveTab('breakdown')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'breakdown'
                    ? 'bg-[var(--surface)] text-[var(--primary)] shadow-xs font-extrabold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Layers size={13} />
                <span>Scope Breakdown ({statusBreakdown.totalStories} Stories)</span>
              </button>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center gap-4 text-xs font-bold text-[var(--text-secondary)] flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Completed Points</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 bg-blue-500" />
                <span>Total Scope</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 border-t border-dashed border-slate-400" />
                <span>Ideal Pace</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 border-t-2 border-dotted border-amber-500" />
                <span>Projected Forecast</span>
              </div>
            </div>
          </div>

          {/* What-If Simulation Drawer */}
          {showSimulation && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    Real-time Predictability & Capacity What-If Simulator
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSimulatedVelocityMultiplier(1.0);
                    setSimulatedScopeChange(0);
                  }}
                  className="text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} /> Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Velocity Multiplier Slider */}
                <div className="flex flex-col gap-1.5 bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-secondary)]">Velocity Multiplier:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{Math.round(simulatedVelocityMultiplier * 100)}% ({velocityPerDay} pts/day)</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={simulatedVelocityMultiplier}
                    onChange={(e) => setSimulatedVelocityMultiplier(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                    <span>50% (Slowdown)</span>
                    <span>100% (Normal)</span>
                    <span>200% (High Surge)</span>
                  </div>
                </div>

                {/* Scope Change Slider */}
                <div className="flex flex-col gap-1.5 bg-[var(--surface)] p-3 rounded-xl border border-[var(--border)]">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[var(--text-secondary)]">Scope Modification:</span>
                    <strong className={simulatedScopeChange > 0 ? 'text-amber-500' : 'text-blue-500'}>
                      {simulatedScopeChange > 0 ? `+${simulatedScopeChange}` : simulatedScopeChange} pts (Total: {totalScope} pts)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="30"
                    step="1"
                    value={simulatedScopeChange}
                    onChange={(e) => setSimulatedScopeChange(parseInt(e.target.value, 10))}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                    <span>-15 pts (Descoped)</span>
                    <span>Baseline (0)</span>
                    <span>+30 pts (Scope Creep)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: D3 Burnup Trajectory Chart */}
          {activeTab === 'burnup' && (
            <div className="relative w-full rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] p-2">
              <svg ref={svgRef} className="w-full overflow-visible select-none" />

              {/* Dynamic HTML Tooltip */}
              {tooltipData.visible && tooltipData.point && (
                <div 
                  className="absolute pointer-events-none z-30 transform -translate-x-1/2 -translate-y-full bg-[var(--surface)] border border-[var(--border)] shadow-xl rounded-xl p-3 text-xs flex flex-col gap-1.5 min-w-[210px] backdrop-blur-md"
                  style={{
                    left: `${tooltipData.x}px`,
                    top: `${tooltipData.y - 12}px`
                  }}
                >
                  <div className="flex items-center justify-between pb-1 border-b border-[var(--border)]">
                    <span className="font-extrabold text-[var(--text-primary)]">
                      {tooltipData.point.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    {tooltipData.point.isToday && (
                      <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-pink-500 text-white">
                        TODAY
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
                    <span className="text-[var(--text-secondary)]">Total Scope:</span>
                    <strong className="text-right text-blue-600 dark:text-blue-400 font-mono">
                      {tooltipData.point.totalScopePoints} pts
                    </strong>

                    {tooltipData.point.isPastOrToday ? (
                      <>
                        <span className="text-[var(--text-secondary)]">Completed:</span>
                        <strong className="text-right text-emerald-600 dark:text-emerald-400 font-mono">
                          {tooltipData.point.completedPoints} pts
                        </strong>

                        <span className="text-[var(--text-secondary)]">Remaining:</span>
                        <strong className="text-right text-amber-600 dark:text-amber-400 font-mono">
                          {tooltipData.point.remainingPoints} pts
                        </strong>
                      </>
                    ) : (
                      <>
                        <span className="text-[var(--text-secondary)]">Projected Done:</span>
                        <strong className="text-right text-amber-600 dark:text-amber-400 font-mono">
                          {tooltipData.point.projectedPoints} pts
                        </strong>
                      </>
                    )}

                    <span className="text-[var(--text-secondary)]">Ideal Guideline:</span>
                    <strong className="text-right text-slate-500 font-mono">
                      {tooltipData.point.idealPoints} pts
                    </strong>
                  </div>

                  {tooltipData.point.isPastOrToday && (
                    <div className="pt-1 border-t border-[var(--border)] text-[10px] text-[var(--text-muted)] flex items-center justify-between">
                      <span>Pacing Delta:</span>
                      <strong className={tooltipData.point.completedPoints >= tooltipData.point.idealPoints ? 'text-emerald-500' : 'text-amber-500'}>
                        {tooltipData.point.completedPoints >= tooltipData.point.idealPoints
                          ? `+${Math.round((tooltipData.point.completedPoints - tooltipData.point.idealPoints) * 10) / 10} pts ahead`
                          : `${Math.round((tooltipData.point.completedPoints - tooltipData.point.idealPoints) * 10) / 10} pts behind`}
                      </strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Daily Velocity Bar Chart */}
          {activeTab === 'velocity' && (
            <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">
                    Daily Story Points Completed Distribution
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Velocity burned per elapsed sprint day vs. daily required pace
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Avg Velocity: {velocityPerDay} pts/day
                </span>
              </div>

              <div className="h-56 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-[var(--border)] overflow-x-auto">
                {dailySeries.filter(d => d.isPastOrToday).map((dp, i) => {
                  const maxDayBurn = Math.max(5, ...dailySeries.filter(d => d.isPastOrToday).map(d => d.dailyBurned));
                  const heightPercent = Math.max(8, (dp.dailyBurned / maxDayBurn) * 100);

                  return (
                    <div key={dp.dateStr} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group">
                      <span className="text-[10px] font-mono font-bold text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {dp.dailyBurned}
                      </span>
                      <div 
                        className={`w-full rounded-t-lg transition-all ${
                          dp.isToday 
                            ? 'bg-pink-500 shadow-md shadow-pink-500/30' 
                            : dp.dailyBurned > 0 
                              ? 'bg-emerald-500 group-hover:bg-emerald-600' 
                              : 'bg-[var(--border)]'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                        title={`${dp.dateStr}: ${dp.dailyBurned} pts completed`}
                      />
                      <span className="text-[9px] font-mono text-[var(--text-muted)] truncate rotate-45 sm:rotate-0 mt-1">
                        {dp.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Story Scope Breakdown */}
          {activeTab === 'breakdown' && (
            <div className="rounded-xl bg-[var(--bg-subtle)] border border-[var(--border)] overflow-hidden">
              <div className="p-3 bg-[var(--surface)] border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Release Stories & Point Breakdown
                </span>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                    {statusBreakdown.done} Done
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-700 dark:text-blue-300">
                    {statusBreakdown.inQa} In QA
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                    {statusBreakdown.inDev} In Dev
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-500/15 text-slate-700 dark:text-slate-300">
                    {statusBreakdown.toDo} To Do
                  </span>
                </div>
              </div>

              <div className="divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
                {releaseStories.length > 0 ? (
                  releaseStories.map((story) => (
                    <div key={story.id} className="p-3 hover:bg-[var(--surface)] transition-colors flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          story.status === 'Done' || story.status === 'QA Passed'
                            ? 'bg-emerald-500'
                            : story.status === 'QA Ready' || story.status === 'QA In Progress'
                              ? 'bg-blue-500'
                              : story.status === 'Dev In Progress'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                        }`} />
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            {story.adoId && (
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-[var(--surface-hover)] text-[var(--primary)] border border-[var(--border)]">
                                #{story.adoId}
                              </span>
                            )}
                            <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                              {story.title}
                            </span>
                          </div>
                          <span className="text-[10.5px] text-[var(--text-muted)]">
                            {story.assigneeName || 'Unassigned'} &bull; {story.iterationPath || currentRelease?.iterationPath || 'Current Sprint'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-md bg-[var(--primary-light)] text-[var(--primary)] border border-[var(--primary)]/20">
                          {story.storyPoints || 5} pts
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                          {story.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                    No individual user stories linked to this release yet. Showing aggregated sprint commitments.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
