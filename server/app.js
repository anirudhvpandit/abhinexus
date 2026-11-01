import { randomBytes, randomUUID, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { z } from 'zod';

const scrypt = promisify(scryptCallback);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const rolePermissions = [
  { role: 'owner', permissions: ['organization:admin', 'members:admin', 'portfolio:write', 'project:write', 'tasks:write', 'resources:write', 'finance:write', 'finance:read', 'risks:write', 'audit:read'] },
  { role: 'admin', permissions: ['organization:admin', 'members:admin', 'portfolio:write', 'project:write', 'tasks:write', 'resources:write', 'finance:write', 'finance:read', 'risks:write', 'audit:read'] },
  { role: 'portfolio_manager', permissions: ['portfolio:write', 'project:write', 'tasks:write', 'resources:write', 'finance:read', 'risks:write'] },
  { role: 'project_manager', permissions: ['project:write', 'tasks:write', 'risks:write'] },
  { role: 'team_lead', permissions: ['tasks:write', 'resources:write', 'risks:write'] },
  { role: 'contributor', permissions: ['portfolio:read', 'project:read', 'tasks:read', 'resources:read', 'risks:read'] },
  { role: 'finance_viewer', permissions: ['finance:read'] },
  { role: 'executive_viewer', permissions: ['portfolio:read', 'project:read', 'finance:read', 'reports:read'] },
];
const projectStages = ['Proposed', 'Under Review', 'Approved', 'Planned', 'Active', 'On Hold', 'At Risk', 'Completed', 'Cancelled', 'Archived'];
const taskStatuses = ['Todo', 'In Progress', 'Blocked', 'Done'];
const priorities = ['P1', 'P2', 'P3'];
const financeReaders = ['owner', 'admin', 'portfolio_manager', 'finance_viewer', 'executive_viewer'];
const financeWriters = ['owner', 'admin', 'portfolio_manager'];
const id = () => randomUUID();
const now = () => new Date().toISOString();
const dateOnly = () => new Date().toISOString().slice(0, 10);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const authCookie = process.env.NODE_ENV === 'production' ? '__Host-abhinexus_session' : 'abhinexus_session';
const cookieOptions = `Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;

const projectInput = z.object({
  code: z.string().trim().min(2).max(32).optional(),
  name: z.string().trim().min(2).max(160),
  description: z.string().max(5000).default(''),
  client: z.string().max(160).default(''),
  portfolio_id: z.string().nullable().optional(),
  project_type: z.string().max(80).default('Business'),
  strategic_objective: z.string().max(500).default(''),
  priority: z.enum(priorities).default('P2'),
  lifecycle_stage: z.enum(projectStages).default('Proposed'),
  health: z.enum(['Healthy', 'Watch', 'Critical']).default('Healthy'),
  risk_rating: z.enum(['Low', 'Medium', 'High', 'Critical']).default('Low'),
  project_manager: z.string().max(160).default(''),
  sponsor: z.string().max(160).default(''),
  start_date: z.iso.date().nullable().default(null),
  target_completion_date: z.iso.date().nullable().default(null),
  forecast_completion_date: z.iso.date().nullable().default(null),
  actual_completion_date: z.iso.date().nullable().default(null),
  approved_budget_cents: z.number().int().min(0).max(9_000_000_000_000).default(0),
  planned_progress: z.number().int().min(0).max(100).default(0),
  actual_progress: z.number().int().min(0).max(100).default(0),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
}).strict();

const taskInput = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).default(''),
  acceptance_criteria: z.string().max(3000).default(''),
  status: z.enum(taskStatuses).default('Todo'),
  priority: z.enum(priorities).default('P2'),
  assignee: z.string().max(160).default(''),
  start_date: z.iso.date().nullable().default(null),
  due_date: z.iso.date().nullable().default(null),
  estimated_hours: z.number().min(0).max(100000).default(0),
  actual_hours: z.number().min(0).max(100000).default(0),
}).strict();

const portfolioInput = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000).default(''),
  strategic_objective: z.string().max(500).default(''),
}).strict();

const riskInput = z.object({
  project_id: z.string().uuid(),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(4000).default(''),
  category: z.string().max(80).default('Delivery'),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigation: z.string().max(3000).default(''),
  contingency: z.string().max(3000).default(''),
  owner: z.string().max(160).default(''),
  review_date: z.iso.date().nullable().default(null),
  status: z.enum(['Open', 'Mitigating', 'Accepted', 'Closed']).default('Open'),
  residual_probability: z.number().int().min(1).max(5).default(1),
  residual_impact: z.number().int().min(1).max(5).default(1),
  escalated: z.boolean().default(false),
}).strict();

function parseBody(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation failed',
      fields: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })),
    });

    api.get('/members', requireRole('owner', 'admin'), (req, res) => {
      const members = db.prepare(`
        SELECT u.id, u.name, u.email, m.role, m.created_at
        FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? ORDER BY u.name
      `).all(req.auth.organizationId);
      res.json(members);
    });

    api.get('/roles', requireRole('owner', 'admin'), (_req, res) => res.json(rolePermissions));
    return null;
  }
  return parsed.data;
}

function notifyPrivilegedMembers(db, organizationId, title, message) {
  const recipients = db.prepare(`
    SELECT user_id FROM memberships
    WHERE organization_id = ? AND role IN ('owner','admin','portfolio_manager','executive_viewer')
  `).all(organizationId);
  const insert = db.prepare(`
    INSERT INTO notifications (id, organization_id, user_id, title, message, href, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const timestamp = now();
  for (const recipient of recipients) {
    insert.run(id(), organizationId, recipient.user_id, title, message, '', timestamp);
  }
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function readCookie(req, name) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${authCookie}=${encodeURIComponent(token)}; ${cookieOptions}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${authCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return scrypt(password, salt, 64).then((key) => `scrypt$${salt}$${key.toString('hex')}`);
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, keyHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !keyHex) return false;
  const actual = await scrypt(password, salt, 64);
  const expected = Buffer.from(keyHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function audit(db, auth, action, entityType, entityId, details = {}) {
  db.prepare(`
    INSERT INTO audit_events (id, organization_id, user_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id(), auth.organizationId, auth.userId, action, entityType, entityId, JSON.stringify(details), now());
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}

function projectRows(db, organizationId, filters = {}) {
  const clauses = ['p.organization_id = @organizationId'];
  const values = { organizationId };
  if (filters.q) {
    clauses.push('(p.name LIKE @search OR p.code LIKE @search OR p.client LIKE @search OR p.project_manager LIKE @search)');
    values.search = `%${filters.q}%`;
  }
  if (filters.status) {
    clauses.push('p.lifecycle_stage = @status');
    values.status = filters.status;
  }
  if (filters.portfolio_id) {
    clauses.push('p.portfolio_id = @portfolioId');
    values.portfolioId = filters.portfolio_id;
  }
  const orderBy = filters.sort === 'budget'
    ? 'p.approved_budget_cents DESC'
    : filters.sort === 'due'
      ? 'p.target_completion_date ASC'
      : 'p.updated_at DESC';
  const query = `
    SELECT p.*, po.name AS portfolio_name,
      COALESCE(SUM(CASE WHEN f.entry_type = 'actual' THEN f.amount_cents END), p.actual_cost_cents) AS actual_cost_cents,
      COALESCE(SUM(CASE WHEN f.entry_type = 'forecast' THEN f.amount_cents END), p.forecast_cost_cents) AS forecast_cost_cents
    FROM projects p
    LEFT JOIN portfolios po ON po.id = p.portfolio_id AND po.organization_id = p.organization_id
    LEFT JOIN financial_entries f ON f.project_id = p.id AND f.organization_id = p.organization_id
    WHERE ${clauses.join(' AND ')}
    GROUP BY p.id
    ORDER BY ${orderBy}
  `;
  if (filters.pageLimit !== undefined) {
    const total = db.prepare(`SELECT COUNT(*) AS count FROM projects p WHERE ${clauses.join(' AND ')}`).get(values).count;
    const items = db.prepare(`${query} LIMIT @pageLimit OFFSET @pageOffset`).all({
      ...values,
      pageLimit: filters.pageLimit,
      pageOffset: filters.pageOffset,
    });
    return { items, total };
  }
  return db.prepare(query).all(values);
}

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '1mb' }));

  const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    process.env.APP_ORIGIN,
  ].filter(Boolean));
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  }));

  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again later.' },
  });
  const api = express.Router();
  app.use('/api/v1', api);
  api.use('/auth/register', authLimit);
  api.use('/auth/login', authLimit);

  api.use((req, res, next) => {
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (unsafe && req.headers.origin) {
      const requestHost = req.get('host');
      const origin = req.headers.origin;
      const allowed = allowedOrigins.has(origin) || origin === `${req.protocol}://${requestHost}`;
      if (!allowed) return res.status(403).json({ error: 'Request origin is not allowed.' });
    }

    const token = readCookie(req, authCookie);
    if (token) {
      const session = db.prepare(`
        SELECT s.id AS session_id, s.user_id, s.organization_id, s.expires_at,
          u.email, u.name, m.role, o.name AS organization_name, o.currency, o.is_demo
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        JOIN memberships m ON m.user_id = s.user_id AND m.organization_id = s.organization_id
        JOIN organizations o ON o.id = s.organization_id
        WHERE s.token_hash = ? AND s.expires_at > ?
      `).get(sha256(token), now());
      if (session) {
        req.auth = {
          sessionId: session.session_id,
          userId: session.user_id,
          organizationId: session.organization_id,
          email: session.email,
          name: session.name,
          role: session.role,
          organizationName: session.organization_name,
          currency: session.currency,
          isDemo: Boolean(session.is_demo),
        };
      }
    }

    if (req.path.startsWith('/auth/') && ['register', 'login'].includes(req.path.slice('/auth/'.length))) {
      return next();
    }
    if (!req.auth) return res.status(401).json({ error: 'Authentication required.' });
    return next();
  });

  function createSession(userId, organizationId, res) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare(`
      INSERT INTO sessions (id, user_id, organization_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id(), userId, organizationId, sha256(token), expiresAt, now());
    setSessionCookie(res, token);
  }

  api.post('/auth/register', async (req, res, next) => {
    const parsed = z.object({
      name: z.string().trim().min(2).max(120),
      email: z.email().transform((email) => email.toLowerCase()),
      password: z.string().min(12).max(128),
      organization_name: z.string().trim().min(2).max(120),
      industry: z.string().max(120).default(''),
      size_band: z.string().max(40).default(''),
      currency: z.enum(['USD', 'INR', 'EUR', 'GBP', 'CAD', 'AUD']).default('USD'),
    }).strict().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', fields: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) });
    }

    try {
      const { name, email, password, organization_name, industry, size_band, currency } = parsed.data;
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });
      const userId = id();
      const organizationId = id();
      const passwordHash = await hashPassword(password);
      db.transaction(() => {
        db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(userId, email, name, passwordHash, now());
        db.prepare('INSERT INTO organizations (id, name, industry, size_band, currency, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(organizationId, organization_name, industry, size_band, currency, now());
        db.prepare('INSERT INTO memberships (organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?)')
          .run(organizationId, userId, 'owner', now());
        db.prepare('INSERT INTO portfolios (id, organization_id, name, description, strategic_objective, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id(), organizationId, 'Strategic Initiatives', 'Your first portfolio', 'Connect delivery to business strategy', now(), now());
        db.prepare('INSERT INTO subscriptions (organization_id, plan, status, trial_ends_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(organizationId, 'Starter', 'trial', new Date(Date.now() + 14 * 86400000).toISOString(), now());
        db.prepare('INSERT INTO organization_settings (organization_id, updated_at) VALUES (?, ?)').run(organizationId, now());
      })();
      createSession(userId, organizationId, res);
      return res.status(201).json({
        user: { id: userId, email, name },
        organization: { id: organizationId, name: organization_name, currency },
        role: 'owner',
      });
    } catch (error) {
      return next(error);
    }
  });

  api.post('/auth/login', async (req, res, next) => {
    const parsed = z.object({
      email: z.email().transform((email) => email.toLowerCase()),
      password: z.string().min(1).max(128),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Email and password are required.' });

    try {
      const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(parsed.data.email);
      const passwordValid = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
      if (!user || !passwordValid) return res.status(401).json({ error: 'Email or password is incorrect.' });
      const membership = db.prepare(`
        SELECT m.organization_id, m.role FROM memberships m
        JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1
      `).get(user.id);
      if (!membership) return res.status(403).json({ error: 'This account has no organization membership.' });
      createSession(user.id, membership.organization_id, res);
      audit(db, { userId: user.id, organizationId: membership.organization_id }, 'auth.login', 'session', 'login');
      return res.json({ user: { id: user.id, email: user.email, name: user.name }, organizationId: membership.organization_id, role: membership.role });
    } catch (error) {
      return next(error);
    }
  });

  api.post('/auth/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.auth.sessionId);
    clearSessionCookie(res);
    audit(db, req.auth, 'auth.logout', 'session', req.auth.sessionId);
    res.status(204).end();
  });

  api.get('/auth/me', (req, res) => {
    const memberships = db.prepare(`
      SELECT o.id, o.name, o.currency, m.role
      FROM memberships m JOIN organizations o ON o.id = m.organization_id
      WHERE m.user_id = ? ORDER BY o.name
    `).all(req.auth.userId);
    res.json({
      user: { id: req.auth.userId, name: req.auth.name, email: req.auth.email },
      organization: { id: req.auth.organizationId, name: req.auth.organizationName, currency: req.auth.currency, is_demo: req.auth.isDemo },
      role: req.auth.role,
      memberships,
    });
  });

  api.post('/auth/switch-organization', (req, res) => {
    const parsed = z.object({ organization_id: z.string().uuid() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A valid organization_id is required.' });
    const membership = db.prepare('SELECT organization_id FROM memberships WHERE organization_id = ? AND user_id = ?')
      .get(parsed.data.organization_id, req.auth.userId);
    if (!membership) return res.status(403).json({ error: 'You are not a member of that organization.' });
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.auth.sessionId);
    createSession(req.auth.userId, membership.organization_id, res);
    return res.json({ organization_id: membership.organization_id });
  });

  api.get('/organizations', (req, res) => {
    res.json(db.prepare(`
      SELECT o.id, o.name, o.industry, o.size_band, o.currency, m.role
      FROM organizations o JOIN memberships m ON m.organization_id = o.id
      WHERE m.user_id = ? ORDER BY o.name
    `).all(req.auth.userId));
  });

  api.get('/portfolios', (req, res) => {
    const rows = db.prepare(`
      SELECT po.*, COUNT(p.id) AS project_count
      FROM portfolios po LEFT JOIN projects p ON p.portfolio_id = po.id AND p.organization_id = po.organization_id
      WHERE po.organization_id = ? GROUP BY po.id ORDER BY po.name
    `).all(req.auth.organizationId);
    res.json(rows);
  });

  api.post('/portfolios', requireRole('owner', 'admin', 'portfolio_manager'), (req, res) => {
    const data = parseBody(portfolioInput, req, res);
    if (!data) return;
    const portfolio = { id: id(), organization_id: req.auth.organizationId, ...data, created_at: now(), updated_at: now() };
    try {
      db.prepare(`
        INSERT INTO portfolios (id, organization_id, name, description, strategic_objective, created_at, updated_at)
        VALUES (@id, @organization_id, @name, @description, @strategic_objective, @created_at, @updated_at)
      `).run(portfolio);
      audit(db, req.auth, 'portfolio.create', 'portfolio', portfolio.id);
      res.status(201).json(portfolio);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'A portfolio with that name already exists.' });
      throw error;
    }
  });

  api.patch('/portfolios/:id', requireRole('owner', 'admin', 'portfolio_manager'), (req, res) => {
    const existing = db.prepare('SELECT * FROM portfolios WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth.organizationId);
    if (!existing) return res.status(404).json({ error: 'Portfolio not found.' });
    const data = parseBody(portfolioInput.partial(), req, res);
    if (!data) return;
    const updated = { ...existing, ...data, updated_at: now() };
    try {
      db.prepare(`
        UPDATE portfolios SET name = @name, description = @description, strategic_objective = @strategic_objective, updated_at = @updated_at
        WHERE id = @id AND organization_id = @organization_id
      `).run(updated);
      audit(db, req.auth, 'portfolio.update', 'portfolio', existing.id);
      res.json(updated);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'A portfolio with that name already exists.' });
      throw error;
    }
  });

  api.delete('/portfolios/:id', requireRole('owner', 'admin', 'portfolio_manager'), (req, res) => {
    const portfolio = db.prepare('SELECT id FROM portfolios WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth.organizationId);
    if (!portfolio) return res.status(404).json({ error: 'Portfolio not found.' });
    db.transaction(() => {
      db.prepare('UPDATE projects SET portfolio_id = NULL, updated_at = ? WHERE portfolio_id = ? AND organization_id = ?')
        .run(now(), portfolio.id, req.auth.organizationId);
      db.prepare('DELETE FROM portfolios WHERE id = ? AND organization_id = ?').run(portfolio.id, req.auth.organizationId);
    })();
    audit(db, req.auth, 'portfolio.delete', 'portfolio', portfolio.id);
    res.status(204).end();
  });

  api.get('/projects', (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
    const rows = projectRows(db, req.auth.organizationId, {
      q: typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : '',
      status: typeof req.query.status === 'string' && projectStages.includes(req.query.status) ? req.query.status : '',
      portfolio_id: typeof req.query.portfolio_id === 'string' ? req.query.portfolio_id : '',
      sort: financeReaders.includes(req.auth.role) ? req.query.sort : 'updated',
      pageLimit: limit,
      pageOffset: (page - 1) * limit,
    });
    const visibleRows = financeReaders.includes(req.auth.role)
      ? rows.items
      : rows.items.map(({ approved_budget_cents: _budget, actual_cost_cents: _actual, forecast_cost_cents: _forecast, ...project }) => project);
    res.json({ items: visibleRows, total: rows.total, page, limit });
  });

  api.post('/projects', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager'), (req, res) => {
    const data = parseBody(projectInput, req, res);
    if (!data) return;
    if (!financeWriters.includes(req.auth.role) && data.approved_budget_cents > 0) {
      return res.status(403).json({ error: 'Your role cannot set project budget values.' });
    }
    if (data.target_completion_date && data.start_date && data.target_completion_date < data.start_date) {
      return res.status(400).json({ error: 'Target completion must be on or after the project start date.' });
    }
    if (data.portfolio_id && !db.prepare('SELECT id FROM portfolios WHERE id = ? AND organization_id = ?').get(data.portfolio_id, req.auth.organizationId)) {
      return res.status(400).json({ error: 'Portfolio does not belong to this organization.' });
    }
    const project = {
      id: id(),
      organization_id: req.auth.organizationId,
      code: data.code || `PRJ-${randomBytes(3).toString('hex').toUpperCase()}`,
      ...data,
      tags: JSON.stringify(data.tags),
      created_at: now(),
      updated_at: now(),
    };
    try {
      db.prepare(`
        INSERT INTO projects (
          id, organization_id, portfolio_id, code, name, description, client, project_type,
          strategic_objective, priority, lifecycle_stage, health, risk_rating, project_manager,
          sponsor, start_date, target_completion_date, forecast_completion_date, actual_completion_date,
          approved_budget_cents, planned_progress, actual_progress, tags, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @portfolio_id, @code, @name, @description, @client, @project_type,
          @strategic_objective, @priority, @lifecycle_stage, @health, @risk_rating, @project_manager,
          @sponsor, @start_date, @target_completion_date, @forecast_completion_date, @actual_completion_date,
          @approved_budget_cents, @planned_progress, @actual_progress, @tags, @created_at, @updated_at
        )
      `).run(project);
      audit(db, req.auth, 'project.create', 'project', project.id, { code: project.code });
      res.status(201).json({ ...project, tags: data.tags });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Project code already exists in this organization.' });
      throw error;
    }
  });

  api.patch('/projects/:id', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager'), (req, res) => {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth.organizationId);
    if (!existing) return res.status(404).json({ error: 'Project not found.' });
    const data = parseBody(projectInput.partial(), req, res);
    if (!data) return;
    if (Object.hasOwn(data, 'approved_budget_cents') && !financeWriters.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Your role cannot change project budget values.' });
    }
    const updated = { ...existing, ...data, updated_at: now() };
    if (updated.target_completion_date && updated.start_date && updated.target_completion_date < updated.start_date) {
      return res.status(400).json({ error: 'Target completion must be on or after the project start date.' });
    }
    if (updated.portfolio_id && !db.prepare('SELECT id FROM portfolios WHERE id = ? AND organization_id = ?').get(updated.portfolio_id, req.auth.organizationId)) {
      return res.status(400).json({ error: 'Portfolio does not belong to this organization.' });
    }
    try {
      db.prepare(`
        UPDATE projects SET
          portfolio_id = @portfolio_id, code = @code, name = @name, description = @description,
          client = @client, project_type = @project_type, strategic_objective = @strategic_objective,
          priority = @priority, lifecycle_stage = @lifecycle_stage, health = @health, risk_rating = @risk_rating,
          project_manager = @project_manager, sponsor = @sponsor, start_date = @start_date,
          target_completion_date = @target_completion_date, forecast_completion_date = @forecast_completion_date,
          actual_completion_date = @actual_completion_date, approved_budget_cents = @approved_budget_cents,
          planned_progress = @planned_progress, actual_progress = @actual_progress, tags = @tags, updated_at = @updated_at
        WHERE id = @id AND organization_id = @organization_id
      `).run({ ...updated, tags: typeof updated.tags === 'string' ? updated.tags : JSON.stringify(updated.tags) });
      audit(db, req.auth, 'project.update', 'project', existing.id);
      res.json({ ...updated, tags: typeof updated.tags === 'string' ? JSON.parse(updated.tags) : updated.tags });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Project code already exists in this organization.' });
      throw error;
    }
  });

  api.delete('/projects/:id', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager'), (req, res) => {
    const result = db.prepare('DELETE FROM projects WHERE id = ? AND organization_id = ?').run(req.params.id, req.auth.organizationId);
    if (!result.changes) return res.status(404).json({ error: 'Project not found.' });
    audit(db, req.auth, 'project.delete', 'project', req.params.id);
    res.status(204).end();
  });

  api.get('/tasks', (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 100));
    const projectResult = z.string().uuid().optional().safeParse(req.query.project_id);
    if (!projectResult.success) return res.status(400).json({ error: 'Invalid project_id filter.' });
    const projectId = projectResult.data || null;
    const rows = db.prepare(`
      SELECT t.*, p.name AS project_name,
        EXISTS (
          SELECT 1 FROM task_dependencies d
          JOIN tasks predecessor ON predecessor.id = d.predecessor_id AND predecessor.organization_id = d.organization_id
          WHERE d.organization_id = t.organization_id AND d.successor_id = t.id AND predecessor.status <> 'Done'
        ) AS blocked_by_dependency
      FROM tasks t JOIN projects p ON p.id = t.project_id AND p.organization_id = t.organization_id
      WHERE t.organization_id = ? AND (? IS NULL OR t.project_id = ?)
      ORDER BY CASE t.priority WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END, t.due_date, t.id
      LIMIT ? OFFSET ?
    `).all(req.auth.organizationId, projectId, projectId, limit, (page - 1) * limit);
    const total = db.prepare('SELECT COUNT(*) AS count FROM tasks WHERE organization_id = ? AND (? IS NULL OR project_id = ?)')
      .get(req.auth.organizationId, projectId, projectId).count;
    res.json({ items: rows, total, page, limit });
  });

  api.post('/tasks', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const data = parseBody(taskInput, req, res);
    if (!data) return;
    if (data.start_date && data.due_date && data.due_date < data.start_date) return res.status(400).json({ error: 'Task due date must be on or after its start date.' });
    const task = { id: id(), organization_id: req.auth.organizationId, ...data, created_at: now(), updated_at: now() };
    try {
      db.prepare(`
        INSERT INTO tasks (id, organization_id, project_id, title, description, acceptance_criteria, status, priority, assignee, start_date, due_date, estimated_hours, actual_hours, created_at, updated_at)
        VALUES (@id, @organization_id, @project_id, @title, @description, @acceptance_criteria, @status, @priority, @assignee, @start_date, @due_date, @estimated_hours, @actual_hours, @created_at, @updated_at)
      `).run(task);
      audit(db, req.auth, 'task.create', 'task', task.id, { project_id: task.project_id });
      res.status(201).json(task);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Project does not belong to this organization.' });
      throw error;
    }
  });

  api.patch('/tasks/:id', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth.organizationId);
    if (!existing) return res.status(404).json({ error: 'Task not found.' });
    const data = parseBody(taskInput.partial(), req, res);
    if (!data) return;
    const updated = { ...existing, ...data, updated_at: now() };
    if (updated.start_date && updated.due_date && updated.due_date < updated.start_date) return res.status(400).json({ error: 'Task due date must be on or after its start date.' });
    if (updated.project_id !== existing.project_id) {
      const relationships = db.prepare('SELECT COUNT(*) AS count FROM task_dependencies WHERE organization_id = ? AND (predecessor_id = ? OR successor_id = ?)')
        .get(req.auth.organizationId, existing.id, existing.id).count;
      if (relationships) return res.status(400).json({ error: 'Tasks with dependencies cannot be moved to another project.' });
      if (!db.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(updated.project_id, req.auth.organizationId)) {
        return res.status(400).json({ error: 'Project does not belong to this organization.' });
      }
    }
    const dependencies = db.prepare(`
      SELECT p.status, p.due_date, d.dependency_type FROM task_dependencies d JOIN tasks p ON p.id = d.predecessor_id AND p.organization_id = d.organization_id
      WHERE d.organization_id = ? AND d.successor_id = ?
    `).all(req.auth.organizationId, existing.id);
    if (dependencies.some((dependency) => dependency.dependency_type === 'FS' && dependency.due_date && updated.start_date && updated.start_date < dependency.due_date)) {
      return res.status(400).json({ error: 'Task start date must not precede the finish date of its prerequisite.' });
    }
    if (updated.status === 'Done' && dependencies.some(({ status, dependency_type }) => dependency_type === 'FS' && status !== 'Done')) {
      return res.status(409).json({ error: 'Complete prerequisite tasks before marking this task done.' });
    }
    const dependents = db.prepare(`
      SELECT t.start_date FROM task_dependencies d JOIN tasks t ON t.id = d.successor_id AND t.organization_id = d.organization_id
      WHERE d.organization_id = ? AND d.predecessor_id = ? AND d.dependency_type = 'FS'
    `).all(req.auth.organizationId, existing.id);
    if (updated.due_date && dependents.some(({ start_date }) => start_date && start_date < updated.due_date)) {
      return res.status(400).json({ error: 'Task finish date cannot be moved past a dependent task start date.' });
    }
    db.prepare(`
      UPDATE tasks SET project_id = @project_id, title = @title, description = @description,
        acceptance_criteria = @acceptance_criteria, status = @status, priority = @priority,
        assignee = @assignee, start_date = @start_date, due_date = @due_date,
        estimated_hours = @estimated_hours, actual_hours = @actual_hours, updated_at = @updated_at
      WHERE id = @id AND organization_id = @organization_id
    `).run(updated);
    audit(db, req.auth, 'task.update', 'task', existing.id);
    res.json(updated);
  });

  api.delete('/tasks/:id', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager'), (req, res) => {
    const result = db.prepare('DELETE FROM tasks WHERE id = ? AND organization_id = ?').run(req.params.id, req.auth.organizationId);
    if (!result.changes) return res.status(404).json({ error: 'Task not found.' });
    audit(db, req.auth, 'task.delete', 'task', req.params.id);
    res.status(204).end();
  });

  api.post('/tasks/:id/dependencies', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const parsed = z.object({
      predecessor_id: z.string().uuid(),
      dependency_type: z.literal('FS').default('FS'),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'A valid predecessor_id and dependency_type are required.' });
    const successor = db.prepare('SELECT id, project_id, start_date FROM tasks WHERE id = ? AND organization_id = ?')
      .get(req.params.id, req.auth.organizationId);
    const predecessor = db.prepare('SELECT id, project_id, due_date FROM tasks WHERE id = ? AND organization_id = ?')
      .get(parsed.data.predecessor_id, req.auth.organizationId);
    if (!successor || !predecessor) return res.status(404).json({ error: 'Task not found.' });
    if (successor.project_id !== predecessor.project_id) return res.status(400).json({ error: 'Dependencies must belong to the same project.' });
    if (predecessor.due_date && successor.start_date && successor.start_date < predecessor.due_date) {
      return res.status(400).json({ error: 'Successor task starts before its prerequisite finishes.' });
    }
    const path = db.prepare(`
      WITH RECURSIVE reachable(id) AS (
        SELECT successor_id FROM task_dependencies WHERE organization_id = ? AND predecessor_id = ?
        UNION
        SELECT d.successor_id FROM task_dependencies d JOIN reachable r ON d.predecessor_id = r.id
        WHERE d.organization_id = ?
      )
      SELECT 1 FROM reachable WHERE id = ? LIMIT 1
    `).get(req.auth.organizationId, successor.id, req.auth.organizationId, predecessor.id);
    if (path) return res.status(409).json({ error: 'This dependency would create a cycle.' });
    db.prepare(`
      INSERT INTO task_dependencies (organization_id, predecessor_id, successor_id, dependency_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.auth.organizationId, predecessor.id, successor.id, parsed.data.dependency_type, now());
    audit(db, req.auth, 'task.dependency.create', 'task', successor.id, { predecessor_id: predecessor.id, type: parsed.data.dependency_type });
    res.status(201).json({ predecessor_id: predecessor.id, successor_id: successor.id, dependency_type: parsed.data.dependency_type });
  });

  api.get('/milestones', (req, res) => {
    res.json(db.prepare(`
      SELECT m.*, p.name AS project_name FROM milestones m
      JOIN projects p ON p.id = m.project_id AND p.organization_id = m.organization_id
      WHERE m.organization_id = ? ORDER BY m.due_date
    `).all(req.auth.organizationId));
  });

  api.post('/milestones', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const parsed = z.object({
      project_id: z.string().uuid(),
      name: z.string().trim().min(2).max(180),
      due_date: z.iso.date(),
      status: z.enum(['On track','Needs attention','Delayed','Complete']).default('On track'),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid milestone fields.', fields: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) });
    const milestone = { id: id(), organization_id: req.auth.organizationId, ...parsed.data, created_at: now(), updated_at: now() };
    try {
      db.prepare('INSERT INTO milestones (id, organization_id, project_id, name, due_date, status, created_at, updated_at) VALUES (@id, @organization_id, @project_id, @name, @due_date, @status, @created_at, @updated_at)')
        .run(milestone);
      audit(db, req.auth, 'milestone.create', 'milestone', milestone.id);
      res.status(201).json(milestone);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Project does not belong to this organization.' });
      throw error;
    }
  });

  api.patch('/milestones/:id', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const parsed = z.object({
      name: z.string().trim().min(2).max(180).optional(),
      due_date: z.iso.date().optional(),
      status: z.enum(['On track','Needs attention','Delayed','Complete']).optional(),
    }).strict().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data || {}).length) return res.status(400).json({ error: 'Provide valid milestone fields to update.' });
    const result = db.prepare('UPDATE milestones SET name = COALESCE(@name, name), due_date = COALESCE(@due_date, due_date), status = COALESCE(@status, status), updated_at = @updated_at WHERE id = @id AND organization_id = @organization_id')
      .run({ ...parsed.data, id: req.params.id, organization_id: req.auth.organizationId, updated_at: now() });
    if (!result.changes) return res.status(404).json({ error: 'Milestone not found.' });
    audit(db, req.auth, 'milestone.update', 'milestone', req.params.id);
    res.json(db.prepare('SELECT * FROM milestones WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth.organizationId));
  });

  api.get('/resources', (req, res) => {
    const weekStart = dateOnly();
    const resources = db.prepare('SELECT * FROM resources WHERE organization_id = ? ORDER BY department, name').all(req.auth.organizationId);
    const activeAssignments = db.prepare(`
      SELECT a.*, p.name AS project_name, r.name AS resource_name, r.weekly_capacity_hours
      FROM assignments a
      JOIN projects p ON p.id = a.project_id AND p.organization_id = a.organization_id
      JOIN resources r ON r.id = a.resource_id AND r.organization_id = a.organization_id
      WHERE a.organization_id = ? AND a.start_date <= ? AND a.end_date >= ?
    `).all(req.auth.organizationId, weekStart, weekStart);
    const utilization = new Map(resources.map((resource) => [resource.id, 0]));
    for (const assignment of activeAssignments) utilization.set(assignment.resource_id, utilization.get(assignment.resource_id) + assignment.allocation_percent);
    res.json({
      resources: resources.map((resource) => ({
        ...resource,
        allocated_percent: utilization.get(resource.id) || 0,
        utilization_percent: resource.weekly_capacity_hours > 0 ? Math.round((utilization.get(resource.id) || 0)) : 0,
      })),
      assignments: activeAssignments,
    });
  });

  api.post('/resources', requireRole('owner', 'admin', 'portfolio_manager', 'team_lead'), (req, res) => {
    const parsed = z.object({
      name: z.string().trim().min(2).max(160),
      role: z.string().max(120).default(''),
      department: z.string().max(120).default(''),
      location: z.string().max(120).default(''),
      weekly_capacity_hours: z.number().min(0).max(168).default(30),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid resource fields.', fields: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) });
    const resource = { id: id(), organization_id: req.auth.organizationId, ...parsed.data, created_at: now(), updated_at: now() };
    db.prepare('INSERT INTO resources (id, organization_id, name, role, department, location, weekly_capacity_hours, created_at, updated_at) VALUES (@id, @organization_id, @name, @role, @department, @location, @weekly_capacity_hours, @created_at, @updated_at)')
      .run(resource);
    audit(db, req.auth, 'resource.create', 'resource', resource.id);
    res.status(201).json(resource);
  });

  api.post('/assignments', requireRole('owner', 'admin', 'portfolio_manager', 'team_lead'), (req, res) => {
    const parsed = z.object({
      project_id: z.string().uuid(),
      resource_id: z.string().uuid(),
      allocation_percent: z.number().min(1).max(100),
      start_date: z.iso.date(),
      end_date: z.iso.date(),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid assignment fields.' });
    const { project_id, resource_id, allocation_percent, start_date, end_date } = parsed.data;
    if (end_date < start_date) return res.status(400).json({ error: 'Assignment end date must be on or after its start date.' });
    const resource = db.prepare('SELECT weekly_capacity_hours FROM resources WHERE id = ? AND organization_id = ?').get(resource_id, req.auth.organizationId);
    if (!resource) return res.status(400).json({ error: 'Resource does not belong to this organization.' });
    if (resource.weekly_capacity_hours <= 0) return res.status(409).json({ error: 'Resource has zero available weekly capacity and cannot be assigned.' });
    const overlaps = db.prepare(`
      SELECT start_date, end_date, allocation_percent FROM assignments
      WHERE organization_id = ? AND resource_id = ? AND start_date <= ? AND end_date >= ?
    `).all(req.auth.organizationId, resource_id, end_date, start_date);
    const events = [{ date: start_date, delta: allocation_percent }];
    for (const overlap of overlaps) {
      const overlapStart = overlap.start_date > start_date ? overlap.start_date : start_date;
      const overlapEnd = overlap.end_date < end_date ? overlap.end_date : end_date;
      events.push({ date: overlapStart, delta: overlap.allocation_percent });
      const dayAfterEnd = new Date(`${overlapEnd}T00:00:00Z`);
      dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1);
      events.push({ date: dayAfterEnd.toISOString().slice(0, 10), delta: -overlap.allocation_percent });
    }
    const assignmentEnd = new Date(`${end_date}T00:00:00Z`);
    assignmentEnd.setUTCDate(assignmentEnd.getUTCDate() + 1);
    events.push({ date: assignmentEnd.toISOString().slice(0, 10), delta: -allocation_percent });
    events.sort((left, right) => left.date.localeCompare(right.date) || left.delta - right.delta);
    let activeAllocation = 0;
    let maxAllocation = 0;
    for (const event of events) {
      activeAllocation += event.delta;
      maxAllocation = Math.max(maxAllocation, activeAllocation);
    }
    if (maxAllocation > 100) {
      return res.status(409).json({ error: `Assignment exceeds available capacity by ${Math.round(maxAllocation - 100)} percentage points during an overlapping period.` });
    }
    const assignment = { id: id(), organization_id: req.auth.organizationId, project_id, resource_id, allocation_percent, start_date, end_date, created_at: now() };
    try {
      db.prepare('INSERT INTO assignments (id, organization_id, project_id, resource_id, allocation_percent, start_date, end_date, created_at) VALUES (@id, @organization_id, @project_id, @resource_id, @allocation_percent, @start_date, @end_date, @created_at)')
        .run(assignment);
      audit(db, req.auth, 'assignment.create', 'assignment', assignment.id);
      res.status(201).json(assignment);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Project or resource does not belong to this organization.' });
      throw error;
    }
  });

  api.get('/finance', requireRole('owner', 'admin', 'portfolio_manager', 'finance_viewer', 'executive_viewer'), (req, res) => {
    const entries = db.prepare(`
      SELECT f.*, p.code AS project_code, p.name AS project_name
      FROM financial_entries f JOIN projects p ON p.id = f.project_id AND p.organization_id = f.organization_id
      WHERE f.organization_id = ? ORDER BY f.entry_date DESC
    `).all(req.auth.organizationId);
    const projects = projectRows(db, req.auth.organizationId);
    res.json({
      currency: req.auth.currency,
      entries,
      summary: projects.reduce((summary, project) => ({
        budget_cents: summary.budget_cents + project.approved_budget_cents,
        actual_cents: summary.actual_cents + project.actual_cost_cents,
        forecast_cents: summary.forecast_cents + project.forecast_cost_cents,
      }), { budget_cents: 0, actual_cents: 0, forecast_cents: 0 }),
      projects: projects.map((project) => ({
        id: project.id, code: project.code, name: project.name,
        budget_cents: project.approved_budget_cents,
        actual_cents: project.actual_cost_cents,
        forecast_cents: project.forecast_cost_cents,
        variance_cents: project.approved_budget_cents - project.actual_cost_cents,
        forecast_variance_cents: project.approved_budget_cents - project.forecast_cost_cents,
      })),
    });
  });

  api.post('/finance/entries', requireRole('owner', 'admin'), (req, res) => {
    const parsed = z.object({
      project_id: z.string().uuid(),
      entry_type: z.enum(['actual','forecast']),
      amount_cents: z.number().int().min(0).max(9_000_000_000_000),
      entry_date: z.iso.date(),
      memo: z.string().max(500).default(''),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid financial entry.', fields: parsed.error.issues.map(({ path, message }) => ({ field: path.join('.'), message })) });
    const entry = { id: id(), organization_id: req.auth.organizationId, ...parsed.data, created_at: now() };
    try {
      db.transaction(() => {
        db.prepare('INSERT INTO financial_entries (id, organization_id, project_id, entry_type, amount_cents, entry_date, memo, created_at) VALUES (@id, @organization_id, @project_id, @entry_type, @amount_cents, @entry_date, @memo, @created_at)')
          .run(entry);
        const totals = db.prepare(`
          SELECT
            SUM(CASE WHEN entry_type = 'actual' THEN amount_cents END) AS actual,
            SUM(CASE WHEN entry_type = 'forecast' THEN amount_cents END) AS forecast
          FROM financial_entries WHERE organization_id = ? AND project_id = ?
        `).get(req.auth.organizationId, entry.project_id);
        db.prepare(`
          UPDATE projects SET
            actual_cost_cents = COALESCE(?, actual_cost_cents),
            forecast_cost_cents = COALESCE(?, forecast_cost_cents),
            updated_at = ?
          WHERE id = ? AND organization_id = ?
        `).run(totals.actual, totals.forecast, now(), entry.project_id, req.auth.organizationId);
        audit(db, req.auth, 'finance.entry.create', 'financial_entry', entry.id, { entry_type: entry.entry_type });
      })();
      res.status(201).json(entry);
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Project does not belong to this organization.' });
      throw error;
    }
  });

  api.get('/risks', (req, res) => {
    const risks = db.prepare(`
      SELECT r.*, p.name AS project_name, r.probability * r.impact AS inherent_score,
        r.residual_probability * r.residual_impact AS residual_score
      FROM risks r JOIN projects p ON p.id = r.project_id AND p.organization_id = r.organization_id
      WHERE r.organization_id = ? ORDER BY inherent_score DESC
    `).all(req.auth.organizationId);
    res.json(risks);
  });

  api.post('/risks', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const data = parseBody(riskInput, req, res);
    if (!data) return;
    const risk = {
      id: id(), organization_id: req.auth.organizationId, ...data,
      escalated: data.escalated ? 1 : 0, created_at: now(), updated_at: now(),
    };
    try {
      db.prepare(`
        INSERT INTO risks (
          id, organization_id, project_id, title, description, category, probability, impact,
          mitigation, contingency, owner, review_date, status, residual_probability,
          residual_impact, escalated, created_at, updated_at
        ) VALUES (
          @id, @organization_id, @project_id, @title, @description, @category, @probability, @impact,
          @mitigation, @contingency, @owner, @review_date, @status, @residual_probability,
          @residual_impact, @escalated, @created_at, @updated_at
        )
      `).run(risk);
      audit(db, req.auth, 'risk.create', 'risk', risk.id, { severity_score: risk.probability * risk.impact });
        if (risk.probability * risk.impact >= 20 || risk.escalated) {
          notifyPrivilegedMembers(db, req.auth.organizationId, 'High risk requires attention', risk.title);
        }
      res.status(201).json({ ...risk, inherent_score: risk.probability * risk.impact, residual_score: risk.residual_probability * risk.residual_impact });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({ error: 'Project does not belong to this organization.' });
      throw error;
    }
  });

  api.patch('/risks/:id', requireRole('owner', 'admin', 'portfolio_manager', 'project_manager', 'team_lead'), (req, res) => {
    const existing = db.prepare('SELECT * FROM risks WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth.organizationId);
    if (!existing) return res.status(404).json({ error: 'Risk not found.' });
    const data = parseBody(riskInput.partial(), req, res);
    if (!data) return;
    const updated = { ...existing, ...data, escalated: data.escalated === undefined ? existing.escalated : Number(data.escalated), updated_at: now() };
    if (updated.project_id !== existing.project_id && !db.prepare('SELECT id FROM projects WHERE id = ? AND organization_id = ?').get(updated.project_id, req.auth.organizationId)) {
      return res.status(400).json({ error: 'Project does not belong to this organization.' });
    }
    db.prepare(`
      UPDATE risks SET project_id = @project_id, title = @title, description = @description,
        category = @category, probability = @probability, impact = @impact, mitigation = @mitigation,
        contingency = @contingency, owner = @owner, review_date = @review_date, status = @status,
        residual_probability = @residual_probability, residual_impact = @residual_impact,
        escalated = @escalated, updated_at = @updated_at
      WHERE id = @id AND organization_id = @organization_id
    `).run(updated);
    audit(db, req.auth, 'risk.update', 'risk', existing.id);
    res.json({ ...updated, inherent_score: updated.probability * updated.impact, residual_score: updated.residual_probability * updated.residual_impact });
  });

  api.get('/dashboard', (req, res) => {
    const organizationId = req.auth.organizationId;
    const projects = projectRows(db, organizationId);
    const today = dateOnly();
    const active = projects.filter(({ lifecycle_stage }) => !['Completed','Cancelled','Archived'].includes(lifecycle_stage));
    const completed = projects.filter(({ lifecycle_stage }) => lifecycle_stage === 'Completed');
    const atRisk = projects.filter(({ lifecycle_stage, health, risk_rating }) => lifecycle_stage === 'At Risk' || health === 'Critical' || risk_rating === 'Critical');
    const completedOnTime = completed.filter(({ target_completion_date, actual_completion_date }) => target_completion_date && actual_completion_date && actual_completion_date <= target_completion_date);
    const milestones = db.prepare("SELECT COUNT(*) AS count FROM milestones WHERE organization_id = ? AND status <> 'Complete' AND due_date < ?").get(organizationId, today);
    const blockedTasks = db.prepare(`
      SELECT COUNT(*) AS count FROM tasks t WHERE t.organization_id = ? AND EXISTS (
        SELECT 1 FROM task_dependencies d
        JOIN tasks p ON p.id = d.predecessor_id AND p.organization_id = d.organization_id
        WHERE d.organization_id = t.organization_id AND d.successor_id = t.id AND p.status <> 'Done'
      )
    `).get(organizationId);
    const criticalRisks = db.prepare("SELECT COUNT(*) AS count FROM risks WHERE organization_id = ? AND status <> 'Closed' AND probability * impact >= 20").get(organizationId);
    const resources = db.prepare('SELECT id, weekly_capacity_hours FROM resources WHERE organization_id = ?').all(organizationId);
    const currentAssignments = db.prepare('SELECT resource_id, allocation_percent FROM assignments WHERE organization_id = ? AND start_date <= ? AND end_date >= ?')
      .all(organizationId, today, today);
    const allocatedByResource = new Map(resources.map(({ id: resourceId }) => [resourceId, 0]));
    for (const assignment of currentAssignments) allocatedByResource.set(assignment.resource_id, allocatedByResource.get(assignment.resource_id) + assignment.allocation_percent);
    const totalCapacity = resources.reduce((sum, resource) => sum + resource.weekly_capacity_hours, 0);
    const allocatedHours = resources.reduce((sum, resource) => sum + resource.weekly_capacity_hours * Math.min(100, allocatedByResource.get(resource.id) || 0) / 100, 0);
    const portfolioHealth = projects.reduce((acc, project) => {
      if (project.lifecycle_stage === 'At Risk' || project.health === 'Critical') acc.atRisk += 1;
      else if (['Completed','Cancelled','Archived'].includes(project.lifecycle_stage)) acc.complete += 1;
      else acc.onTrack += 1;
      return acc;
    }, { onTrack: 0, atRisk: 0, complete: 0 });
    const budgetCents = projects.reduce((sum, project) => sum + project.approved_budget_cents, 0);
    const actualCents = projects.reduce((sum, project) => sum + project.actual_cost_cents, 0);
    const forecastCents = projects.reduce((sum, project) => sum + project.forecast_cost_cents, 0);
    const actions = db.prepare(`
      SELECT 'risk' AS kind, r.id, r.title, r.owner, r.review_date AS due_date, r.probability * r.impact AS score
      FROM risks r WHERE r.organization_id = ? AND r.status <> 'Closed'
      UNION ALL
      SELECT 'milestone' AS kind, m.id, m.name AS title, '' AS owner, m.due_date, 0 AS score
      FROM milestones m WHERE m.organization_id = ? AND m.status <> 'Complete'
      ORDER BY score DESC, due_date LIMIT 8
    `).all(organizationId, organizationId);
    const financialsVisible = financeReaders.includes(req.auth.role);
    const safeProjects = financialsVisible
      ? projects.slice(0, 8)
      : projects.slice(0, 8).map(({ approved_budget_cents: _budget, actual_cost_cents: _actual, forecast_cost_cents: _forecast, ...project }) => project);
    res.json({
      organization: { name: req.auth.organizationName, currency: req.auth.currency },
      summary: {
        active_projects: active.length,
        completed_projects: completed.length,
        projects_at_risk: atRisk.length,
        on_time_delivery_rate: completed.length ? Math.round(completedOnTime.length * 100 / completed.length) : null,
        financials_visible: financialsVisible,
        budget_cents: financialsVisible ? budgetCents : null,
        actual_cents: financialsVisible ? actualCents : null,
        forecast_cents: financialsVisible ? forecastCents : null,
        budget_variance_cents: financialsVisible ? budgetCents - actualCents : null,
        resource_utilization_percent: totalCapacity ? Math.round(allocatedHours * 100 / totalCapacity) : 0,
        overallocated_resources: [...allocatedByResource.values()].filter((allocation) => allocation > 100).length,
        overdue_milestones: milestones.count,
        blocked_tasks: blockedTasks.count,
        open_critical_risks: criticalRisks.count,
        portfolio_progress: active.length ? Math.round(active.reduce((sum, project) => sum + project.actual_progress, 0) / active.length) : 0,
      },
      status_distribution: portfolioHealth,
      projects: safeProjects,
      action_items: actions,
      illustrative_data: req.auth.isDemo,
    });
  });

  api.get('/search', (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (query.length < 2) return res.json({ projects: [], tasks: [], portfolios: [] });
    const term = `%${query}%`;
    const organizationId = req.auth.organizationId;
    res.json({
      projects: db.prepare('SELECT id, code, name FROM projects WHERE organization_id = ? AND (name LIKE ? OR code LIKE ?) LIMIT 10').all(organizationId, term, term),
      tasks: db.prepare('SELECT id, title, project_id FROM tasks WHERE organization_id = ? AND title LIKE ? LIMIT 10').all(organizationId, term),
      portfolios: db.prepare('SELECT id, name FROM portfolios WHERE organization_id = ? AND name LIKE ? LIMIT 10').all(organizationId, term),
    });
  });

  api.get('/reports/portfolio.csv', requireRole('owner', 'admin', 'portfolio_manager', 'finance_viewer', 'executive_viewer'), (req, res) => {
    const projects = projectRows(db, req.auth.organizationId);
    const lines = [
      ['Code','Project','Portfolio','Lifecycle','Health','Priority','Budget cents','Actual cents','Forecast cents','Budget variance cents','Progress'],
      ...projects.map((project) => [
        project.code, project.name, project.portfolio_name, project.lifecycle_stage, project.health,
        project.priority, project.approved_budget_cents, project.actual_cost_cents,
        project.forecast_cost_cents, project.approved_budget_cents - project.actual_cost_cents, project.actual_progress,
      ]),
    ].map((row) => row.map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="abhinexus-portfolio.csv"');
    res.send(`\uFEFF${lines.join('\r\n')}`);
  });

  api.get('/reports/risk-register.csv', requireRole('owner', 'admin', 'portfolio_manager', 'executive_viewer'), (req, res) => {
    const risks = db.prepare('SELECT title, category, probability, impact, probability * impact AS score, owner, status, mitigation, review_date FROM risks WHERE organization_id = ? ORDER BY score DESC').all(req.auth.organizationId);
    const rows = [['Title','Category','Probability (1-5)','Impact (1-5)','Score','Owner','Status','Mitigation','Review date'], ...risks.map((risk) => Object.values(risk))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="abhinexus-risk-register.csv"');
    res.send(`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`);
  });

  api.get('/notifications', (req, res) => {
    res.json(db.prepare('SELECT * FROM notifications WHERE organization_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(req.auth.organizationId, req.auth.userId));
  });

  api.patch('/notifications/:id/read', (req, res) => {
    const result = db.prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND organization_id = ? AND user_id = ?')
      .run(now(), req.params.id, req.auth.organizationId, req.auth.userId);
    if (!result.changes) return res.status(404).json({ error: 'Notification not found.' });
    res.status(204).end();
  });

  api.get('/admin/audit', requireRole('owner', 'admin'), (req, res) => {
    const events = db.prepare(`
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.name AS actor_name, u.email AS actor_email
      FROM audit_events a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.organization_id = ? ORDER BY a.created_at DESC LIMIT 200
    `).all(req.auth.organizationId);
    res.json(events.map((event) => ({ ...event, details: JSON.parse(event.details) })));
  });

  api.get('/settings', requireRole('owner', 'admin'), (req, res) => {
    const organization = db.prepare('SELECT id, name, industry, size_band, currency FROM organizations WHERE id = ?').get(req.auth.organizationId);
    const settings = db.prepare('SELECT * FROM organization_settings WHERE organization_id = ?').get(req.auth.organizationId);
    res.json({ organization, settings });
  });

  api.patch('/settings', requireRole('owner', 'admin'), (req, res) => {
    const parsed = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      industry: z.string().max(120).optional(),
      size_band: z.string().max(40).optional(),
      currency: z.enum(['USD','INR','EUR','GBP','CAD','AUD']).optional(),
      weekly_capacity_hours: z.number().min(1).max(168).optional(),
      working_days: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid organization settings.' });
    const { weekly_capacity_hours, working_days, ...organizationFields } = parsed.data;
    const columns = Object.keys(organizationFields);
    if (columns.length) {
      const assignments = columns.map((column) => `${column} = @${column}`).join(', ');
      db.prepare(`UPDATE organizations SET ${assignments} WHERE id = @organizationId`).run({ ...organizationFields, organizationId: req.auth.organizationId });
    }
    if (weekly_capacity_hours !== undefined || working_days !== undefined) {
      db.prepare('UPDATE organization_settings SET weekly_capacity_hours = COALESCE(?, weekly_capacity_hours), working_days = COALESCE(?, working_days), updated_at = ? WHERE organization_id = ?')
        .run(weekly_capacity_hours ?? null, working_days ? JSON.stringify(working_days) : null, now(), req.auth.organizationId);
    }
    audit(db, req.auth, 'organization.settings.update', 'organization', req.auth.organizationId);
    res.json(db.prepare('SELECT o.id, o.name, o.industry, o.size_band, o.currency, s.weekly_capacity_hours, s.working_days FROM organizations o JOIN organization_settings s ON s.organization_id = o.id WHERE o.id = ?').get(req.auth.organizationId));
  });

  api.get('/subscription', (req, res) => {
    const subscription = db.prepare('SELECT plan, status, trial_ends_at, updated_at FROM subscriptions WHERE organization_id = ?').get(req.auth.organizationId);
    const limits = { Starter: { projects: 10, members: 5 }, Professional: { projects: 50, members: 25 }, Business: { projects: 200, members: 100 }, Enterprise: { projects: null, members: null } };
    const usage = db.prepare('SELECT COUNT(*) AS projects FROM projects WHERE organization_id = ?').get(req.auth.organizationId);
    res.json({ ...subscription, billing_live: false, limits: limits[subscription.plan], usage: { projects: usage.projects } });
  });

  api.patch('/subscription/plan', requireRole('owner', 'admin'), (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(501).json({ error: 'Live billing is not configured. Contact the AbhiNexus administrator.' });
    const parsed = z.object({ plan: z.enum(['Starter','Professional','Business','Enterprise']) }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Select a supported plan.' });
    db.prepare('UPDATE subscriptions SET plan = ?, status = ?, updated_at = ? WHERE organization_id = ?')
      .run(parsed.data.plan, 'trial', now(), req.auth.organizationId);
    audit(db, req.auth, 'subscription.plan.simulated', 'subscription', req.auth.organizationId, { plan: parsed.data.plan });
    res.json({ plan: parsed.data.plan, billing_live: false, message: 'Development billing simulator only; no payment was collected.' });
  });

  api.use((req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use('/api/v1', (error, req, res, _next) => {
    console.error(JSON.stringify({ level: 'error', requestId: req.requestId, message: error.message }));
    res.status(500).json({ error: 'An unexpected server error occurred.', requestId: req.requestId });
  });

  return app;
}
