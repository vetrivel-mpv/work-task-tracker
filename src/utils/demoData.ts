import { 
  Task, 
  TeamMember, 
  TeamGroup, 
  UserStory, 
  TestCase,
  Defect, 
  Release, 
  BlueprintItem, 
  AppSettings,
  DualAdoConfig
} from '../types';
import { shiftDate } from './date';

export const AVATAR_COLORS = [
  '#4F46E5', // Royal Indigo
  '#0284C7', // Ocean Blue
  '#D97706', // Amber
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#DB2777', // Pink
  '#DC2626', // Crimson
  '#2563EB', // Sapphire
];

export const INITIAL_BLUEPRINT: BlueprintItem[] = [
  { id: 'bp-1', time: '09:30', title: 'Daily Engineering Standup & Blocker Sync', priority: 'high', category: 'core' },
  { id: 'bp-2', time: '11:00', title: 'Deep Dev Work & Story Feature PRs', priority: 'high', category: 'core' },
  { id: 'bp-3', time: '14:00', title: 'Internal ADO Test Suite & Regression Verification', priority: 'high', category: 'qa' },
  { id: 'bp-4', time: '15:30', title: 'External ADO Customer Defect & OPS Ticket Triage', priority: 'high', category: 'ops' },
  { id: 'bp-5', time: '17:00', title: 'Async Sign-offs, Staging Deploy & Client Gate', priority: 'high', category: 'core' },
  { id: 'bp-6', time: '18:00', title: 'Release Notes & Delivery Pulse Broadcast', priority: 'medium', category: 'qa' }
];

export const INITIAL_TEAM: TeamMember[] = [
  { id: 'tm-1', name: 'Alex Rivera', role: 'Engineering Lead & Architect', email: 'alex.rivera@careflow.io', avatarColor: '#4F46E5', groupIds: ['grp-core', 'grp-arch'], active: true },
  { id: 'tm-2', name: 'Maya Patel', role: 'Staff QA Automation Engineer', email: 'maya.patel@careflow.io', avatarColor: '#7C3AED', groupIds: ['grp-qa'], active: true },
  { id: 'tm-3', name: 'David Kim', role: 'Lead Frontend Engineer', email: 'david.kim@careflow.io', avatarColor: '#0284C7', groupIds: ['grp-frontend'], active: true },
  { id: 'tm-4', name: 'Elena Rostova', role: 'Senior Backend Engineer', email: 'elena.rostova@careflow.io', avatarColor: '#D97706', groupIds: ['grp-backend'], active: true },
  { id: 'tm-5', name: 'Marcus Chen', role: 'Site Reliability & OPS Lead', email: 'marcus.chen@careflow.io', avatarColor: '#DC2626', groupIds: ['grp-devops', 'grp-ops'], active: true },
  { id: 'tm-6', name: 'Sarah Jenkins', role: 'Client Delivery & Release Manager', email: 'sarah.j@careflow.io', avatarColor: '#059669', groupIds: ['grp-pm'], active: true }
];

export const INITIAL_GROUPS: TeamGroup[] = [
  { id: 'grp-core', name: 'Core Pod', purpose: 'Platform architecture and sprint delivery', memberIds: ['tm-1', 'tm-3', 'tm-4'], color: '#4F46E5' },
  { id: 'grp-qa', name: 'QA & Test Engineering', purpose: 'Test plans, regression runs, and automated suites', memberIds: ['tm-2', 'tm-1'], color: '#7C3AED' },
  { id: 'grp-ops', name: 'Production & Customer OPS', purpose: 'External customer escalations and SLA incidents', memberIds: ['tm-5', 'tm-6'], color: '#DC2626' },
  { id: 'grp-frontend', name: 'Frontend Stream', purpose: 'Provider portal & telehealth UI components', memberIds: ['tm-3'], color: '#0284C7' },
  { id: 'grp-backend', name: 'Integrations & Services', purpose: 'FHIR pipeline & ADO synchronization', memberIds: ['tm-4', 'tm-5'], color: '#D97706' }
];

export const INITIAL_RELEASES: Release[] = [
  {
    id: 'rel-2026-q3-sprint24',
    name: 'Release 4.2 - Telehealth & EHR Connect',
    releaseNumber: 'v4.2.0',
    areaPath: 'CareFlow-Core\\EHR-Connect',
    targetDate: '2026-08-28',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    status: 'Active QA',
    description: 'Real-time FHIR clinical telemetry sync, provider scheduling calendar, and multi-tenant defect hardening.',
    scopeNotes: 'Zero critical blockers across internal QA and external customer defects required for Staging sign-off.',
    createdAt: '2026-08-10'
  },
  {
    id: 'rel-2026-q3-sprint25',
    name: 'Release 4.3 - Patient Payments & Invoicing',
    releaseNumber: 'v4.3.0',
    areaPath: 'CareFlow-Core\\Billing-Engine',
    targetDate: '2026-09-15',
    iterationPath: 'CareFlow-Core\\Sprint 25',
    status: 'Planning',
    description: 'Stripe settlement webhooks, insurance pre-authorization rules engine, and claims export.',
    scopeNotes: 'Architecture approved. Initial schema design underway in Internal ADO.',
    createdAt: '2026-08-18'
  },
  {
    id: 'rel-2026-q4-sprint27',
    name: 'Release 4.4 - AI Clinical Scribe & Portal',
    releaseNumber: 'v4.4.0',
    areaPath: 'CareFlow-Core\\Clinical-Portal',
    targetDate: '2026-10-10',
    iterationPath: 'CareFlow-Core\\Sprint 27',
    status: 'Planning',
    description: 'Real-time dictation, clinical SOAP summary generator, and EHR timeline embeds.',
    scopeNotes: 'Integrated with Gemini Flash model pipeline for HIPAA-safe audio transcriptions.',
    createdAt: '2026-08-19'
  },
  {
    id: 'rel-2026-q2-hotfix',
    name: 'Release 4.1.2 - Hotfix Patch',
    releaseNumber: 'v4.1.2',
    areaPath: 'CareFlow-Core\\EHR-Connect',
    targetDate: '2026-08-14',
    iterationPath: 'CareFlow-Core\\Hotfix-August',
    status: 'Deployed',
    description: 'Mitigation of Websocket memory leak and customer OPS token rotation.',
    scopeNotes: 'Shipped to US-East & EU-West production.',
    createdAt: '2026-08-12'
  }
];

