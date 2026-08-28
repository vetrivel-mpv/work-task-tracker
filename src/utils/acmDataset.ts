import { UserStory, TestCase, Defect, Task, Release, TeamMember } from '../types';
import { toDateStr } from './date';

export function getAcmPresetData(customToday?: string) {
  const todayStr = customToday || toDateStr(new Date());

  const releases: Release[] = [
    {
      id: 'rel-acm-d5',
      name: 'D5 R 2026.09',
      releaseNumber: 'v2026.09',
      targetDate: '2026-09-17',
      status: 'Active QA',
      description: 'AT&T Connection Manager Primary D5 Release - eSIM handover, FirstNet QoS, and IoT profile optimization.',
      iterationPath: 'ACM\\D5 R 2026.09',
      areaPath: 'ACM\\Delivery',
      createdAt: todayStr
    },
    {
      id: 'rel-acm-r08',
      name: 'R 2026.08 - Migration',
      releaseNumber: 'v2026.08',
      targetDate: '2026-08-20',
      status: 'Active QA',
      description: 'Core Protocol Stack Migration and Multi-carrier fallback resiliency.',
      iterationPath: 'ACM\\R 2026.08 - Migration',
      areaPath: 'ACM\\Delivery',
      createdAt: todayStr
    },
    {
      id: 'rel-acm-d6',
      name: 'D6 R 2026.10',
      releaseNumber: 'v2026.10',
      targetDate: '2026-10-31',
      status: 'Planning',
      description: 'Next-Gen 5G SA Slice orchestration and subscriber policy enforcement.',
      iterationPath: 'ACM\\D6 R 2026.10',
      areaPath: 'ACM\\Core',
      createdAt: todayStr
    },
    {
      id: 'rel-acm-d4',
      name: 'D4 R 2026.07',
      releaseNumber: 'v2026.07',
      targetDate: '2026-07-23',
      status: 'Deployed',
      description: 'Carrier APN auto-provisioning and legacy CDMA fallback deprecation.',
      iterationPath: 'ACM\\D4 R 2026.07',
      areaPath: 'ACM\\Delivery',
      createdAt: todayStr
    }
  ];

  const team: TeamMember[] = [
    {
      id: 'tm-marcus',
      name: 'Marcus Vance',
      role: 'Engineering Lead',
      email: 'marcus.vance@simetricwdh.com',
      avatarColor: '#4F46E5',
      groupIds: ['grp-core'],
      isMyTeam: true
    },
    {
      id: 'tm-priya',
      name: 'Priya Sharma',
      role: 'QA Engineer',
      email: 'priya.sharma@simetricwdh.com',
      avatarColor: '#059669',
      groupIds: ['grp-qa'],
      isMyTeam: true
    },
    {
      id: 'tm-david',
      name: 'David Chen',
      role: 'Engineer/Contributor',
      email: 'david.chen@simetricwdh.com',
      avatarColor: '#0284C7',
      groupIds: ['grp-core'],
      isMyTeam: true
    },
    {
      id: 'tm-elena',
      name: 'Elena Rostova',
      role: 'QA Engineer',
      email: 'elena.rostova@simetricwdh.com',
      avatarColor: '#D97706',
      groupIds: ['grp-qa'],
      isMyTeam: true
    },
    {
      id: 'tm-alex',
      name: 'Alex Rivera',
      role: 'Delivery/Release Manager',
      email: 'alex.rivera@simetricwdh.com',
      avatarColor: '#7C3AED',
      groupIds: ['grp-ops'],
      isMyTeam: true
    }
  ];

  const userStories: UserStory[] = [
    {
      id: 'story-84210',
      adoId: 84210,
      title: 'Seamless eSIM Profile Switching & Cellular Handshake Optimization',
      status: 'QA In Progress',
      storyPoints: 5,
      assigneeId: 'tm-marcus',
      assigneeName: 'Marcus Vance',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      releaseId: 'rel-acm-d5',
      description: 'Implement dynamic carrier eSIM profile provisioning with instant zero-loss packet buffering during switchover.',
      acceptanceCriteria: [
        'eSIM profile switch completes within 800ms under 5G SA signal.',
        'Zero TCP connection resets during active TLS session roaming.',
        'Telemetry event dispatched on carrier handshake completion.'
      ],
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'story-84215',
      adoId: 84215,
      title: 'FirstNet Emergency Priority Channel Protocol Gateway',
      status: 'QA Passed',
      storyPoints: 8,
      assigneeId: 'tm-david',
      assigneeName: 'David Chen',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      releaseId: 'rel-acm-d5',
      description: 'Enforce QCI-1 priority bandwidth allocation for FirstNet emergency responder network channels.',
      acceptanceCriteria: [
        'Preemption of commercial background traffic on high priority alert.',
        'Strict TLS 1.3 mutual auth on government emergency endpoints.',
        'Automated heartbeat check every 5 seconds.'
      ],
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'story-84222',
      adoId: 84222,
      title: 'Bandwidth Throttling Telemetry Reporting for Roaming Profiles',
      status: 'Dev In Progress',
      storyPoints: 5,
      assigneeId: 'tm-priya',
      assigneeName: 'Priya Sharma',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      releaseId: 'rel-acm-d5',
      description: 'Aggregate international roaming telemetry metrics and emit rate-limiting signals prior to subscriber cap overflow.',
      acceptanceCriteria: [
        'Stream metrics to ACM event bus with <2s latency.',
        'Support offline local cache buffer of 50MB telemetry.'
      ],
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'story-84230',
      adoId: 84230,
      title: '5G Standalone Core Slice Allocation for IoT Fleet Devices',
      status: 'QA Ready',
      storyPoints: 8,
      assigneeId: 'tm-david',
      assigneeName: 'David Chen',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      releaseId: 'rel-acm-d5',
      description: 'Provision dedicated network slicing profiles with custom APN parameters for high-density IoT device clusters.',
      acceptanceCriteria: [
        'Simultaneous registration of up to 10,000 IoT client endpoints.',
        'Low latency slice SLA verification (<15ms RTT).'
      ],
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'story-84245',
      adoId: 84245,
      title: 'OAuth 2.0 Token Revocation on Subscriber Plan Deactivation',
      status: 'QA In Progress',
      storyPoints: 3,
      assigneeId: 'tm-marcus',
      assigneeName: 'Marcus Vance',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      releaseId: 'rel-acm-d5',
      description: 'Immediately revoke active OAuth access and refresh tokens across all edge gateways upon subscriber deactivation webhook.',
      acceptanceCriteria: [
        'Edge token cache invalidated within 250ms of webhook arrival.',
        'Audit log entry emitted with subscriber ID and timestamp.'
      ],
      createdAt: todayStr,
      updatedAt: todayStr
    }
  ];

  const defects: Defect[] = [
    {
      id: 'defect-91024',
      adoId: 91024,
      title: 'eSIM failover timeout when transitioning between 5G SA and CBRS towers',
      severity: 'high',
      status: 'Active',
      assigneeId: 'tm-marcus',
      assigneeName: 'Marcus Vance',
      userStoryId: 'story-84210',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      description: 'Handover protocol hangs when CBRS signal degrades below threshold before 5G handshake completes.',
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'defect-91055',
      adoId: 91055,
      title: 'Intermittent null pointer in telemetry packet payload on low-signal retry',
      severity: 'medium',
      status: 'Fixed',
      assigneeId: 'tm-priya',
      assigneeName: 'Priya Sharma',
      userStoryId: 'story-84222',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      description: 'Missing guard on geo-coordinate field when modem GPS is temporarily unresponsive during signal drop.',
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'defect-91089',
      adoId: 91089,
      title: 'Authentication token header truncation under high concurrent SSL handshakes',
      severity: 'critical',
      status: 'Retest',
      assigneeId: 'tm-david',
      assigneeName: 'David Chen',
      userStoryId: 'story-84245',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      description: 'Buffer overflow in legacy header parser drops the last 8 bytes of bearer token during parallel client bursts.',
      createdAt: todayStr,
      updatedAt: todayStr
    }
  ];

  const testCases: TestCase[] = [
    {
      id: 'tc-7801',
      adoId: 7801,
      title: 'Verify automatic failover to LTE fallback when 5G signal drops below -110 dBm',
      status: 'Passed',
      priority: 'high',
      userStoryId: 'story-84210',
      releaseId: 'rel-acm-d5',
      assigneeId: 'tm-elena',
      assigneeName: 'Elena Rostova',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'tc-7802',
      adoId: 7802,
      title: 'Verify FirstNet priority packet tagging under saturated 5G cell congestion',
      status: 'Passed',
      priority: 'high',
      userStoryId: 'story-84215',
      releaseId: 'rel-acm-d5',
      assigneeId: 'tm-elena',
      assigneeName: 'Elena Rostova',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'tc-7803',
      adoId: 7803,
      title: 'Verify token refresh and graceful retry on 401 response from edge gateway',
      status: 'Failed',
      priority: 'high',
      userStoryId: 'story-84245',
      releaseId: 'rel-acm-d5',
      assigneeId: 'tm-priya',
      assigneeName: 'Priya Sharma',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'tc-7804',
      adoId: 7804,
      title: 'Verify IoT slice allocation throughput bounds under 500 simultaneous devices',
      status: 'In Progress',
      priority: 'medium',
      userStoryId: 'story-84230',
      releaseId: 'rel-acm-d5',
      assigneeId: 'tm-elena',
      assigneeName: 'Elena Rostova',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      createdAt: todayStr,
      updatedAt: todayStr
    },
    {
      id: 'tc-7805',
      adoId: 7805,
      title: 'Verify telemetry offline buffer persistence and flush on reconnect',
      status: 'Passed',
      priority: 'medium',
      userStoryId: 'story-84222',
      releaseId: 'rel-acm-d5',
      assigneeId: 'tm-priya',
      assigneeName: 'Priya Sharma',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      createdAt: todayStr,
      updatedAt: todayStr
    }
  ];

  const tasks: Task[] = [
    {
      id: 'tsk-101',
      title: 'Implement radio measurement report listener for 5G/CBRS switch trigger',
      assigneeIds: ['tm-marcus'],
      assigneeId: 'tm-marcus',
      assigneeName: 'Marcus Vance',
      groupIds: ['grp-core'],
      dateStr: todayStr,
      status: 'complete',
      priority: 'high',
      userStoryId: 'story-84210',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      ticketType: 'dev_activity',
      createdAt: todayStr
    },
    {
      id: 'tsk-102',
      title: 'Regression test automated failover matrix across simulated cell towers',
      assigneeIds: ['tm-elena'],
      assigneeId: 'tm-elena',
      assigneeName: 'Elena Rostova',
      groupIds: ['grp-qa'],
      dateStr: todayStr,
      status: 'pending',
      priority: 'high',
      userStoryId: 'story-84210',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      ticketType: 'test_run',
      createdAt: todayStr
    },
    {
      id: 'tsk-103',
      title: 'Implement FirstNet QCI priority queue dispatcher in gateway service',
      assigneeIds: ['tm-david'],
      assigneeId: 'tm-david',
      assigneeName: 'David Chen',
      groupIds: ['grp-core'],
      dateStr: todayStr,
      status: 'complete',
      priority: 'high',
      userStoryId: 'story-84215',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      ticketType: 'dev_activity',
      createdAt: todayStr
    },
    {
      id: 'tsk-104',
      title: 'Fix buffer allocation for concurrent SSL handshake bearer token parser',
      assigneeIds: ['tm-david'],
      assigneeId: 'tm-david',
      assigneeName: 'David Chen',
      groupIds: ['grp-core'],
      dateStr: todayStr,
      status: 'pending',
      priority: 'critical',
      defectId: 'defect-91089',
      userStoryId: 'story-84245',
      releaseId: 'rel-acm-d5',
      areaPath: 'ACM\\Delivery',
      iterationPath: 'ACM\\D5 R 2026.09',
      ticketType: 'dev_activity',
      createdAt: todayStr
    }
  ];

  return {
    releases,
    team,
    userStories,
    defects,
    testCases,
    tasks
  };
}
