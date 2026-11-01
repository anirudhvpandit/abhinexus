import { randomUUID, scrypt as scryptCallback, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { openDatabase } from './db.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo accounts are disabled in production.');
}

const scrypt = promisify(scryptCallback);
const database = openDatabase();
const email = (process.env.DEMO_EMAIL || 'demo@abhinexus.local').toLowerCase();
const password = process.env.DEMO_PASSWORD || 'Abhinexus-Demo-2026!';
const existing = database.prepare('SELECT id FROM users WHERE email = ?').get(email);

if (existing) {
  if (!process.argv.includes('--reset')) {
    console.log(`Demo account already exists: ${email}. Re-run with --reset to replace its isolated demo workspace.`);
    database.close();
    process.exit(0);
  }
  const demoOrganizations = database.prepare(`
    SELECT o.id, o.is_demo, COUNT(m.user_id) AS member_count
    FROM organizations o
    JOIN memberships m ON m.organization_id = o.id
    WHERE m.user_id = ?
    GROUP BY o.id
  `).all(existing.id);
  if (demoOrganizations.length !== 1 || demoOrganizations[0].is_demo !== 1 || demoOrganizations[0].member_count !== 1) {
    database.close();
    throw new Error('Refusing to reset this account: it must own exactly one isolated demo organization.');
  }
  database.transaction(() => {
    database.prepare('DELETE FROM organizations WHERE id = ? AND is_demo = 1').run(demoOrganizations[0].id);
    database.prepare('DELETE FROM users WHERE id = ?').run(existing.id);
  })();
}

const hashPassword = async (value) => {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(value, salt, 64);
  return `scrypt$${salt}$${key.toString('hex')}`;
};
const id = () => randomUUID();
const now = new Date().toISOString();
const date = (offsetDays) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
const organizationId = id();
const userId = id();
const portfolioIds = [id(), id(), id()];
const projectIds = [id(), id(), id(), id(), id()];
const resourceIds = [id(), id(), id(), id(), id()];
const taskIds = [id(), id(), id()];