export const INITIAL_STORIES: UserStory[] = [
  {
    id: 'us-101',
    title: 'Provider Clinical Schedule - Real-time Slot Availability',
    description: 'As a care coordinator, I want to view live appointment slots across network clinics so that double-booking is eliminated.',
    acceptanceCriteria: [
      'Appointments reflect timezone offsets with automatic DST handling',
      'Websocket pushes updates within 250ms of slot booking',
      'Fallback to polling if WS connection drops'
    ],
    status: 'QA In Progress',
    storyPoints: 8,
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Clinical-Portal',
    assigneeId: 'tm-3',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    groupIds: ['grp-frontend', 'grp-core'],
    sourceInstance: 'internal',
    testPlanRef: {
      suiteName: 'Telehealth Slot Engine Automated Suite',
      passedTests: 18,
      failedTests: 1,
      totalTests: 19,
      reportUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_testManagement/runs?runId=89410',
      lastRunAt: '2026-08-20 09:15',
      status: 'Running'
    },
    adoId: 44821,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44821',
    createdAt: '2026-08-11',
    updatedAt: '2026-08-19'
  },
  {
    id: 'us-102',
    title: 'FHIR HL7 v4 Patient Health Summary Ingestion Pipeline',
    description: 'As an EHR integrator, ingest real-time JSON FHIR bundles with cryptographic signature verification and schema mapping.',
    acceptanceCriteria: [
      'Validates Observation and DiagnosticReport resources strictly',
      'Quarantines malformed records with audit log alert',
      'Processes 5,000 records/min with <50MB RAM footprint'
    ],
    status: 'QA Ready',
    storyPoints: 13,
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\EHR-Connect',
    assigneeId: 'tm-4',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    groupIds: ['grp-backend'],
    sourceInstance: 'internal',
    testPlanRef: {
      suiteName: 'FHIR Ingestion Pipeline Integration Tests',
      passedTests: 24,
      failedTests: 0,
      totalTests: 24,
      reportUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_testManagement/runs?runId=89412',
      lastRunAt: '2026-08-20 08:45',
      status: 'Passed'
    },
    adoId: 44829,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44829',
    createdAt: '2026-08-12',
    updatedAt: '2026-08-20'
  },
  {
    id: 'us-103',
    title: 'Multi-Factor SMS & TOTP Authentication for Clinical Staff',
    description: 'Enforce HIPAA-compliant MFA verification on all administrative session logins.',
    acceptanceCriteria: [
      'TOTP QR generation with 60-second window grace',
      'Emergency recovery codes generation (10 single-use keys)',
      'Audit log recorded on every auth challenge event'
    ],
    status: 'QA Passed',
    storyPoints: 5,
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Security-Platform',
    assigneeId: 'tm-1',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    groupIds: ['grp-core'],
    sourceInstance: 'internal',
    testPlanRef: {
      suiteName: 'Auth & Security HIPAA Compliance Suite',
      passedTests: 14,
      failedTests: 0,
      totalTests: 14,
      reportUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_testManagement/runs?runId=89390',
      lastRunAt: '2026-08-19 16:30',
      status: 'Passed'
    },
    adoId: 44835,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44835',
    createdAt: '2026-08-10',
    updatedAt: '2026-08-18'
  },
  {
    id: 'us-104',
    title: 'Patient Prescription Auto-Refill Notification Engine',
    description: 'Automated push & SMS notifications 72 hours before chronic prescription expiration.',
    acceptanceCriteria: [
      'Respects patient opt-in / opt-out preferences',
      'Links directly to 1-click pharmacy refill approval screen'
    ],
    status: 'Dev In Progress',
    storyPoints: 5,
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Clinical-Portal',
    assigneeId: 'tm-3',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    groupIds: ['grp-frontend'],
    sourceInstance: 'internal',
    adoId: 44850,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44850',
    createdAt: '2026-08-15',
    updatedAt: '2026-08-19'
  }
];

