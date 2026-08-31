-- ==============================================================================
-- Jira-Like Agile Project Management Schema for PostgreSQL & Hasura GraphQL
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key VARCHAR(16) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    lead_id VARCHAR(64),
    category VARCHAR(64) DEFAULT 'Software',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    avatar_color VARCHAR(32) DEFAULT '#4f46e5',
    role VARCHAR(64) DEFAULT 'engineer',
    job_title VARCHAR(128) DEFAULT 'Software Engineer',
    time_zone VARCHAR(64) DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Sprints Table
CREATE TABLE IF NOT EXISTS sprints (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    goal TEXT,
    state VARCHAR(32) NOT NULL DEFAULT 'future', -- 'future' | 'active' | 'closed'
    start_date DATE,
    end_date DATE,
    complete_date DATE,
    sequence_number INT DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Releases / Versions Table
CREATE TABLE IF NOT EXISTS releases (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version_number VARCHAR(64),
    status VARCHAR(32) DEFAULT 'unreleased', -- 'unreleased' | 'released' | 'archived'
    release_date DATE,
    description TEXT,
    area_path VARCHAR(255),
    iteration_path VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Issues Table (Unifying Epics, Stories, Bugs, Tasks, and Subtasks)
CREATE TABLE IF NOT EXISTS issues (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    issue_key VARCHAR(32) NOT NULL UNIQUE, -- e.g. 'ACM-101', 'PROJ-42'
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    sprint_id VARCHAR(64) REFERENCES sprints(id) ON DELETE SET NULL,
    release_id VARCHAR(64) REFERENCES releases(id) ON DELETE SET NULL,
    parent_issue_id VARCHAR(64) REFERENCES issues(id) ON DELETE SET NULL,
    epic_id VARCHAR(64) REFERENCES issues(id) ON DELETE SET NULL,
    issue_type VARCHAR(32) NOT NULL DEFAULT 'Story', -- 'Epic' | 'Story' | 'Bug' | 'Task' | 'Subtask'
    summary VARCHAR(512) NOT NULL,
    description TEXT,
    status VARCHAR(64) NOT NULL DEFAULT 'To Do', -- 'To Do' | 'In Progress' | 'Code Review' | 'QA Ready' | 'QA In Progress' | 'QA Passed' | 'Done' | 'Blocked'
    priority VARCHAR(32) NOT NULL DEFAULT 'medium', -- 'critical' | 'high' | 'medium' | 'low'
    severity VARCHAR(32) DEFAULT 'medium',
    story_points NUMERIC(6, 1) DEFAULT 0,
    original_estimate_hours NUMERIC(6, 1) DEFAULT 0,
    time_spent_hours NUMERIC(6, 1) DEFAULT 0,
    assignee_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reporter_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    environment VARCHAR(64) DEFAULT 'QA',
    resolution VARCHAR(64),
    area_path VARCHAR(255),
    iteration_path VARCHAR(255),
    ado_id INT,
    tags TEXT[] DEFAULT '{}',
    acceptance_criteria TEXT[] DEFAULT '{}',
    execution_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Issue Comments Table
CREATE TABLE IF NOT EXISTS issue_comments (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Work Logs Table (Time Tracking)
CREATE TABLE IF NOT EXISTS work_logs (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    author_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    author_name VARCHAR(255) NOT NULL,
    time_spent_hours NUMERIC(6, 1) NOT NULL,
    description TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Issue Links Table (Dependency / Relationship mapping)
CREATE TABLE IF NOT EXISTS issue_links (
    id VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    target_issue_id VARCHAR(64) NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    link_type VARCHAR(32) NOT NULL DEFAULT 'relates_to', -- 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates' | 'is_duplicated_by'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_issue_link UNIQUE (source_issue_id, target_issue_id, link_type)
);

-- 9. Create Indexes for High Performance
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_sprint_id ON issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_release_id ON issues(release_id);
CREATE INDEX IF NOT EXISTS idx_issues_parent_id ON issues(parent_issue_id);
CREATE INDEX IF NOT EXISTS idx_issues_assignee_id ON issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_issue_key ON issues(issue_key);
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON issue_comments(issue_id);
CREATE INDEX IF NOT EXISTS idx_worklogs_issue_id ON work_logs(issue_id);

-- 10. Seed Default Agile Project and Data
INSERT INTO projects (id, key, name, description, category)
VALUES ('proj-acm', 'ACM', 'ACM Delivery & Core Platform', 'Enterprise Telecom eSIM and Device Gateway Delivery Suite', 'Software')
ON CONFLICT (key) DO NOTHING;

INSERT INTO users (id, email, name, role, avatar_color)
VALUES 
    ('user-1', 'alex.m@careflow.io', 'Alex Mercer', 'lead', '#4f46e5'),
    ('user-2', 'priya.k@careflow.io', 'Priya K.', 'qa_lead', '#10b981'),
    ('user-3', 'david.r@careflow.io', 'David Ross', 'engineer', '#f59e0b'),
    ('user-4', 'elena.v@careflow.io', 'Elena V.', 'engineer', '#ec4899')
ON CONFLICT (email) DO NOTHING;

INSERT INTO sprints (id, project_id, name, goal, state, start_date, end_date, sequence_number)
VALUES 
    ('sprint-current', 'proj-acm', 'Sprint 2026.09 - Core Stabilization', 'Complete eSIM roaming switchover validation and resolve P0 telemetry defects for Monday delivery.', 'active', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE + INTERVAL '9 days', 1),
    ('sprint-next', 'proj-acm', 'Sprint 2026.10 - Fleet Ingestion', 'Scale message bus throughput and complete Dev-to-Dev contract verification.', 'future', CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '24 days', 2)
ON CONFLICT DO NOTHING;

INSERT INTO releases (id, project_id, name, version_number, status, release_date, description, area_path)
VALUES 
    ('rel-1', 'proj-acm', 'D5 R 2026.09', '2026.09', 'Active QA', CURRENT_DATE + INTERVAL '3 days', 'Major telemetry resilience and roaming activation rollout', 'ACM')
ON CONFLICT DO NOTHING;

-- Initial Demo Issues
INSERT INTO issues (id, issue_key, project_id, sprint_id, release_id, issue_type, summary, description, status, priority, story_points, original_estimate_hours, time_spent_hours, assignee_id, area_path, ado_id)
VALUES 
    ('issue-1', 'ACM-101', 'proj-acm', 'sprint-current', 'rel-1', 'Story', 'eSIM Profile Roaming Activation Service', 'Enable dynamic eSIM carrier roaming profile switching for multi-region connected fleet modems.', 'Blocked', 'critical', 5.0, 16.0, 12.0, 'user-1', 'ACM', 84210),
    ('issue-2', 'ACM-102', 'proj-acm', 'sprint-current', 'rel-1', 'Bug', 'Modem telemetry handshake timeout on /v2/switch', 'Endpoint returns 504 Gateway Timeout when modem payload exceeds 64KB during handshake sequence.', 'In Progress', 'critical', 3.0, 8.0, 6.0, 'user-1', 'ACM', 901),
    ('issue-3', 'ACM-103', 'proj-acm', 'sprint-current', 'rel-1', 'Story', 'Device Health Heartbeat Service Verification', 'Validate automated ping and telemetry heartbeat packet parser across high-traffic fleets.', 'QA In Progress', 'medium', 3.0, 10.0, 4.0, 'user-2', 'ACM', 84211),
    ('issue-4', 'ACM-104', 'proj-acm', 'sprint-current', 'rel-1', 'Story', 'Fleet Diagnostics API Ingestion Engine', 'High-throughput Kafka streaming pipeline for real-time telemetry processing.', 'QA Passed', 'high', 8.0, 24.0, 24.0, 'user-3', 'ACM', 84212),
    ('issue-5', 'ACM-105', 'proj-acm', 'sprint-next', 'rel-1', 'Task', 'Configure Redis cluster failover stubs in QA Staging', 'Setup Sentinel high-availability and simulate network partition for roaming switchover resilience.', 'To Do', 'medium', 2.0, 6.0, 0.0, 'user-4', 'ACM', 84215)
ON CONFLICT (issue_key) DO NOTHING;
