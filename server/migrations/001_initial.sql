CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  size_band TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0,1)),
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','portfolio_manager','project_manager','team_lead','contributor','finance_viewer','executive_viewer')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE portfolios (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  strategic_objective TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, name)
);
CREATE INDEX portfolios_org_idx ON portfolios(organization_id);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portfolio_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'Business',
  strategic_objective TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P1','P2','P3')),
  lifecycle_stage TEXT NOT NULL DEFAULT 'Proposed' CHECK (lifecycle_stage IN ('Proposed','Under Review','Approved','Planned','Active','On Hold','At Risk','Completed','Cancelled','Archived')),
  health TEXT NOT NULL DEFAULT 'Healthy' CHECK (health IN ('Healthy','Watch','Critical')),
  risk_rating TEXT NOT NULL DEFAULT 'Low' CHECK (risk_rating IN ('Low','Medium','High','Critical')),
  project_manager TEXT NOT NULL DEFAULT '',
  sponsor TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  target_completion_date TEXT,
  forecast_completion_date TEXT,
  actual_completion_date TEXT,
  approved_budget_cents INTEGER NOT NULL DEFAULT 0 CHECK (approved_budget_cents >= 0),
  actual_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (actual_cost_cents >= 0),
  forecast_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK (forecast_cost_cents >= 0),
  planned_progress INTEGER NOT NULL DEFAULT 0 CHECK (planned_progress BETWEEN 0 AND 100),
  actual_progress INTEGER NOT NULL DEFAULT 0 CHECK (actual_progress BETWEEN 0 AND 100),
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code),
  FOREIGN KEY (portfolio_id, organization_id) REFERENCES portfolios(id, organization_id) ON DELETE RESTRICT
);
CREATE INDEX projects_org_status_idx ON projects(organization_id, lifecycle_stage);
CREATE INDEX projects_org_portfolio_idx ON projects(organization_id, portfolio_id);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Todo' CHECK (status IN ('Todo','In Progress','Blocked','Done')),
  priority TEXT NOT NULL DEFAULT 'P2' CHECK (priority IN ('P1','P2','P3')),
  assignee TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  due_date TEXT,
  estimated_hours REAL NOT NULL DEFAULT 0 CHECK (estimated_hours >= 0),
  actual_hours REAL NOT NULL DEFAULT 0 CHECK (actual_hours >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX tasks_org_project_idx ON tasks(organization_id, project_id, status);

CREATE TABLE task_dependencies (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  predecessor_id TEXT NOT NULL,
  successor_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'FS' CHECK (dependency_type IN ('FS','SS','FF','SF')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (organization_id, predecessor_id, successor_id),
  CHECK (predecessor_id <> successor_id),
  FOREIGN KEY (predecessor_id, organization_id) REFERENCES tasks(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (successor_id, organization_id) REFERENCES tasks(id, organization_id) ON DELETE CASCADE
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'On track' CHECK (status IN ('On track','Needs attention','Delayed','Complete')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX milestones_org_due_idx ON milestones(organization_id, due_date, status);

CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  weekly_capacity_hours REAL NOT NULL DEFAULT 30 CHECK (weekly_capacity_hours >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, id)
);
CREATE INDEX resources_org_idx ON resources(organization_id, department);

CREATE TABLE assignments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  allocation_percent REAL NOT NULL CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (resource_id, organization_id) REFERENCES resources(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX assignments_org_dates_idx ON assignments(organization_id, resource_id, start_date, end_date);

CREATE TABLE financial_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('actual','forecast','budget_revision')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  entry_date TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX finance_org_project_date_idx ON financial_entries(organization_id, project_id, entry_date);

CREATE TABLE risks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Delivery',
  probability INTEGER NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  mitigation TEXT NOT NULL DEFAULT '',
  contingency TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  review_date TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Mitigating','Accepted','Closed')),
  residual_probability INTEGER NOT NULL DEFAULT 1 CHECK (residual_probability BETWEEN 1 AND 5),
  residual_impact INTEGER NOT NULL DEFAULT 1 CHECK (residual_impact BETWEEN 1 AND 5),
  escalated INTEGER NOT NULL DEFAULT 0 CHECK (escalated IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (organization_id, id),
  FOREIGN KEY (project_id, organization_id) REFERENCES projects(id, organization_id) ON DELETE CASCADE
);
CREATE INDEX risks_org_status_idx ON risks(organization_id, status);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_user_idx ON notifications(organization_id, user_id, read_at, created_at);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX audit_org_created_idx ON audit_events(organization_id, created_at);

CREATE TABLE subscriptions (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'Starter' CHECK (plan IN ('Starter','Professional','Business','Enterprise')),
  status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','past_due','cancelled')),
  trial_ends_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE organization_settings (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  working_days TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
  weekly_capacity_hours REAL NOT NULL DEFAULT 30 CHECK (weekly_capacity_hours > 0),
  updated_at TEXT NOT NULL
);