export const INITIAL_TEST_CASES: TestCase[] = [
  {
    id: 'tc-101',
    title: 'TC-44901: Concurrent Provider Schedule Slot Booking Lock Verification',
    description: 'Verify PostgreSQL advisory locking and transactional isolation when two browser clients reserve the identical appointment slot simultaneously.',
    status: 'Design',
    executionStatus: 'Not Run',
    testType: 'Manual',
    priority: 'critical',
    userStoryId: 'us-101',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Clinical-Portal',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    assigneeId: 'tm-2',
    preconditions: 'Two care coordinator accounts logged into CareFlow in independent incognito sessions.',
    steps: [
      {
        id: 'step-101-1',
        stepNumber: 1,
        action: "Open Provider Dr. Emily Chen's calendar for August 28th in Session A and Session B.",
        expectedResult: 'Both sessions display 14:00 slot as available in green.',
        status: 'Not Run'
      },
      {
        id: 'step-101-2',
        stepNumber: 2,
        action: "Click 'Reserve Slot' for 14:00 simultaneously in both sessions within a 100ms window.",
        expectedResult: 'Session A receives 200 OK reservation confirmation toast; Session B receives 409 Conflict with slot taken notice.',
        status: 'Not Run'
      },
      {
        id: 'step-101-3',
        stepNumber: 3,
        action: 'Inspect database appointment table for slot record.',
        expectedResult: 'Exactly one booking record exists with valid lock timestamp; no duplicate rows created.',
        status: 'Not Run'
      }
    ],
    adoId: 44901,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44901',
    adoWorkItemType: 'Test Case',
    createdAt: '2026-08-19',
    updatedAt: '2026-08-20'
  },
  {
    id: 'tc-102',
    title: 'TC-44902: FHIR HL7 v4 Observation & DiagnosticReport JSON Schema Validation',
    description: 'Automated integration suite validating strict conformance of FHIR JSON payloads, empty arrays handling, and quarantine routing.',
    status: 'Ready',
    executionStatus: 'Passed',
    testType: 'Automated',
    priority: 'high',
    userStoryId: 'us-102',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\EHR-Connect',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    assigneeId: 'tm-2',
    preconditions: 'FHIR test harness runner deployed to QA cluster with mock Hospital Epic gateway.',
    steps: [
      {
        id: 'step-102-1',
        stepNumber: 1,
        action: 'POST /api/v1/fhir/bundles with valid 100-record patient Observation bundle.',
        expectedResult: 'HTTP 201 Created returned; all 100 records parsed and indexed in <200ms.',
        status: 'Passed'
      },
      {
        id: 'step-102-2',
        stepNumber: 2,
        action: 'POST bundle containing empty note array [] on DiagnosticReport resource.',
        expectedResult: 'HTTP 201 Created returned without NullPointerException or DTO crash.',
        status: 'Passed'
      },
      {
        id: 'step-102-3',
        stepNumber: 3,
        action: 'POST malformed telemetry bundle with invalid HL7 date timestamp format.',
        expectedResult: 'HTTP 422 Unprocessable Entity returned; record routed to dead-letter quarantine queue.',
        status: 'Passed'
      }
    ],
    adoId: 44902,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44902',
    adoWorkItemType: 'Test Case',
    createdAt: '2026-08-18',
    updatedAt: '2026-08-20',
    lastRunAt: '2026-08-20 08:45'
  },
  {
    id: 'tc-103',
    title: 'TC-44903: Multi-Factor Authentication TOTP Grace Period & Invalid Code Lockout',
    description: 'Verify 60-second grace window on valid TOTP codes and automated 15-minute brute-force lockout after 5 failed tries.',
    status: 'Automated',
    executionStatus: 'Passed',
    testType: 'Automated',
    priority: 'high',
    userStoryId: 'us-103',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Security-Platform',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    assigneeId: 'tm-2',
    preconditions: 'Test clinical staff user provisioned with active TOTP secret.',
    steps: [
      {
        id: 'step-103-1',
        stepNumber: 1,
        action: 'Submit valid 6-digit TOTP code from authenticator app.',
        expectedResult: 'Authentication session token granted and dashboard loads.',
        status: 'Passed'
      },
      {
        id: 'step-103-2',
        stepNumber: 2,
        action: 'Submit expired TOTP code (within 60s grace period).',
        expectedResult: 'Login succeeds with audit log warning of clock drift grace.',
        status: 'Passed'
      },
      {
        id: 'step-103-3',
        stepNumber: 3,
        action: 'Submit 5 consecutive incorrect TOTP code attempts.',
        expectedResult: 'Account temporarily locked for 15 minutes; security email dispatched to user.',
        status: 'Passed'
      }
    ],
    adoId: 44903,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44903',
    adoWorkItemType: 'Test Case',
    createdAt: '2026-08-17',
    updatedAt: '2026-08-19',
    lastRunAt: '2026-08-19 16:30'
  },
  {
    id: 'tc-104',
    title: 'TC-44904: Patient Prescription Auto-Refill SMS Opt-Out Compliance',
    description: 'Ensure automated cron refill notices strictly honor patient communication opt-outs and STOP webhook callbacks.',
    status: 'Design',
    executionStatus: 'Not Run',
    testType: 'Manual',
    priority: 'medium',
    userStoryId: 'us-104',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Clinical-Portal',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    assigneeId: 'tm-2',
    preconditions: 'Patient chart created with active prescription expiring in 72 hours and opt-out preference set.',
    steps: [
      {
        id: 'step-104-1',
        stepNumber: 1,
        action: 'Trigger auto-refill notification batch worker.',
        expectedResult: 'Zero SMS dispatched to opted-out patient; audit record logged.',
        status: 'Not Run'
      },
      {
        id: 'step-104-2',
        stepNumber: 2,
        action: 'Simulate patient replying STOP to active SMS thread.',
        expectedResult: 'Inbound Twilio webhook marks optOut = true in database instantly.',
        status: 'Not Run'
      }
    ],
    adoId: 44904,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44904',
    adoWorkItemType: 'Test Case',
    createdAt: '2026-08-20',
    updatedAt: '2026-08-20'
  },
  {
    id: 'tc-105',
    title: 'TC-44905: Mount Sinai PDF Discharge 50-Page Batch Memory Stress Test',
    description: 'Stress test Puppeteer headless browser rendering on heavy discharge charts with 45+ embedded radiology scans.',
    status: 'Ready',
    executionStatus: 'Failed',
    testType: 'Performance',
    priority: 'critical',
    defectId: 'def-ext-801',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Ops\\Customer-Escalations',
    iterationPath: 'CareFlow-Ops\\Customer-Escalations',
    assigneeId: 'tm-2',
    preconditions: 'Mount Sinai clinical workspace with 50-page test patient discharge summary.',
    steps: [
      {
        id: 'step-105-1',
        stepNumber: 1,
        action: 'Trigger PDF export via /api/v1/export/pdf endpoint.',
        expectedResult: 'Export completes within 8.0 seconds with valid signed PDF artifact.',
        status: 'Failed',
        actualResult: 'Timed out at 30.0s with 504 Gateway Timeout due to Puppeteer heap exhaustion.'
      },
      {
        id: 'step-105-2',
        stepNumber: 2,
        action: 'Verify worker pod memory telemetry during export execution.',
        expectedResult: 'Memory consumption stays under 1.5GB threshold.',
        status: 'Failed',
        actualResult: 'Memory spiked to 2.1GB and triggered OOM container restart.'
      }
    ],
    adoId: 44905,
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/44905',
    adoWorkItemType: 'Test Case',
    createdAt: '2026-08-20',
    updatedAt: '2026-08-20',
    lastRunAt: '2026-08-20 07:45'
  }
];

