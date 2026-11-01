import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { createApp } from '../server/app.js';
import { openDatabase } from '../server/db.js';

test('organization-scoped workflows enforce validation, permissions and calculations', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abhinexus-test-'));
  const databasePath = path.join(directory, 'test.db');
  const db = openDatabase(databasePath);
  assert.equal(fs.statSync(databasePath).mode & 0o777, 0o600);
  const server = createApp(db).listen(0);
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}/api/v1`;

  t.after(async () => {
    server.close();
    await once(server, 'close');
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  async function request(route, { method = 'GET', body, cookie, origin } = {}) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json() : await response.text();
    return { response, result };
  }

  const firstRegistration = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Owner One',
      email: 'owner@example.test',
      password: 'a-safe-test-password-2026',
      organization_name: 'First Org',
      currency: 'USD',
    },
  });
  assert.equal(firstRegistration.response.status, 201);
  const firstCookie = firstRegistration.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(firstCookie?.startsWith('abhinexus_session='));
  assert.equal((await request('/auth/me')).response.status, 401);

  const portfolioResult = await request('/portfolios', {
    method: 'POST',
    cookie: firstCookie,
    body: { name: 'Platform', description: 'Core systems', strategic_objective: 'Modernize delivery' },
  });
  assert.equal(portfolioResult.response.status, 201);

  const projectResult = await request('/projects', {
    method: 'POST',
    cookie: firstCookie,
    body: {
      name: 'Migration',
      portfolio_id: portfolioResult.result.id,
      lifecycle_stage: 'Active',
      approved_budget_cents: 100000,
      start_date: '2026-01-01',
      target_completion_date: '2026-12-01',
      planned_progress: 60,
      actual_progress: 45,
    },
  });
  assert.equal(projectResult.response.status, 201);
  const projectId = projectResult.result.id;

  const firstTask = await request('/tasks', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, title: 'Prerequisite', status: 'In Progress' },
  });
  const secondTask = await request('/tasks', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, title: 'Dependent task' },
  });
  assert.equal(firstTask.response.status, 201);
  assert.equal(secondTask.response.status, 201);
  const taskPage = await request(`/tasks?project_id=${projectId}&page=1&limit=1`, { cookie: firstCookie });
  assert.equal(taskPage.result.items.length, 1);
  assert.equal(taskPage.result.total, 2);
  assert.equal(taskPage.result.page, 1);
  const secondTaskPage = await request(`/tasks?project_id=${projectId}&page=2&limit=1`, { cookie: firstCookie });
  assert.equal(secondTaskPage.result.items.length, 1);
  assert.equal(secondTaskPage.result.total, 2);
  assert.equal((await request(`/tasks/${secondTask.result.id}/dependencies`, {
    method: 'POST',
    cookie: firstCookie,
    body: { predecessor_id: firstTask.result.id, dependency_type: 'FS' },
  })).response.status, 201);
  assert.equal((await request(`/tasks/${firstTask.result.id}/dependencies`, {
    method: 'POST',
    cookie: firstCookie,
    body: { predecessor_id: secondTask.result.id, dependency_type: 'FS' },
  })).response.status, 409);

  const datedPredecessor = await request('/tasks', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, title: 'Dated prerequisite', start_date: '2026-03-01', due_date: '2026-03-10' },
  });
  const datedSuccessor = await request('/tasks', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, title: 'Dated successor', start_date: '2026-03-09', due_date: '2026-03-15' },
  });
  const dependencyRoute = `/tasks/${datedSuccessor.result.id}/dependencies`;
  assert.equal((await request(dependencyRoute, {
    method: 'POST',
    cookie: firstCookie,
    body: { predecessor_id: datedPredecessor.result.id },
  })).response.status, 400);
  assert.equal((await request(`/tasks/${datedSuccessor.result.id}`, {
    method: 'PATCH',
    cookie: firstCookie,
    body: { start_date: '2026-03-11' },
  })).response.status, 200);
  assert.equal((await request(dependencyRoute, {
    method: 'POST',
    cookie: firstCookie,
    body: { predecessor_id: datedPredecessor.result.id },
  })).response.status, 201);
  assert.equal((await request(`/tasks/${datedPredecessor.result.id}`, {
    method: 'PATCH',
    cookie: firstCookie,
    body: { due_date: '2026-03-12' },
  })).response.status, 400);
  assert.equal((await request(`/tasks/${datedSuccessor.result.id}`, {
    method: 'PATCH',
    cookie: firstCookie,
    body: { start_date: '2026-03-09' },
  })).response.status, 400);
  const secondProject = await request('/projects', {
    method: 'POST',
    cookie: firstCookie,
    body: { name: 'Separate project', portfolio_id: portfolioResult.result.id },
  });
  assert.equal((await request(`/tasks/${datedSuccessor.result.id}`, {
    method: 'PATCH',
    cookie: firstCookie,
    body: { project_id: secondProject.result.id },
  })).response.status, 400);

  assert.equal((await request(`/tasks/${secondTask.result.id}`, {
    method: 'PATCH',
    cookie: firstCookie,
    body: { status: 'Done' },
  })).response.status, 409);

  const resourceResult = await request('/resources', {
    method: 'POST',
    cookie: firstCookie,
    body: { name: 'Resource One', weekly_capacity_hours: 30 },
  });
  assert.equal(resourceResult.response.status, 201);
  const assignment = (allocation, start, end) => request('/assignments', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, resource_id: resourceResult.result.id, allocation_percent: allocation, start_date: start, end_date: end },
  });
  assert.equal((await assignment(70, '2026-11-02', '2026-11-06')).response.status, 201);
  assert.equal((await assignment(50, '2026-11-04', '2026-11-08')).response.status, 409);
  assert.equal((await assignment(50, '2026-11-07', '2026-11-12')).response.status, 201);

  db.prepare('UPDATE projects SET actual_cost_cents = ?, forecast_cost_cents = ? WHERE id = ?').run(5000, 75000, projectId);
  const financeResult = await request('/finance/entries', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, entry_type: 'actual', amount_cents: 25000, entry_date: '2026-10-15', memo: 'Test cost' },
  });
  assert.equal(financeResult.response.status, 201);
  assert.equal((await request('/finance/entries', {
    method: 'POST',
    cookie: firstCookie,
    body: { project_id: projectId, entry_type: 'budget_revision', amount_cents: 5000, entry_date: '2026-10-15' },
  })).response.status, 400);
  const finance = await request('/finance', { cookie: firstCookie });
  const projectFinance = finance.result.projects.find(({ id }) => id === projectId);
  assert.equal(projectFinance.actual_cents, 25000);
  assert.equal(projectFinance.variance_cents, 75000);
  assert.equal(projectFinance.forecast_cents, 75000);

  const riskResult = await request('/risks', {
    method: 'POST',
    cookie: firstCookie,
    body: {
      project_id: projectId,
      title: '=2+2',
      probability: 5,
      impact: 4,
      residual_probability: 2,
      residual_impact: 3,
      owner: 'Risk Owner',
      mitigation: 'Test mitigation',
    },
  });
  assert.equal(riskResult.response.status, 201);
  assert.equal(riskResult.result.inherent_score, 20);
  assert.equal(riskResult.result.residual_score, 6);
  const dashboard = await request('/dashboard', { cookie: firstCookie });
  assert.equal(dashboard.result.summary.blocked_tasks, 2);
  const notifications = await request('/notifications', { cookie: firstCookie });
  assert.equal(notifications.result.some(({ title }) => title === 'High risk requires attention'), true);
  const riskCsv = await request('/reports/risk-register.csv', { cookie: firstCookie });
  assert.equal(riskCsv.response.status, 200);
  assert.match(riskCsv.result, /"'=2\+2"/);

  const secondRegistration = await request('/auth/register', {
    method: 'POST',
    body: {
      name: 'Owner Two',
      email: 'second@example.test',
      password: 'another-safe-test-password',
      organization_name: 'Second Org',
      currency: 'INR',
    },
  });
  const secondCookie = secondRegistration.response.headers.get('set-cookie')?.split(';')[0];
  assert.equal(secondRegistration.response.status, 201);
  const isolatedProjects = await request('/projects', { cookie: secondCookie });
  assert.equal(isolatedProjects.result.total, 0);
  assert.equal((await request(`/tasks/${secondTask.result.id}`, { method: 'PATCH', cookie: secondCookie, body: { status: 'Done' } })).response.status, 404);

  const financeViewer = db.prepare("SELECT user_id, organization_id FROM memberships WHERE organization_id = ?").get(firstRegistration.result.organization.id);
  db.prepare('UPDATE memberships SET role = ? WHERE user_id = ? AND organization_id = ?').run('contributor', financeViewer.user_id, financeViewer.organization_id);
  const contributorProjects = await request('/projects', { cookie: firstCookie });
  assert.equal(Object.hasOwn(contributorProjects.result.items[0], 'approved_budget_cents'), false);
  assert.equal((await request('/finance', { cookie: firstCookie })).response.status, 403);
  db.prepare('UPDATE memberships SET role = ? WHERE user_id = ? AND organization_id = ?').run('finance_viewer', financeViewer.user_id, financeViewer.organization_id);
  const restrictedProjects = await request('/projects', { cookie: firstCookie });
  assert.equal(restrictedProjects.response.status, 200);
  assert.equal(Object.hasOwn(restrictedProjects.result.items[0], 'approved_budget_cents'), true);
  assert.equal((await request('/finance', { cookie: firstCookie })).response.status, 200);
  assert.equal((await request('/finance/entries', { method: 'POST', cookie: firstCookie, body: { project_id: projectId, entry_type: 'actual', amount_cents: 1, entry_date: '2026-10-15' } })).response.status, 403);
  assert.equal((await request('/settings', { cookie: firstCookie })).response.status, 403);

  const csrf = await request('/portfolios', {
    method: 'POST',
    cookie: secondCookie,
    origin: 'https://attacker.example',
    body: { name: 'Should fail' },
  });
  assert.equal(csrf.response.status, 403);

  const login = await request('/auth/login', {
    method: 'POST',
    body: { email: 'owner@example.test', password: 'a-safe-test-password-2026' },
  });
  assert.equal(login.response.status, 200);
  const loginCookie = login.response.headers.get('set-cookie')?.split(';')[0];
  assert.ok(loginCookie?.startsWith('abhinexus_session='));
  assert.equal((await request('/auth/me', { cookie: loginCookie })).response.status, 200);
  assert.equal((await request('/auth/logout', { method: 'POST', cookie: loginCookie })).response.status, 204);
  assert.equal((await request('/auth/me', { cookie: loginCookie })).response.status, 401);
});

test('database backups preserve a consistent copy with private file permissions', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abhinexus-backup-'));
  const databasePath = path.join(directory, 'source.db');
  const backupPath = path.join(directory, 'backup.db');
  const source = openDatabase(databasePath);
  source.prepare('INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)')
    .run('backup-test-org', 'Backup test', new Date().toISOString());
  source.close();

  execFileSync(process.execPath, [path.resolve('server/backup.js'), backupPath], {
    env: { ...process.env, DATABASE_PATH: databasePath },
  });
  const backup = new Database(backupPath, { readonly: true });
  assert.equal(backup.prepare('SELECT name FROM organizations WHERE id = ?').get('backup-test-org').name, 'Backup test');
  backup.close();
  assert.equal(fs.statSync(backupPath).mode & 0o777, 0o600);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('demo seed is synthetic, dependency-valid, and disabled in production', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abhinexus-seed-'));
  const databasePath = path.join(directory, 'demo.db');
  const seedScript = path.resolve('server/seed-demo.js');
  const environment = {
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_PATH: databasePath,
    DEMO_EMAIL: 'seed@example.test',
    DEMO_PASSWORD: 'local-demo-password',
  };
  execFileSync(process.execPath, [seedScript], { env: environment });

  const seeded = openDatabase(databasePath);
  const firstOrganizationId = seeded.prepare('SELECT id FROM organizations').get().id;
  assert.equal(seeded.prepare('SELECT is_demo FROM organizations').get().is_demo, 1);
  assert.equal(seeded.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 5);
  assert.equal(seeded.prepare('SELECT COUNT(*) AS count FROM tasks').get().count, 3);
  assert.equal(seeded.prepare(`
    SELECT COUNT(*) AS count FROM task_dependencies d
    JOIN tasks predecessor ON predecessor.id = d.predecessor_id
    JOIN tasks successor ON successor.id = d.successor_id
    WHERE successor.start_date < predecessor.due_date
  `).get().count, 0);
  seeded.close();

  execFileSync(process.execPath, [seedScript, '--reset'], { env: environment });
  const reseeded = openDatabase(databasePath);
  assert.equal(reseeded.prepare('SELECT COUNT(*) AS count FROM organizations').get().count, 1);
  assert.equal(reseeded.prepare('SELECT COUNT(*) AS count FROM projects').get().count, 5);
  assert.notEqual(reseeded.prepare('SELECT id FROM organizations').get().id, firstOrganizationId);
  reseeded.close();

  const productionAttempt = spawnSync(process.execPath, [seedScript], {
    env: { ...environment, NODE_ENV: 'production' },
    encoding: 'utf8',
  });
  assert.equal(productionAttempt.status, 1);
  assert.match(productionAttempt.stderr, /disabled in production/);
  fs.rmSync(directory, { recursive: true, force: true });
});

test('first migration preserves legacy seed tables while creating tenant schema', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'abhinexus-legacy-'));
  const databasePath = path.join(directory, 'legacy.db');
  const legacyDb = new Database(databasePath);
  legacyDb.exec("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT); INSERT INTO projects VALUES ('old-1', 'Legacy sample');");
  legacyDb.close();

  const upgraded = openDatabase(databasePath);
  assert.equal(upgraded.prepare('SELECT name FROM legacy_projects WHERE id = ?').get('old-1').name, 'Legacy sample');
  assert.equal(upgraded.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'organizations'").get().name, 'organizations');
  upgraded.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