const insert = database.transaction((passwordHash) => {
  database.prepare('INSERT INTO organizations (id, name, industry, size_band, currency, is_demo, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)')
    .run(organizationId, 'Northstar Holdings (Demo)', 'Professional Services', 'Mid-market', 'USD', now);
  database.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId, email, 'Demo Owner', passwordHash, now);
  database.prepare('INSERT INTO memberships (organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
    .run(organizationId, userId, 'owner', now);
  database.prepare('INSERT INTO subscriptions (organization_id, plan, status, trial_ends_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(organizationId, 'Professional', 'trial', new Date(Date.now() + 14 * 86400000).toISOString(), now);
  database.prepare('INSERT INTO organization_settings (organization_id, updated_at) VALUES (?, ?)').run(organizationId, now);

  const insertPortfolio = database.prepare(`
    INSERT INTO portfolios (id, organization_id, name, description, strategic_objective, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  [
    ['Digital Transformation', 'Core systems modernization', 'Improve operational resilience and decision speed'],
    ['Operations', 'Field operations and delivery', 'Increase service quality and workforce productivity'],
    ['Risk & Compliance', 'Security, assurance and governance', 'Reduce material risk and improve control coverage'],
  ].forEach(([name, description, objective], index) => insertPortfolio.run(portfolioIds[index], organizationId, name, description, objective, now, now));

  const projects = [
    { code: 'NS-101', name: 'ERP Modernization', portfolio: 0, lifecycle: 'Active', health: 'Healthy', priority: 'P1', budget: 240000000, actual: 148000000, forecast: 221000000, progress: 68, pm: 'Priya Nair', due: 120 },
    { code: 'NS-102', name: 'Field Ops Intelligence', portfolio: 1, lifecycle: 'At Risk', health: 'Watch', priority: 'P1', budget: 180000000, actual: 126500000, forecast: 197000000, progress: 52, pm: 'Deepak Singh', due: 45 },
    { code: 'NS-103', name: 'Customer 360 Renewal', portfolio: 0, lifecycle: 'Active', health: 'Healthy', priority: 'P2', budget: 96000000, actual: 61000000, forecast: 87000000, progress: 74, pm: 'Jules Morgan', due: 80 },
    { code: 'NS-104', name: 'Cyber Defense Program', portfolio: 2, lifecycle: 'At Risk', health: 'Critical', priority: 'P1', budget: 320000000, actual: 210000000, forecast: 349000000, progress: 46, pm: 'Leah Frost', due: 30 },
    { code: 'NS-105', name: 'Revenue Operations Hub', portfolio: 1, lifecycle: 'Planned', health: 'Healthy', priority: 'P2', budget: 143000000, actual: 0, forecast: 138000000, progress: 10, pm: 'Owen Hughes', due: 160 },
  ];
  const insertProject = database.prepare(`
    INSERT INTO projects (
      id, organization_id, portfolio_id, code, name, description, client, project_type,
      strategic_objective, priority, lifecycle_stage, health, risk_rating, project_manager,
      sponsor, start_date, target_completion_date, forecast_completion_date, approved_budget_cents,
      actual_cost_cents, forecast_cost_cents, planned_progress, actual_progress, tags, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  projects.forEach((project, index) => {
    insertProject.run(
      projectIds[index], organizationId, portfolioIds[project.portfolio], project.code, project.name,
      `${project.name} synthetic demonstration project.`, 'Northstar Holdings', 'Transformation',
      'Improve delivery performance and operational visibility', project.priority, project.lifecycle,
      project.health, project.health === 'Critical' ? 'High' : project.health === 'Watch' ? 'Medium' : 'Low',
      project.pm, 'Alicia Chen', date(-100), date(project.due), date(project.due + 10),
      project.budget, project.actual, project.forecast, Math.min(100, project.progress + 8),
      project.progress, JSON.stringify(['Sample workspace']), now, now,
    );
    if (project.actual > 0) database.prepare(`
      INSERT INTO financial_entries (id, organization_id, project_id, entry_type, amount_cents, entry_date, memo, created_at)
      VALUES (?, ?, ?, 'actual', ?, ?, ?, ?)
    `).run(id(), organizationId, projectIds[index], project.actual, date(-10), 'Synthetic actual cost to date', now);
    database.prepare(`
      INSERT INTO financial_entries (id, organization_id, project_id, entry_type, amount_cents, entry_date, memo, created_at)
      VALUES (?, ?, ?, 'forecast', ?, ?, ?, ?)
    `).run(id(), organizationId, projectIds[index], project.forecast, date(0), 'Synthetic estimate at completion', now);
  });

  const resources = [
    ['Aisha Patel', 'Engineering Lead', 'Product', 'New York', 40],
    ['Noah Kim', 'Data Architect', 'Data', 'Singapore', 36],
    ['Elena Rossi', 'PMO Manager', 'Program Office', 'Frankfurt', 32],
    ['Tariq Bell', 'Security Analyst', 'Security', 'London', 38],
    ['Mira Shah', 'UX Researcher', 'Design', 'Austin', 28],
  ];
  const insertResource = database.prepare(`
    INSERT INTO resources (id, organization_id, name, role, department, location, weekly_capacity_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  resources.forEach((resource, index) => insertResource.run(resourceIds[index], organizationId, ...resource, now, now));

  const insertAssignment = database.prepare(`
    INSERT INTO assignments (id, organization_id, project_id, resource_id, allocation_percent, start_date, end_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAssignment.run(id(), organizationId, projectIds[0], resourceIds[0], 60, date(-10), date(90), now);
  insertAssignment.run(id(), organizationId, projectIds[1], resourceIds[0], 30, date(-5), date(45), now);
  insertAssignment.run(id(), organizationId, projectIds[0], resourceIds[1], 70, date(-5), date(100), now);
  insertAssignment.run(id(), organizationId, projectIds[3], resourceIds[3], 85, date(-5), date(35), now);
  insertAssignment.run(id(), organizationId, projectIds[2], resourceIds[4], 55, date(-5), date(60), now);

  const insertTask = database.prepare(`
    INSERT INTO tasks (id, organization_id, project_id, title, description, status, priority, assignee, start_date, due_date, estimated_hours, actual_hours, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run(taskIds[0], organizationId, projectIds[0], 'Confirm migration scope', 'Approve module mapping with business owners.', 'Done', 'P1', 'Aisha Patel', date(-14), date(-5), 24, 22, now, now);
  insertTask.run(taskIds[1], organizationId, projectIds[0], 'Complete data validation', 'Reconcile migrated records against source totals.', 'In Progress', 'P1', 'Noah Kim', date(-4), date(8), 40, 16, now, now);
  insertTask.run(taskIds[2], organizationId, projectIds[0], 'Prepare cutover rehearsal', 'Run the cutover checklist with system owners.', 'Todo', 'P2', 'Priya Nair', date(10), date(25), 16, 0, now, now);
  database.prepare('INSERT INTO task_dependencies (organization_id, predecessor_id, successor_id, dependency_type, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(organizationId, taskIds[1], taskIds[2], 'FS', now);

  const insertMilestone = database.prepare(`
    INSERT INTO milestones (id, organization_id, project_id, name, due_date, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMilestone.run(id(), organizationId, projectIds[0], 'Module cutover', date(25), 'On track', now, now);
  insertMilestone.run(id(), organizationId, projectIds[1], 'Field app pilot', date(8), 'Needs attention', now, now);
  insertMilestone.run(id(), organizationId, projectIds[3], 'Control validation', date(18), 'Delayed', now, now);

  const insertRisk = database.prepare(`
    INSERT INTO risks (
      id, organization_id, project_id, title, description, category, probability, impact,
      mitigation, contingency, owner, review_date, status, residual_probability,
      residual_impact, escalated, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRisk.run(id(), organizationId, projectIds[0], 'Vendor SLA gap in ERP migration', 'Supplier response commitments may delay issue resolution.', 'Vendor', 4, 4, 'Negotiate a written response-time addendum.', 'Use dual-led support for the cutover window.', 'Priya Nair', date(7), 'Mitigating', 2, 3, 0, now, now);
  insertRisk.run(id(), organizationId, projectIds[1], 'Field operations adoption below target', 'Adoption pilot participation is below plan.', 'Adoption', 3, 4, 'Add regional coaching and weekly adoption reviews.', 'Extend the pilot and stage rollout by region.', 'Deepak Singh', date(4), 'Open', 2, 3, 0, now, now);
  insertRisk.run(id(), organizationId, projectIds[3], 'Security remediation backlog', 'Critical findings could delay external control validation.', 'Security', 5, 5, 'Prioritize critical remediation and validate owners daily.', 'Escalate remaining high findings to the steering committee.', 'Leah Frost', date(2), 'Mitigating', 3, 4, 1, now, now);
});

const passwordHash = await hashPassword(password);
insert(passwordHash);
console.log(`Created synthetic demo workspace.\nEmail: ${email}\nPassword: ${password}\nThese local-only demo credentials are disabled in production.`);
database.close();