export const INITIAL_DEFECTS: Defect[] = [
  // --- INTERNAL ADO DEFECTS (Dev / QA found) ---
  {
    id: 'def-int-301',
    title: 'Appointment slot double-book occurs on concurrent submit from two browser tabs',
    description: 'Race condition when two coordinators submit the exact same slot within 100ms interval.',
    stepsToReproduce: '1. Open two browser windows with same provider.\n2. Pick 14:00 slot in both.\n3. Click confirm simultaneously.\n4. Both receive success toast instead of 409 conflict.',
    severity: 'critical',
    status: 'Active',
    sourceInstance: 'internal',
    origin: 'internal_qa',
    userStoryId: 'us-101',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Clinical-Portal',
    assigneeId: 'tm-4',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    tags: ['Concurrency', 'Database', 'Internal-QA'],
    environment: 'QA',
    rootCause: 'Missing optimistic lock / Postgres SERIALIZABLE transaction isolation on booking table.',
    adoId: 48902,
    adoState: 'Active',
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/48902',
    createdAt: '2026-08-18',
    updatedAt: '2026-08-20'
  },
  {
    id: 'def-int-302',
    title: 'FHIR Parser throws NullPointerException on empty DiagnosticReport note array',
    description: 'Hospital Epic system sends empty note array [] which fails the schema unmarshaler.',
    stepsToReproduce: '1. POST /api/v1/fhir/bundles with sample Epic fixture payload.\n2. Observe 500 error in ingestion worker.',
    severity: 'high',
    status: 'Fixed',
    sourceInstance: 'internal',
    origin: 'internal_qa',
    userStoryId: 'us-102',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\EHR-Connect',
    assigneeId: 'tm-4',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    tags: ['FHIR', 'Backend', 'Internal-QA'],
    environment: 'QA',
    rootCause: 'Strict non-null assertion on optional note field in Kotlin DTO.',
    adoId: 48911,
    adoState: 'Resolved',
    adoUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_workitems/edit/48911',
    createdAt: '2026-08-17',
    updatedAt: '2026-08-19'
  },
  {
    id: 'def-int-303',
    title: 'TOTP recovery code print stylesheet truncates 9th and 10th emergency keys',
    description: 'CSS page break inside print media query cuts off bottom row on Letter paper format.',
    stepsToReproduce: '1. Navigate to MFA setup -> Emergency recovery keys.\n2. Press Ctrl+P / Print.\n3. Observe 2nd column clipped.',
    severity: 'low',
    status: 'Retest',
    sourceInstance: 'internal',
    origin: 'internal_qa',
    userStoryId: 'us-103',
    releaseId: 'rel-2026-q3-sprint24',
    areaPath: 'CareFlow-Core\\Security-Platform',
    assigneeId: 'tm-3',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    tags: ['Print', 'CSS', 'Internal-QA'],
    environment: 'Staging',
    adoId: 48930,
    adoState: 'Resolved',
    createdAt: '2026-08-18',
    updatedAt: '2026-08-20'
  },

  // --- EXTERNAL ADO DEFECTS (Customer Reported & OPS Tickets) ---
  {
    id: 'def-ext-801',
    title: 'Mount Sinai Clinic: Provider PDF discharge export failing with 504 Gateway Timeout',
    description: 'Large batch discharge summaries (>45 pages with radiology charts) timeout the PDF rendering microservice.',
    stepsToReproduce: '1. Log into Mount Sinai clinic workspace.\n2. Open patient chart #MS-98124.\n3. Request complete PDF export.\n4. Times out after 30s with 504 status.',
    severity: 'critical',
    status: 'Active',
    sourceInstance: 'external',
    origin: 'customer_reported',
    customerName: 'Mount Sinai Health Network',
    opsIncidentNumber: 'OPS-9482',
    slaPriority: 'P1 - 4h Critical',
    slaDeadline: 'Today, 14:00 EDT',
    releaseId: 'rel-2026-q3-sprint24',
    assigneeId: 'tm-5',
    iterationPath: 'CareFlow-Ops\\Customer-Escalations',
    tags: ['Customer-Escalation', 'PDF-Worker', 'SLA-Breach-Risk'],
    environment: 'Prod',
    rootCause: 'Puppeteer headless browser instance exhausts heap memory during concurrent canvas rendering.',
    adoId: 91402,
    adoState: 'Active',
    adoUrl: 'https://dev.azure.com/healthtech-customer-ops/CareFlow-Customer-Support/_workitems/edit/91402',
    createdAt: '2026-08-20 07:15',
    updatedAt: '2026-08-20 08:30'
  },
  {
    id: 'def-ext-802',
    title: 'Mayo Regional: SMS 2FA verification codes delayed by 8-12 minutes on Verizon network',
    description: 'Twilio downstream carrier routing bottleneck causing clinical staff login delays at Midwest regional clinics.',
    stepsToReproduce: '1. Initiate MFA login on Verizon mobile device.\n2. SMS delivers past the 5-minute verification token TTL.',
    severity: 'high',
    status: 'Active',
    sourceInstance: 'external',
    origin: 'customer_reported',
    customerName: 'Mayo Regional Health System',
    opsIncidentNumber: 'OPS-9475',
    slaPriority: 'P2 - 24h Major',
    slaDeadline: 'Tomorrow, 10:00 EDT',
    releaseId: 'rel-2026-q3-sprint24',
    assigneeId: 'tm-5',
    iterationPath: 'CareFlow-Ops\\Customer-Escalations',
    tags: ['Customer-Escalation', 'SMS-Carrier', 'OPS'],
    environment: 'Prod',
    rootCause: 'Carrier shortcode routing quota exceeded; failover to secondary AWS SNS pool required.',
    adoId: 91388,
    adoState: 'Investigating',
    adoUrl: 'https://dev.azure.com/healthtech-customer-ops/CareFlow-Customer-Support/_workitems/edit/91388',
    createdAt: '2026-08-19 18:20',
    updatedAt: '2026-08-20 08:00'
  },
  {
    id: 'def-ext-803',
    title: 'OPS Incident: Azure Blob Storage webhook delivery intermittent 403 authorization',
    description: 'Telemetry logs show rotated SAS token renewal race condition during automated container scale-up.',
    stepsToReproduce: '1. Monitor /var/log/ops-sync-pipeline.\n2. Check Azure Blob authorization headers during HPA scale events.',
    severity: 'high',
    status: 'Fixed',
    sourceInstance: 'external',
    origin: 'ops_incident',
    customerName: 'Production Cloud Cluster',
    opsIncidentNumber: 'OPS-9460',
    slaPriority: 'P2 - 24h Major',
    releaseId: 'rel-2026-q3-sprint24',
    assigneeId: 'tm-5',
    iterationPath: 'CareFlow-Ops\\Infra-Tickets',
    tags: ['OPS', 'Azure-Blob', 'Infrastructure'],
    environment: 'Prod',
    rootCause: 'Managed Identity caching race during rapid container pod creation.',
    adoId: 91350,
    adoState: 'Resolved',
    adoUrl: 'https://dev.azure.com/healthtech-customer-ops/CareFlow-Customer-Support/_workitems/edit/91350',
    createdAt: '2026-08-19 11:00',
    updatedAt: '2026-08-19 22:30'
  }
];

export const INITIAL_DUAL_ADO_CONFIG: DualAdoConfig = {
  internal: {
    id: 'internal',
    name: 'Internal Dev ADO (CareFlow Core)',
    role: 'internal',
    organization: 'careflow-dev-core',
    project: 'CareFlow-Core-EHR',
    pat: '••••••••••••••••••••••••',
    areaPath: 'CareFlow-Core\\EHR-Connect',
    iterationPath: 'CareFlow-Core\\Sprint 24',
    connected: true,
    lastSyncAt: '2026-08-20 09:15',
    features: {
      devActivities: true,
      userStories: true,
      internalDefects: true,
      testPlansAndReports: true,
      customerDefects: false,
      opsTickets: false
    },
    testPlanSettings: {
      testPlanName: 'Sprint 24 Comprehensive QA Plan',
      testSuite: 'Telehealth & Clinical Pipeline',
      automatedRunsEnabled: true,
      lastReportUrl: 'https://dev.azure.com/careflow-dev-core/CareFlow-Core-EHR/_testManagement/runs',
      passedTests: 56,
      failedTests: 1,
      totalTests: 57
    }
  },
  external: {
    id: 'external',
    name: 'External Customer & OPS ADO',
    role: 'external',
    organization: 'healthtech-customer-ops',
    project: 'CareFlow-Customer-Support',
    pat: '••••••••••••••••••••••••',
    areaPath: 'CareFlow-Ops\\Customer-Escalations',
    iterationPath: 'CareFlow-Ops\\Active-Incidents',
    connected: true,
    lastSyncAt: '2026-08-20 08:30',
    features: {
      devActivities: false,
      userStories: false,
      internalDefects: false,
      testPlansAndReports: false,
      customerDefects: true,
      opsTickets: true
    }
  },
  syncMode: 'auto',
  lastGlobalSyncAt: '2026-08-20 09:15'
};

export const getInitialTasks = (todayStr: string): Task[] => {
  const d0 = todayStr;
  const d1 = shiftDate(todayStr, -1);
  const d2 = shiftDate(todayStr, -2);
  const d3 = shiftDate(todayStr, -3);
  const d4 = shiftDate(todayStr, -4);
  const d5 = shiftDate(todayStr, -5);
  const d6 = shiftDate(todayStr, -6);

  return [
    // --- Today (Day 0) ---
    {
      id: 'tsk-1',
      title: 'Daily Engineering Standup & Blocker Sync',
      time: '09:30',
      dueDate: d0,
      priority: 'high',
      status: 'complete',
      dateStr: d0,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-1', 'tm-2', 'tm-3', 'tm-4', 'tm-5', 'tm-6'],
      groupIds: ['grp-core'],
      createdAt: d0,
      completedAt: `${d0} 10:00`
    },
    {
      id: 'tsk-2',
      title: '⚡ Triage Mount Sinai P1 PDF Timeout (EXT ADO #91402)',
      time: '11:00',
      dueDate: shiftDate(d0, -1),
      priority: 'critical',
      status: 'partial',
      dateStr: d0,
      sourceInstance: 'external',
      ticketType: 'customer_defect',
      assigneeIds: ['tm-5', 'tm-4'],
      groupIds: ['grp-ops', 'grp-backend'],
      defectId: 'def-ext-801',
      releaseId: 'rel-2026-q3-sprint24',
      comments: [
        { id: 'c-1', author: 'Marcus Chen', text: 'Allocated 2GB dedicated heap to Puppeteer pool in US-East cluster. Running load test.', createdAt: '11:45' }
      ],
      createdAt: d0
    },
    {
      id: 'tsk-3',
      title: 'Fix DEF-301: Postgres Advisory Lock on Slot Booking (INT ADO #48902)',
      time: '13:00',
      dueDate: shiftDate(d0, -1),
      priority: 'high',
      status: 'complete',
      dateStr: d0,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-4', 'tm-1'],
      groupIds: ['grp-backend'],
      userStoryId: 'us-101',
      defectId: 'def-int-301',
      releaseId: 'rel-2026-q3-sprint24',
      comments: [
        { id: 'c-2', author: 'Elena Rostova', text: 'Advisory lock logic PR merged. Passed 50 concurrent thread stress testing.', createdAt: '14:15' }
      ],
      createdAt: d0,
      completedAt: `${d0} 14:30`
    },
    {
      id: 'tsk-4',
      title: 'Run Internal ADO Test Suite & Regression Verification (57 Tests)',
      time: '15:00',
      dueDate: d0,
      priority: 'high',
      status: 'pending',
      dateStr: d0,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-2'],
      groupIds: ['grp-qa'],
      releaseId: 'rel-2026-q3-sprint24',
      dependsOnTaskIds: ['tsk-2', 'tsk-3'],
      createdAt: d0
    },
    {
      id: 'tsk-5',
      title: 'OPS Review: Failover Mayo SMS 2FA to Secondary AWS SNS Pool (EXT ADO #91388)',
      time: '16:30',
      dueDate: shiftDate(d0, -2),
      priority: 'medium',
      status: 'pending',
      dateStr: d0,
      sourceInstance: 'external',
      ticketType: 'ops_ticket',
      assigneeIds: ['tm-5'],
      groupIds: ['grp-ops'],
      defectId: 'def-ext-802',
      releaseId: 'rel-2026-q3-sprint24',
      dependsOnTaskIds: ['tsk-2'],
      createdAt: d0
    },
    {
      id: 'tsk-6',
      title: 'Review US-102 FHIR Ingestion Sign-off with Clinical Ops Lead',
      time: '17:45',
      dueDate: shiftDate(d0, 2),
      priority: 'medium',
      status: 'pending',
      dateStr: d0,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-1', 'tm-6'],
      groupIds: ['grp-core'],
      userStoryId: 'us-102',
      releaseId: 'rel-2026-q3-sprint24',
      dependsOnTaskIds: ['tsk-4'],
      createdAt: d0
    },
    {
      id: 'tsk-7',
      title: 'Update Storybook UI typography tokens & dark theme contrast',
      time: '14:30',
      dueDate: shiftDate(d0, 1),
      priority: 'low',
      status: 'pending',
      dateStr: d0,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-3'],
      groupIds: ['grp-frontend'],
      createdAt: d0
    },
    {
      id: 'tsk-8',
      title: 'Housekeeping: Archive deprecated v2 FHIR webhook listener endpoints',
      time: '16:00',
      dueDate: d0,
      priority: 'low',
      status: 'complete',
      dateStr: d0,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: [],
      groupIds: ['grp-backend'],
      createdAt: d0,
      completedAt: `${d0} 16:30`
    },

    // --- Day -1 ---
    {
      id: 'tsk-h1-1',
      title: 'Implement TOTP QR Verification Modal in Provider UI',
      time: '10:00',
      priority: 'high',
      status: 'complete',
      dateStr: d1,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-3'],
      groupIds: ['grp-frontend'],
      userStoryId: 'us-103',
      createdAt: d1,
      completedAt: `${d1} 16:30`
    },
    {
      id: 'tsk-h1-2',
      title: 'FHIR JSON Parser streaming memory leak hotfix',
      time: '11:30',
      priority: 'high',
      status: 'complete',
      dateStr: d1,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-4', 'tm-1'],
      groupIds: ['grp-backend'],
      userStoryId: 'us-102',
      createdAt: d1,
      completedAt: `${d1} 15:00`
    },
    {
      id: 'tsk-h1-3',
      title: 'Automated regression test suite execution (Sprint 24 Pass 1)',
      time: '14:00',
      priority: 'high',
      status: 'complete',
      dateStr: d1,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-2'],
      groupIds: ['grp-qa'],
      createdAt: d1,
      completedAt: `${d1} 17:15`
    },
    {
      id: 'tsk-h1-4',
      title: 'Azure Blob token rotation incident triage (OPS-9460)',
      time: '15:30',
      priority: 'high',
      status: 'complete',
      dateStr: d1,
      sourceInstance: 'external',
      ticketType: 'ops_ticket',
      assigneeIds: ['tm-5'],
      groupIds: ['grp-ops'],
      createdAt: d1,
      completedAt: `${d1} 18:00`
    },
    {
      id: 'tsk-h1-5',
      title: 'Client release scope sign-off with Mount Sinai stakeholders',
      time: '16:30',
      priority: 'medium',
      status: 'complete',
      dateStr: d1,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-6', 'tm-1'],
      groupIds: ['grp-pm'],
      createdAt: d1,
      completedAt: `${d1} 17:30`
    },

    // --- Day -2 ---
    {
      id: 'tsk-h2-1',
      title: 'Sprint 24 Architecture RFC Review & API Contract approval',
      time: '10:00',
      priority: 'high',
      status: 'complete',
      dateStr: d2,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-1', 'tm-4'],
      groupIds: ['grp-core'],
      createdAt: d2,
      completedAt: `${d2} 12:00`
    },
    {
      id: 'tsk-h2-2',
      title: 'Telehealth slot engine Cypress integration test harness',
      time: '11:00',
      priority: 'high',
      status: 'complete',
      dateStr: d2,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-2', 'tm-3'],
      groupIds: ['grp-qa'],
      createdAt: d2,
      completedAt: `${d2} 16:45`
    },
    {
      id: 'tsk-h2-3',
      title: 'Telehealth React Calendar Drag & Drop slot booking',
      time: '13:30',
      priority: 'high',
      status: 'complete',
      dateStr: d2,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-3'],
      groupIds: ['grp-frontend'],
      createdAt: d2,
      completedAt: `${d2} 18:00`
    },
    {
      id: 'tsk-h2-4',
      title: 'Kubernetes production node pool autoscaling configuration',
      time: '15:00',
      priority: 'medium',
      status: 'complete',
      dateStr: d2,
      sourceInstance: 'internal',
      ticketType: 'ops_ticket',
      assigneeIds: ['tm-5'],
      groupIds: ['grp-ops'],
      createdAt: d2,
      completedAt: `${d2} 17:00`
    },
    {
      id: 'tsk-h2-5',
      title: 'Database connection pool optimization for FHIR ingestion',
      time: '16:00',
      priority: 'high',
      status: 'complete',
      dateStr: d2,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-4'],
      groupIds: ['grp-backend'],
      createdAt: d2,
      completedAt: `${d2} 18:30`
    },

    // --- Day -3 ---
    {
      id: 'tsk-h3-1',
      title: 'EHR Patient demographics schema migration in PostgreSQL',
      time: '09:30',
      priority: 'high',
      status: 'complete',
      dateStr: d3,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-4', 'tm-1'],
      groupIds: ['grp-backend'],
      createdAt: d3,
      completedAt: `${d3} 13:00`
    },
    {
      id: 'tsk-h3-2',
      title: 'Sanity verify DEF-INT-302 print stylesheet resolution',
      time: '11:00',
      priority: 'medium',
      status: 'complete',
      dateStr: d3,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-3'],
      groupIds: ['grp-frontend'],
      createdAt: d3,
      completedAt: `${d3} 14:00`
    },
    {
      id: 'tsk-h3-3',
      title: 'Automated security scan & dependency audit (Snyk/Trivy)',
      time: '14:00',
      priority: 'high',
      status: 'complete',
      dateStr: d3,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-2', 'tm-5'],
      groupIds: ['grp-qa'],
      createdAt: d3,
      completedAt: `${d3} 16:30`
    },
    {
      id: 'tsk-h3-4',
      title: 'Sprint 24 release risk matrix & stakeholder briefing',
      time: '16:00',
      priority: 'medium',
      status: 'complete',
      dateStr: d3,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-6'],
      groupIds: ['grp-pm'],
      createdAt: d3,
      completedAt: `${d3} 17:30`
    },

    // --- Day -4 ---
    {
      id: 'tsk-h4-1',
      title: 'Websocket connection heartbeat & auto-reconnect fallback',
      time: '10:00',
      priority: 'high',
      status: 'complete',
      dateStr: d4,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-3', 'tm-1'],
      groupIds: ['grp-frontend'],
      createdAt: d4,
      completedAt: `${d4} 15:30`
    },
    {
      id: 'tsk-h4-2',
      title: 'FHIR Observation resource validation rules test suite',
      time: '11:30',
      priority: 'high',
      status: 'complete',
      dateStr: d4,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-2'],
      groupIds: ['grp-qa'],
      createdAt: d4,
      completedAt: `${d4} 16:00`
    },
    {
      id: 'tsk-h4-3',
      title: 'Production SSL certificate rotation & monitoring verify',
      time: '14:00',
      priority: 'high',
      status: 'complete',
      dateStr: d4,
      sourceInstance: 'internal',
      ticketType: 'ops_ticket',
      assigneeIds: ['tm-5'],
      groupIds: ['grp-ops'],
      createdAt: d4,
      completedAt: `${d4} 15:45`
    },
    {
      id: 'tsk-h4-4',
      title: 'Async queue backpressure handling with Redis Streams',
      time: '15:30',
      priority: 'high',
      status: 'complete',
      dateStr: d4,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-4'],
      groupIds: ['grp-backend'],
      createdAt: d4,
      completedAt: `${d4} 18:00`
    },

    // --- Day -5 ---
    {
      id: 'tsk-h5-1',
      title: 'Lead sprint refinement & story point estimations for Sprint 24',
      time: '09:30',
      priority: 'high',
      status: 'complete',
      dateStr: d5,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-1', 'tm-2', 'tm-3', 'tm-4', 'tm-5', 'tm-6'],
      groupIds: ['grp-core'],
      createdAt: d5,
      completedAt: `${d5} 12:00`
    },
    {
      id: 'tsk-h5-2',
      title: 'Provider Portal accessibility audit (WCAG 2.1 AA)',
      time: '13:00',
      priority: 'medium',
      status: 'complete',
      dateStr: d5,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-3', 'tm-2'],
      groupIds: ['grp-frontend'],
      createdAt: d5,
      completedAt: `${d5} 17:00`
    },
    {
      id: 'tsk-h5-3',
      title: 'Prometheus metrics & Grafana alert rules for ingest latency',
      time: '14:30',
      priority: 'medium',
      status: 'complete',
      dateStr: d5,
      sourceInstance: 'internal',
      ticketType: 'ops_ticket',
      assigneeIds: ['tm-5'],
      groupIds: ['grp-ops'],
      createdAt: d5,
      completedAt: `${d5} 16:30`
    },
    {
      id: 'tsk-h5-4',
      title: 'FHIR bundle cryptographic signature validation service',
      time: '15:30',
      priority: 'high',
      status: 'complete',
      dateStr: d5,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-4', 'tm-1'],
      groupIds: ['grp-backend'],
      createdAt: d5,
      completedAt: `${d5} 18:15`
    },

    // --- Day -6 ---
    {
      id: 'tsk-h6-1',
      title: 'HIPAA session expiration audit & inactivity timeout',
      time: '10:00',
      priority: 'high',
      status: 'complete',
      dateStr: d6,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-1'],
      groupIds: ['grp-core'],
      createdAt: d6,
      completedAt: `${d6} 14:00`
    },
    {
      id: 'tsk-h6-2',
      title: 'Staff automation suite benchmark & execution time reduction',
      time: '11:00',
      priority: 'medium',
      status: 'complete',
      dateStr: d6,
      sourceInstance: 'internal',
      ticketType: 'test_run',
      assigneeIds: ['tm-2'],
      groupIds: ['grp-qa'],
      createdAt: d6,
      completedAt: `${d6} 16:00`
    },
    {
      id: 'tsk-h6-3',
      title: 'Dark theme and contrast token refinements in provider UI',
      time: '13:30',
      priority: 'medium',
      status: 'complete',
      dateStr: d6,
      sourceInstance: 'internal',
      ticketType: 'dev_activity',
      assigneeIds: ['tm-3'],
      groupIds: ['grp-frontend'],
      createdAt: d6,
      completedAt: `${d6} 17:30`
    },
    {
      id: 'tsk-h6-4',
      title: 'PostgreSQL read-replica failover test in Staging cluster',
      time: '15:00',
      priority: 'high',
      status: 'complete',
      dateStr: d6,
      sourceInstance: 'internal',
      ticketType: 'ops_ticket',
      assigneeIds: ['tm-5', 'tm-4'],
      groupIds: ['grp-ops'],
      createdAt: d6,
      completedAt: `${d6} 17:45`
    }
  ];
};

export const INITIAL_SETTINGS: AppSettings = {
  managerEmail: 'director.delivery@careflow.io',
  yourName: 'Alex Rivera (Lead)',
  carryForward: true,
  selectedReleaseId: 'rel-2026-q3-sprint24',
  sidebarCollapsed: false,
  lastBackupAt: null,
  geminiModel: 'gemini-2.5-flash',
  theme: 'executive_slate'
};

