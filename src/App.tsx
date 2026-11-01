import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowRight, Bell, BriefcaseBusiness,
  Building2, CalendarDays, ChevronDown, CircleDollarSign, ClipboardList,
  Clock3, FileBarChart, FolderKanban, Gauge, LayoutDashboard, ListChecks, LockKeyhole,
  LogOut, MapPinned, Menu, Plus, Search, Settings, ShieldCheck, Users, X,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

type Role = 'owner' | 'admin' | 'portfolio_manager' | 'project_manager' | 'team_lead' | 'contributor' | 'finance_viewer' | 'executive_viewer';
type UserInfo = { id: string; name: string; email: string };
type Organization = { id: string; name: string; currency: string; is_demo?: boolean };
type Membership = Organization & { role: Role };
type SessionInfo = { user: UserInfo; organization: Organization; role: Role; memberships: Membership[] };
type Project = {
  id: string; code: string; name: string; description: string; client: string; portfolio_id: string | null;
  portfolio_name: string | null; priority: 'P1' | 'P2' | 'P3'; lifecycle_stage: string; health: string;
  risk_rating: string; project_manager: string; sponsor: string; start_date: string | null;
  target_completion_date: string | null; forecast_completion_date: string | null; actual_completion_date: string | null;
  approved_budget_cents?: number; actual_cost_cents?: number; forecast_cost_cents?: number;
  planned_progress: number; actual_progress: number; tags: string | string[];
};
type Portfolio = { id: string; name: string; description: string; strategic_objective: string; project_count: number };
type Task = {
  id: string; project_id: string; project_name: string; title: string; description: string;
  acceptance_criteria: string; status: string; priority: string; assignee: string;
  start_date: string | null; due_date: string | null; estimated_hours: number;
  actual_hours: number; blocked_by_dependency: number;
};
type Risk = {
  id: string; project_id: string; project_name: string; title: string; description: string;
  category: string; probability: number; impact: number; inherent_score: number;
  mitigation: string; contingency: string; owner: string; review_date: string | null;
  status: string; residual_probability: number; residual_impact: number;
  residual_score: number; escalated: number;
};
type Milestone = { id: string; project_id: string; project_name: string; name: string; due_date: string; status: string };
type Resource = {
  id: string; name: string; role: string; department: string; location: string;
  weekly_capacity_hours: number; allocated_percent: number; utilization_percent: number;
};
type Assignment = {
  id: string; resource_id: string; resource_name: string; project_id: string;
  project_name: string; allocation_percent: number; start_date: string; end_date: string;
};
type Dashboard = {
  organization: Organization;
  summary: {
    active_projects: number; completed_projects: number; projects_at_risk: number;
    on_time_delivery_rate: number | null; financials_visible: boolean; budget_cents: number | null; actual_cents: number | null;
    forecast_cents: number | null; budget_variance_cents: number | null; resource_utilization_percent: number;
    overallocated_resources: number; overdue_milestones: number; blocked_tasks: number; open_critical_risks: number;
    portfolio_progress: number;
  };
  status_distribution: { onTrack: number; atRisk: number; complete: number };
  projects: Project[];
  action_items: Array<{ kind: string; id: string; title: string; owner: string; due_date: string | null; score: number }>;
  illustrative_data: boolean;
};
type FinancialData = {
  currency: string;
  entries: Array<{ id: string; project_id: string; project_name: string; project_code: string; entry_type: string; amount_cents: number; entry_date: string; memo: string }>;
  summary: { budget_cents: number; actual_cents: number; forecast_cents: number };
  projects: Array<{ id: string; code: string; name: string; budget_cents: number; actual_cents: number; forecast_cents: number; variance_cents: number; forecast_variance_cents: number }>;
};
const API = '/api/v1';
const panelClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#3563E9] focus:outline-none focus:ring-2 focus:ring-blue-100';
const buttonPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
const buttonSecondary = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';

class RequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : `Request failed (${response.status})`;
    throw new RequestError(message, response.status);
  }
  return body as T;
}

async function loadSession(): Promise<SessionInfo | null> {
  try {
    return await api<SessionInfo>('/auth/me');
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) return null;
    throw error;
  }
}

function money(amountCents: number, currency: string, compact = false) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amountCents / 100);
}

function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function stageTone(value: string) {
  if (['Active', 'Completed', 'Healthy', 'Done', 'On track', 'Complete'].includes(value)) return 'bg-emerald-100 text-emerald-700';
  if (['At Risk', 'Watch', 'Needs attention', 'In Progress', 'Mitigating'].includes(value)) return 'bg-amber-100 text-amber-700';
  if (['Critical', 'Delayed', 'Blocked', 'Open'].includes(value)) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

function App() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: ['me'],
    queryFn: loadSession,
    retry: false,
  });
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState('Overview');

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setPage('Overview');
      setNotice('Welcome back.');
    },
  });
  const registerMutation = useMutation({
    mutationFn: (details: { name: string; email: string; password: string; organization_name: string; currency: string }) =>
      api('/auth/register', { method: 'POST', body: JSON.stringify(details) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      setPage('Overview');
      setNotice('Workspace created. Start by adding your first project.');
    },
  });
  const logoutMutation = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setPage('Overview');
    },
  });

  if (sessionQuery.isLoading) return <LoadingPage />;
  if (sessionQuery.isError) {
    return <CenteredState title="Could not connect" message="AbhiNexus could not verify your session. Check the API is running, then retry." action={<button className={buttonSecondary} onClick={() => void sessionQuery.refetch()}>Retry</button>} />;
  }
  if (!sessionQuery.data) {
    return (
      <AuthScreen
        isLoading={loginMutation.isPending || registerMutation.isPending}
        error={loginMutation.error?.message || registerMutation.error?.message || ''}
        onLogin={(values) => loginMutation.mutate(values)}
        onRegister={(values) => registerMutation.mutate(values)}
      />
    );
  }

  return (
    <Workspace
      session={sessionQuery.data}
      page={page}
      setPage={setPage}
      onLogout={() => logoutMutation.mutate()}
      isLoggingOut={logoutMutation.isPending}
      notice={notice}
      clearNotice={() => setNotice('')}
      setNotice={setNotice}
    />
  );
}

function LoadingPage() {
  return <div className="flex min-h-screen items-center justify-center text-sm font-medium text-slate-500">Loading AbhiNexus…</div>;
}

function CenteredState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className={`${panelClass} max-w-md p-8 text-center`}>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </main>
  );
}

function AuthScreen({
  isLoading,
  error,
  onLogin,
  onRegister,
}: {
  isLoading: boolean;
  error: string;
  onLogin: (values: { email: string; password: string }) => void;
  onRegister: (values: { name: string; email: string; password: string; organization_name: string; currency: string }) => void;
}) {
  const [registering, setRegistering] = useState(false);
  const [demo, setDemo] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (registering) {
      onRegister({
        name: String(form.get('name') || ''),
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
        organization_name: String(form.get('organization_name') || ''),
        currency: String(form.get('currency') || 'USD'),
      });
    } else {
      onLogin({
        email: String(form.get('email') || ''),
        password: String(form.get('password') || ''),
      });
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-[#101828] p-12 text-white lg:flex">
        <Brand inverse />
        <div className="max-w-xl">
          <div className="mb-5 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-blue-100">Enterprise project portfolio intelligence</div>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">Every project connected.<br />Every decision informed.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Bring delivery, capacity, financials and risk into one dependable workspace for your portfolio office.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[['Delivery', 'Milestones & work'], ['Resources', 'Capacity planning'], ['Governance', 'Risk & finance']].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">{title}</div>
                <div className="mt-1 text-xs text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-400">Illustrative product workspace. Sample metrics are labelled and synthetic.</p>
      </section>

      <main className="flex items-center justify-center bg-[#F5F7FB] p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <div className="mb-8">
            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3563E9]">{registering ? 'Get started' : 'Welcome back'}</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{registering ? 'Create your workspace' : 'Sign in to AbhiNexus'}</h2>
            <p className="mt-2 text-sm text-slate-600">{registering ? 'Your account starts with a private organization and an owner role.' : 'Use your organization account to continue.'}</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {registering && (
              <>
                <Field label="Your name"><input className={inputClass} name="name" autoComplete="name" minLength={2} required /></Field>
                <Field label="Organization name"><input className={inputClass} name="organization_name" autoComplete="organization" minLength={2} required /></Field>
              </>
            )}
            <Field label="Work email"><input className={inputClass} type="email" name="email" autoComplete="email" required /></Field>
            <Field label="Password"><input className={inputClass} type="password" name="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 12 : 1} required /></Field>
            {registering && (
              <Field label="Organization currency">
                <select className={inputClass} name="currency" defaultValue="USD">
                  <option value="USD">USD — US Dollar</option><option value="INR">INR — Indian Rupee</option>
                  <option value="EUR">EUR — Euro</option><option value="GBP">GBP — Pound Sterling</option>
                  <option value="CAD">CAD — Canadian Dollar</option><option value="AUD">AUD — Australian Dollar</option>
                </select>
              </Field>
            )}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <button type="submit" className={`${buttonPrimary} w-full`} disabled={isLoading}>{isLoading ? 'Please wait…' : registering ? 'Create workspace' : 'Sign in'}</button>
          </form>

          {registering && <p className="mt-3 text-xs leading-5 text-slate-500">Use at least 12 characters. Password reset and email verification require an email provider and are not enabled in this local build.</p>}
          <div className="mt-6 flex items-center justify-between text-sm">
            <span className="text-slate-600">{registering ? 'Already have an account?' : 'New to AbhiNexus?'}</span>
            <button type="button" className="font-semibold text-[#3563E9] hover:text-blue-800" onClick={() => setRegistering(!registering)}>
              {registering ? 'Sign in' : 'Create workspace'}
            </button>
          </div>
          <button type="button" className="mt-5 w-full text-center text-xs font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800" onClick={() => setDemo(!demo)}>
            {demo ? 'Hide demo workspace details' : 'Have a local demo account?'}
          </button>
          {demo && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">Local demo only: <strong>demo@abhinexus.local</strong> / <strong>Abhinexus-Demo-2026!</strong>. Create it with <code>npm run db:seed:demo</code>. Do not use demo credentials in production.</div>}
        </div>
      </main>
    </div>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${inverse ? 'bg-white text-[#101828]' : 'bg-[#101828] text-white'}`}><span className="text-sm font-black">AN</span></div>
      <div>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${inverse ? 'text-slate-400' : 'text-slate-500'}`}>Enterprise</div>
        <div className={`text-xl font-bold tracking-tight ${inverse ? 'text-white' : 'text-slate-900'}`}>AbhiNexus</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

const workspaceNav = [
  { section: 'Workspace', items: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Portfolios', icon: FolderKanban },
    { label: 'Projects', icon: BriefcaseBusiness },
    { label: 'Tasks & Work', icon: ListChecks },
    { label: 'Roadmap', icon: CalendarDays },
    { label: 'Resources', icon: Users },
    { label: 'Financials', icon: CircleDollarSign },
    { label: 'Risks & Issues', icon: ShieldCheck },
    { label: 'Reports', icon: FileBarChart },
    { label: 'Notifications', icon: Bell },
  ] },
  { section: 'Administration', items: [
    { label: 'Members & Teams', icon: Users },
    { label: 'Roles & Permissions', icon: LockKeyhole },
    { label: 'Audit Log', icon: ClipboardList },
    { label: 'Subscription', icon: CircleDollarSign },
    { label: 'Integrations', icon: Activity },
    { label: 'Organization Settings', icon: Settings },
  ] },
];

function Workspace({
  session,
  page,
  setPage,
  onLogout,
  isLoggingOut,
  notice,
  clearNotice,
  setNotice,
}: {
  session: SessionInfo;
  page: string;
  setPage: (page: string) => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  notice: string;
  clearNotice: () => void;
  setNotice: (notice: string) => void;
}) {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [organizationMenu, setOrganizationMenu] = useState(false);
  const [accountMenu, setAccountMenu] = useState(false);
  const searchQuery = useQuery({
    queryKey: ['search', search],
    queryFn: () => api<{ projects: Array<{ id: string; name: string }>; tasks: Array<{ id: string; title: string }>; portfolios: Array<{ id: string; name: string }> }>(`/search?q=${encodeURIComponent(search)}`),
    enabled: search.trim().length >= 2,
  });
  const notificationQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<Array<{ id: string; title: string; message: string; read_at: string | null }>>('/notifications'),
  });
  const switchMutation = useMutation({
    mutationFn: (organizationId: string) => api('/auth/switch-organization', { method: 'POST', body: JSON.stringify({ organization_id: organizationId }) }),
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      setPage('Overview');
      setOrganizationMenu(false);
    },
    onError: (error) => setNotice(error.message),
  });
  const canAdmin = ['owner', 'admin'].includes(session.role);
  const canFinance = ['owner', 'admin', 'portfolio_manager', 'finance_viewer', 'executive_viewer'].includes(session.role);
  const selectedPage = workspaceNav.flatMap(({ items }) => items).find(({ label }) => label === page);
  const unreadCount = notificationQuery.data?.filter((item) => !item.read_at).length ?? 0;

  async function markAllRead() {
    const unread = notificationQuery.data?.filter((item) => !item.read_at) ?? [];
    await Promise.all(unread.map((item) => api(`/notifications/${item.id}/read`, { method: 'PATCH' })));
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`${sidebarOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden'} w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-5 lg:sticky lg:top-0 lg:flex lg:h-screen`}>
          <div className="mb-8 flex items-center justify-between"><Brand /><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
          <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <button type="button" onClick={() => setOrganizationMenu(!organizationMenu)} className="flex w-full items-center gap-2 text-left">
              <Building2 size={17} className="shrink-0 text-[#3563E9]" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{session.organization.name}</span>
              {session.memberships.length > 1 && <ChevronDown size={15} className="text-slate-400" />}
            </button>
            <div className="mt-1 pl-6 text-xs capitalize text-slate-500">{session.role.replaceAll('_', ' ')}</div>
            {organizationMenu && session.memberships.length > 1 && (
              <div className="mt-3 space-y-1 border-t border-slate-200 pt-2">
                {session.memberships.map((membership) => (
                  <button type="button" key={membership.id} onClick={() => switchMutation.mutate(membership.id)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white">
                    {membership.name}{membership.id === session.organization.id ? ' · Current' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
          <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto" aria-label="Workspace navigation">
            {workspaceNav.map(({ section, items }) => {
              const visible = items.filter(({ label }) => {
                if (section === 'Administration' && !canAdmin && label !== 'Subscription') return false;
                if (label === 'Financials' && !canFinance) return false;
                if (label === 'Reports' && !canFinance) return false;
                return true;
              });
              return <div key={section}><div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{section}</div><div className="space-y-1">
                {visible.map(({ label, icon: Icon }) => (
                  <button key={label} type="button" onClick={() => { setPage(label); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${page === label ? 'bg-[#101828] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                    <Icon size={17} />{label}{label === 'Notifications' && unreadCount > 0 && <span className="ml-auto rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">{unreadCount}</span>}
                  </button>
                ))}
              </div></div>;
            })}
          </nav>
          <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900"><div className="font-semibold">Workspace health</div><div className="mt-1 text-blue-800">Data is private to this organization. Role checks are enforced by the API.</div></div>
          <button type="button" className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-slate-100" onClick={onLogout} disabled={isLoggingOut}><LogOut size={16} />{isLoggingOut ? 'Signing out…' : 'Sign out'}</button>
        </aside>
        {sidebarOpen && <button className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" aria-label="Close menu backdrop" onClick={() => setSidebarOpen(false)} />}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-7">
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Open navigation" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
              <div className="hidden min-w-0 flex-1 sm:block"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace / {selectedPage?.label}</div><div className="mt-0.5 truncate text-sm font-semibold text-slate-800">{session.organization.name}</div></div>
              <div className="relative ml-auto w-full max-w-sm">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input aria-label="Global search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects, tasks, portfolios…" className={`${inputClass} pl-9`} />
                {search.trim().length >= 2 && <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  {searchQuery.isLoading ? <div className="p-3 text-xs text-slate-500">Searching…</div> : searchQuery.error ? <div className="p-3 text-xs text-rose-600">Search failed: {searchQuery.error.message}</div> : (
                    <>
                      {searchQuery.data?.projects.map((item) => <button key={item.id} onClick={() => { setPage('Projects'); setSearch(''); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="text-xs text-slate-400">Project</span><br />{item.name}</button>)}
                      {searchQuery.data?.tasks.map((item) => <button key={item.id} onClick={() => { setPage('Tasks & Work'); setSearch(''); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="text-xs text-slate-400">Task</span><br />{item.title}</button>)}
                      {searchQuery.data?.portfolios.map((item) => <button key={item.id} onClick={() => { setPage('Portfolios'); setSearch(''); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><span className="text-xs text-slate-400">Portfolio</span><br />{item.name}</button>)}
                      {!searchQuery.data?.projects.length && !searchQuery.data?.tasks.length && !searchQuery.data?.portfolios.length && <div className="p-3 text-xs text-slate-500">No matching records.</div>}
                    </>
                  )}
                </div>}
              </div>
              <button type="button" aria-label="Open notifications" onClick={() => setPage('Notifications')} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 hover:bg-slate-50">
                <Bell size={17} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-4 text-white">{unreadCount}</span>}
              </button>
              <div className="relative">
                <button type="button" onClick={() => setAccountMenu(!accountMenu)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 hover:bg-slate-50">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-800">{session.user.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <span className="hidden max-w-24 truncate text-xs font-semibold sm:block">{session.user.name}</span><ChevronDown size={14} className="text-slate-400" />
                </button>
                {accountMenu && <div className="absolute right-0 top-full z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-2"><div className="truncate text-sm font-semibold">{session.user.name}</div><div className="truncate text-xs text-slate-500">{session.user.email}</div></div>
                  <button type="button" onClick={onLogout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"><LogOut size={15} />Sign out</button>
                </div>}
              </div>
            </div>
            <div className="mt-3 overflow-x-auto lg:hidden"><div className="flex min-w-max gap-2">
              {workspaceNav[0].items.map(({ label }) => <button type="button" key={label} onClick={() => setPage(label)} className={`rounded-full px-3 py-1.5 text-xs font-medium ${page === label ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{label}</button>)}
            </div></div>
          </header>

          {notice && <div role="status" className="mx-4 mt-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:mx-7"><span>{notice}</span><button aria-label="Dismiss notification" onClick={clearNotice}><X size={16} /></button></div>}
          {session.organization.is_demo && <div className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:mx-7">Sample workspace — all records and metrics here are synthetic demonstration data.</div>}
          <div className="space-y-6 p-4 sm:p-7">
            <PageHeading title={page} organization={session.organization.name} role={session.role} />
            {page === 'Overview' && <OverviewPage organization={session.organization} />}
            {page === 'Portfolios' && <PortfoliosPage onNotice={setNotice} />}
            {page === 'Projects' && <ProjectsPage organization={session.organization} onNotice={setNotice} role={session.role} />}
            {page === 'Tasks & Work' && <TasksPage onNotice={setNotice} role={session.role} />}
            {page === 'Roadmap' && <RoadmapPage onNotice={setNotice} role={session.role} />}
            {page === 'Resources' && <ResourcesPage onNotice={setNotice} role={session.role} />}
            {page === 'Financials' && <FinancePage organization={session.organization} onNotice={setNotice} role={session.role} />}
            {page === 'Risks & Issues' && <RisksPage onNotice={setNotice} role={session.role} />}
            {page === 'Reports' && canFinance && <ReportsPage organization={session.organization} />}
            {page === 'Notifications' && <NotificationsPage onRead={markAllRead} />}
            {page === 'Members & Teams' && <MembersPage role={session.role} />}
            {page === 'Roles & Permissions' && <RolesPage role={session.role} />}
            {page === 'Audit Log' && <AuditPage role={session.role} />}
            {page === 'Subscription' && <SubscriptionPage role={session.role} onNotice={setNotice} />}
            {page === 'Organization Settings' && <SettingsPage role={session.role} organization={session.organization} onNotice={setNotice} />}
            {page === 'Integrations' && <IntegrationsPage />}
          </div>
        </main>
      </div>
    </div>
  );
}

function PageHeading({ title, organization, role }: { title: string; organization: string; role: Role }) {
  const subtitle: Record<string, string> = {
    Overview: 'Executive portfolio performance, delivery exceptions and actions.',
    Portfolios: 'Group strategic initiatives and track portfolio outcomes.',
    Projects: 'Manage project scope, delivery status, health and approved budgets.',
    'Tasks & Work': 'Track ownership, effort, dependencies and work in progress.',
    Roadmap: 'Review milestones and near-term delivery commitments.',
    Resources: 'Plan capacity, weekly allocation and project assignments.',
    Financials: 'Compare approved budgets, actual spend and cost forecasts.',
    'Risks & Issues': 'Assess risk exposure, mitigation and residual risk.',
    Reports: 'Build a portfolio review from the organization’s current records.',
    Notifications: 'Review organization activity and personal notifications.',
    'Members & Teams': 'Review organization membership and team access.',
    'Roles & Permissions': 'Understand the permission checks applied by the API.',
    'Audit Log': 'Review security-relevant changes in this organization.',
    Subscription: 'Review plan entitlements. Billing is a local simulator only.',
    'Organization Settings': 'Configure workspace identity, currency and capacity defaults.',
    Integrations: 'Connect external services when providers are configured.',
  };
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{organization} · {role.replaceAll('_', ' ')}</div><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-slate-500">{subtitle[title]}</p></div>
      <div className="hidden items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200 md:flex"><MapPinned size={14} className="text-[#3563E9]" />Private organization workspace</div>
    </div>
  );
}

function QueryError({ error, retry }: { error: Error | null; retry?: () => void }) {
  return <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><div className="font-semibold">Could not load this section</div><p className="mt-1">{error?.message || 'Unexpected error'}</p>{retry && <button className="mt-3 underline" onClick={retry}>Retry</button>}</div>;
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"><FolderKanban size={20} /></div><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function OverviewPage({ organization }: { organization: Organization }) {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') });
  if (query.isLoading) return <LoadingPage />;
  if (query.isError || !query.data) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const stats = [
    { label: 'Active projects', value: data.summary.active_projects, icon: BriefcaseBusiness, tint: 'bg-blue-100 text-blue-700', note: `${data.summary.completed_projects} completed` },
    { label: 'Projects at risk', value: data.summary.projects_at_risk, icon: AlertTriangle, tint: 'bg-amber-100 text-amber-700', note: `${data.summary.open_critical_risks} critical risks open` },
    { label: 'Portfolio budget', value: data.summary.financials_visible ? money(data.summary.budget_cents ?? 0, organization.currency, true) : 'Restricted', icon: CircleDollarSign, tint: 'bg-indigo-100 text-indigo-700', note: data.summary.financials_visible ? `${money(data.summary.actual_cents ?? 0, organization.currency, true)} actual` : 'Finance role required' },
    { label: 'Resource utilization', value: `${data.summary.resource_utilization_percent}%`, icon: Gauge, tint: 'bg-emerald-100 text-emerald-700', note: `${data.summary.overallocated_resources} overallocated` },
  ];
  const healthData = [
    { name: 'On track', value: data.status_distribution.onTrack, color: '#0D9488' },
    { name: 'At risk', value: data.status_distribution.atRisk, color: '#D97706' },
    { name: 'Complete', value: data.status_distribution.complete, color: '#3563E9' },
  ];
  const financialData = data.summary.financials_visible
    ? data.projects.map((project) => ({ name: project.code, budget: (project.approved_budget_cents ?? 0) / 100, actual: (project.actual_cost_cents ?? 0) / 100 }))
    : [];

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, tint, note }) => <div key={label} className={`${panelClass} p-4 sm:p-5`}><div className="flex items-start justify-between"><div className={`rounded-xl p-2.5 ${tint}`}><Icon size={18} /></div><ArrowRight size={15} className="text-slate-300" /></div><div className="mt-4 text-sm text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</div><div className="mt-1 text-xs text-slate-500">{note}</div></div>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <section className={`${panelClass} p-5`}>
          <div className="mb-5 flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Financial position</div><h2 className="mt-1 text-lg font-semibold">Budget vs actual</h2></div><div className="text-xs text-slate-500">{organization.currency} · current project records</div></div>
          {data.summary.financials_visible ? financialData.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={financialData} margin={{ left: 8, right: 12, top: 8 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value: number) => new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value)} /><Tooltip formatter={(value) => [money(Number(value) * 100, organization.currency), '']} /><Bar dataKey="budget" name="Approved budget" fill="#3563E9" radius={[6, 6, 0, 0]} /><Bar dataKey="actual" name="Actual cost" fill="#0D9488" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No project financials yet" detail="Add a project and budget to start seeing portfolio expenditure." /> : <div className="flex h-72 items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-500">Financial role required to view costs.</div>}
          {data.summary.financials_visible && <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#3563E9]" />Approved budget</span><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-[#0D9488]" />Actual cost</span></div>}
        </section>
        <section className={`${panelClass} p-5`}>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Delivery health</div><h2 className="mt-1 text-lg font-semibold">Portfolio status</h2>
          {data.projects.length ? <><div className="h-56"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={healthData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>{healthData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-2">{healthData.map((entry) => <div key={entry.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />{entry.name}</span><strong>{entry.value}</strong></div>)}</div></> : <EmptyState title="No delivery data yet" detail="Add projects to see portfolio health." />}
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className={`${panelClass} overflow-hidden`}>
          <SectionHeader eyebrow="Active work" title="Projects to watch" />
          {data.projects.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Project</th><th className="px-4 py-3">Owner</th>{data.summary.financials_visible && <th className="px-4 py-3">Budget</th>}<th className="px-4 py-3">Progress</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{data.projects.slice(0, 6).map((project) => <tr key={project.id} className="border-t border-slate-100"><td className="px-5 py-3"><div className="font-semibold">{project.name}</div><div className="text-xs text-slate-500">{project.code} · {project.portfolio_name || 'Unassigned'}</div></td><td className="px-4 py-3 text-slate-600">{project.project_manager || '—'}</td>{data.summary.financials_visible && <td className="px-4 py-3">{money(project.approved_budget_cents ?? 0, organization.currency, true)}</td>}<td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#3563E9]" style={{ width: `${project.actual_progress}%` }} /></div><span className="text-xs">{project.actual_progress}%</span></div></td><td className="px-4 py-3"><StatusBadge value={project.lifecycle_stage} /></td></tr>)}</tbody></table></div> : <div className="p-5"><EmptyState title="Your portfolio is ready" detail="Create a project to see current delivery and finance data." /></div>}
        </section>
        <section className={`${panelClass} overflow-hidden`}>
          <SectionHeader eyebrow="Executive action list" title="Decisions & exceptions" />
          {data.action_items.length ? <div className="divide-y divide-slate-100">{data.action_items.slice(0, 6).map((item) => <div key={`${item.kind}-${item.id}`} className="flex gap-3 px-5 py-4"><div className={`mt-0.5 rounded-lg p-2 ${item.kind === 'risk' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}`}>{item.kind === 'risk' ? <ShieldCheck size={16} /> : <Clock3 size={16} />}</div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-800">{item.title}</div><div className="mt-1 text-xs text-slate-500">{item.kind === 'risk' ? `Risk owner: ${item.owner || 'Unassigned'} · score ${item.score}/25` : 'Milestone'}{item.due_date ? ` · Due ${shortDate(item.due_date)}` : ''}</div></div></div>)}</div> : <div className="p-6 text-sm text-slate-500">No open risks or upcoming milestones require attention.</div>}
        </section>
      </div>
      <div className={`${panelClass} grid gap-4 p-5 sm:grid-cols-4`}>
        <Metric label="On-time delivery" value={data.summary.on_time_delivery_rate === null ? '—' : `${data.summary.on_time_delivery_rate}%`} detail="Completed projects with actual dates on or before target" />
        <Metric label="Portfolio progress" value={`${data.summary.portfolio_progress}%`} detail="Mean actual progress across active projects" />
        <Metric label="Overdue milestones" value={data.summary.overdue_milestones} detail="Open milestones with a due date before today" />
        <Metric label="Forecast variance" value={data.summary.financials_visible ? money((data.summary.budget_cents ?? 0) - (data.summary.forecast_cents ?? 0), organization.currency, true) : 'Restricted'} detail="Approved budget minus forecast cost; positive is favorable" />
      </div>
    </>
  );
}

function Metric({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return <div><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{value}</div><div className="mt-1 text-[11px] leading-4 text-slate-500">{detail}</div></div>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</div><h2 className="mt-1 font-semibold text-slate-900">{title}</h2></div>{action}</div>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${stageTone(value)}`}>{value}</span>;
}

function PortfoliosPage({ onNotice }: { onNotice: (message: string) => void }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['portfolios'], queryFn: () => api<Portfolio[]>('/portfolios') });
  const create = useMutation({
    mutationFn: (data: { name: string; description: string; strategic_objective: string }) => api('/portfolios', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['portfolios'] }); setOpen(false); onNotice('Portfolio created.'); },
  });
  if (query.isLoading) return <LoadingPage />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <>
    <div className="flex justify-end"><button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />New portfolio</button></div>
    {query.data?.length ? <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{query.data.map((portfolio) => <article key={portfolio.id} className={`${panelClass} p-5`}><div className="flex items-start justify-between"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><FolderKanban size={18} /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{portfolio.project_count} projects</span></div><h2 className="mt-4 font-semibold">{portfolio.name}</h2><p className="mt-1 text-sm text-slate-500">{portfolio.description || 'No description'}</p><div className="mt-4 border-t border-slate-100 pt-3"><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Strategic objective</div><p className="mt-1 text-sm text-slate-700">{portfolio.strategic_objective || 'Not specified'}</p></div></article>)}</div> : <EmptyState title="No portfolios yet" detail="Create a portfolio to group projects around strategy, departments or clients." action={<button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />Create portfolio</button>} />}
    <Modal open={open} title="Create portfolio" onClose={() => setOpen(false)}><SimpleForm busy={create.isPending} error={create.error?.message} submitLabel="Create portfolio" onSubmit={(form) => create.mutate({ name: form.name, description: form.description, strategic_objective: form.strategic_objective })}><Field label="Portfolio name"><input className={inputClass} name="name" required minLength={2} /></Field><Field label="Description"><textarea className={inputClass} name="description" rows={2} /></Field><Field label="Strategic objective"><textarea className={inputClass} name="strategic_objective" rows={2} /></Field></SimpleForm></Modal>
  </>;
}

function ProjectsPage({ organization, onNotice, role }: { organization: Organization; onNotice: (message: string) => void; role: Role }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const portfolios = useQuery({ queryKey: ['portfolios'], queryFn: () => api<Portfolio[]>('/portfolios') });
  const query = useQuery({
    queryKey: ['projects', statusFilter, search],
    queryFn: () => api<{ items: Project[]; total: number }>(`/projects?limit=100${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''}${search ? `&q=${encodeURIComponent(search)}` : ''}`),
  });
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['projects'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); await client.invalidateQueries({ queryKey: ['finance'] }); };
  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await refresh(); setOpen(false); onNotice('Project created.'); },
  });
  const update = useMutation({
    mutationFn: (data: { id: string; values: Record<string, unknown> }) => api(`/projects/${data.id}`, { method: 'PATCH', body: JSON.stringify(data.values) }),
    onSuccess: async () => { await refresh(); setEditing(null); onNotice('Project updated.'); },
  });
  const remove = useMutation({
    mutationFn: (projectId: string) => api(`/projects/${projectId}`, { method: 'DELETE' }),
    onSuccess: async () => { await refresh(); onNotice('Project and its dependent records were deleted.'); },
  });
  const writable = ['owner', 'admin', 'portfolio_manager', 'project_manager'].includes(role);
  const canViewFinance = ['owner', 'admin', 'portfolio_manager', 'finance_viewer', 'executive_viewer'].includes(role);
  const canEditBudget = ['owner', 'admin', 'portfolio_manager'].includes(role);
  if (query.isLoading || portfolios.isLoading) return <LoadingPage />;
  if (query.isError || portfolios.isError) return <QueryError error={query.error || portfolios.error} retry={() => void query.refetch()} />;
  return <>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap gap-2"><input className={`${inputClass} max-w-sm`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter by name, code, client…" /><select className={`${inputClass} max-w-48`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All lifecycle stages</option>{['Proposed','Under Review','Approved','Planned','Active','On Hold','At Risk','Completed','Cancelled','Archived'].map((status) => <option key={status}>{status}</option>)}</select></div>
      {writable && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />New project</button>}
    </div>
    {query.data?.items.length ? <div className={`${panelClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Project</th><th className="px-4 py-3">Portfolio</th><th className="px-4 py-3">Manager</th><th className="px-4 py-3">Target</th>{canViewFinance && <><th className="px-4 py-3">Budget</th><th className="px-4 py-3">Variance</th></>}<th className="px-4 py-3">Progress</th><th className="px-4 py-3">Status</th>{writable && <th className="px-4 py-3">Actions</th>}</tr></thead><tbody>{query.data.items.map((project) => {
      const variance = (project.approved_budget_cents ?? 0) - (project.actual_cost_cents ?? 0);
      return <tr key={project.id} className="border-t border-slate-100 align-middle"><td className="px-5 py-3"><div className="font-semibold text-slate-900">{project.name}</div><div className="text-xs text-slate-500">{project.code} · {project.client || 'No client'}</div></td><td className="px-4 py-3 text-slate-600">{project.portfolio_name || '—'}</td><td className="px-4 py-3 text-slate-600">{project.project_manager || '—'}</td><td className="px-4 py-3 text-slate-600">{shortDate(project.target_completion_date)}</td>{canViewFinance && <><td className="px-4 py-3">{money(project.approved_budget_cents ?? 0, organization.currency, true)}</td><td className={`px-4 py-3 ${variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{money(variance, organization.currency, true)}</td></>}<td className="px-4 py-3">{project.actual_progress}%</td><td className="px-4 py-3"><StatusBadge value={project.lifecycle_stage} /></td>{writable && <td className="px-4 py-3"><div className="flex gap-2"><button className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => setEditing(project)}>Edit</button><button className="text-xs font-semibold text-rose-700 hover:underline" onClick={() => { if (window.confirm(`Delete ${project.name} and related tasks, risks, milestones, assignments and finance records?`)) remove.mutate(project.id); }}>Delete</button></div></td>}</tr>;
    })}</tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing {query.data.items.length} of {query.data.total} projects. Budget variance = approved budget − actual cost.</div></div> : <EmptyState title={search || statusFilter ? 'No matching projects' : 'No projects yet'} detail={search || statusFilter ? 'Adjust or clear your filters.' : 'Create a project to begin tracking delivery, resource demand and financial performance.'} action={writable && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />Create project</button>} />}
    <ProjectModal open={open} portfolios={portfolios.data || []} organization={organization} canEditBudget={canEditBudget} busy={create.isPending} error={create.error?.message} onClose={() => setOpen(false)} onSave={(values) => create.mutate(values)} />
    <ProjectModal open={Boolean(editing)} project={editing || undefined} portfolios={portfolios.data || []} organization={organization} canEditBudget={canEditBudget} busy={update.isPending} error={update.error?.message} onClose={() => setEditing(null)} onSave={(values) => editing && update.mutate({ id: editing.id, values })} />
  </>;
}

function ProjectModal({ open, project, portfolios, organization, canEditBudget, busy, error, onClose, onSave }: {
  open: boolean; project?: Project; portfolios: Portfolio[]; organization: Organization; canEditBudget: boolean;
  busy: boolean; error?: string; onClose: () => void; onSave: (values: Record<string, unknown>) => void;
}) {
  const [attempted, setAttempted] = useState(false);
  function submit(form: Record<string, string>) {
    setAttempted(true);
    const budget = Math.round(Number(form.approved_budget || 0) * 100);
    if (!form.name.trim() || (canEditBudget && (!Number.isFinite(budget) || budget < 0))) return;
    const values: Record<string, unknown> = {
      code: form.code || undefined,
      name: form.name.trim(),
      description: form.description || '',
      client: form.client || '',
      portfolio_id: form.portfolio_id || null,
      project_type: form.project_type || 'Business',
      strategic_objective: form.strategic_objective || '',
      priority: form.priority || 'P2',
      lifecycle_stage: form.lifecycle_stage || 'Proposed',
      health: form.health || 'Healthy',
      risk_rating: form.risk_rating || 'Low',
      project_manager: form.project_manager || '',
      sponsor: form.sponsor || '',
      start_date: form.start_date || null,
      target_completion_date: form.target_completion_date || null,
      forecast_completion_date: form.forecast_completion_date || null,
      actual_completion_date: form.actual_completion_date || null,
      ...(canEditBudget ? { approved_budget_cents: budget } : {}),
      planned_progress: Number(form.planned_progress || 0),
      actual_progress: Number(form.actual_progress || 0),
      tags: (form.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    if (values.start_date && values.target_completion_date && String(values.target_completion_date) < String(values.start_date)) return;
    onSave(values);
  }
  return <Modal open={open} title={project ? 'Edit project' : 'Create project'} onClose={onClose} wide><SimpleForm key={project?.id || 'new-project'} busy={busy} error={error} submitLabel={project ? 'Save changes' : 'Create project'} onSubmit={submit}>
    {attempted && <p className="md:col-span-2 text-xs text-rose-600">Check required fields and date order before saving.</p>}
    <Field label="Project name"><input className={inputClass} name="name" required minLength={2} defaultValue={project?.name} /></Field>
    <Field label="Project code"><input className={inputClass} name="code" maxLength={32} defaultValue={project?.code} placeholder="Generated if blank" /></Field>
    <Field label="Portfolio"><select className={inputClass} name="portfolio_id" defaultValue={project?.portfolio_id || ''}><option value="">Unassigned</option>{portfolios.map((portfolio) => <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>)}</select></Field>
    <Field label="Business unit / client"><input className={inputClass} name="client" defaultValue={project?.client} /></Field>
    <Field label="Project manager"><input className={inputClass} name="project_manager" defaultValue={project?.project_manager} /></Field>
    <Field label="Sponsor"><input className={inputClass} name="sponsor" defaultValue={project?.sponsor} /></Field>
    <Field label="Lifecycle stage"><select className={inputClass} name="lifecycle_stage" defaultValue={project?.lifecycle_stage || 'Proposed'}>{['Proposed','Under Review','Approved','Planned','Active','On Hold','At Risk','Completed','Cancelled','Archived'].map((stage) => <option key={stage}>{stage}</option>)}</select></Field>
    <Field label="Priority"><select className={inputClass} name="priority" defaultValue={project?.priority || 'P2'}><option>P1</option><option>P2</option><option>P3</option></select></Field>
    <Field label="Health"><select className={inputClass} name="health" defaultValue={project?.health || 'Healthy'}><option>Healthy</option><option>Watch</option><option>Critical</option></select></Field>
    <Field label="Risk rating"><select className={inputClass} name="risk_rating" defaultValue={project?.risk_rating || 'Low'}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></Field>
    {canEditBudget && <Field label={`Approved budget (${organization.currency})`}><input className={inputClass} name="approved_budget" type="number" step="0.01" min="0" defaultValue={project ? (project.approved_budget_cents || 0) / 100 : 0} /></Field>}
    <Field label="Planned progress (%)"><input className={inputClass} name="planned_progress" type="number" min="0" max="100" defaultValue={project?.planned_progress ?? 0} /></Field>
    <Field label="Actual progress (%)"><input className={inputClass} name="actual_progress" type="number" min="0" max="100" defaultValue={project?.actual_progress ?? 0} /></Field>
    <Field label="Start date"><input className={inputClass} name="start_date" type="date" defaultValue={project?.start_date || ''} /></Field>
    <Field label="Target completion"><input className={inputClass} name="target_completion_date" type="date" defaultValue={project?.target_completion_date || ''} /></Field>
    <Field label="Forecast completion"><input className={inputClass} name="forecast_completion_date" type="date" defaultValue={project?.forecast_completion_date || ''} /></Field>
    <Field label="Project type"><input className={inputClass} name="project_type" defaultValue="Business" /></Field>
    <Field label="Tags (comma separated)"><input className={inputClass} name="tags" defaultValue={Array.isArray(project?.tags) ? project.tags.join(', ') : ''} /></Field>
    <div className="md:col-span-2"><Field label="Strategic objective"><textarea className={inputClass} name="strategic_objective" rows={2} defaultValue={project?.description} /></Field></div>
  </SimpleForm></Modal>;
}

function TasksPage({ onNotice, role }: { onNotice: (message: string) => void; role: Role }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [dependencyTask, setDependencyTask] = useState<Task | null>(null);
  const [page, setPage] = useState(1);
  const projectsQuery = useQuery({ queryKey: ['projects', '', ''], queryFn: () => api<{ items: Project[] }>('/projects') });
  const query = useQuery({ queryKey: ['tasks', page], queryFn: () => api<{ items: Task[]; total: number; page: number; limit: number }>(`/tasks?page=${page}&limit=25`) });
  const dependencyTasksQuery = useQuery({
    queryKey: ['project-tasks', dependencyTask?.project_id],
    queryFn: () => api<{ items: Task[] }>(`/tasks?project_id=${dependencyTask?.project_id}&limit=100`),
    enabled: Boolean(dependencyTask),
  });
  const canEdit = ['owner','admin','portfolio_manager','project_manager','team_lead'].includes(role);
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['tasks'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); };
  const create = useMutation({
    mutationFn: (data: Record<string, unknown>) => api('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await refresh(); setPage(1); setOpen(false); onNotice('Task created.'); },
  });
  const update = useMutation({
    mutationFn: (data: { id: string; status: string }) => api(`/tasks/${data.id}`, { method: 'PATCH', body: JSON.stringify({ status: data.status }) }),
    onSuccess: async () => { await refresh(); onNotice('Task status updated.'); },
  });
  const dependency = useMutation({
    mutationFn: (data: { taskId: string; predecessorId: string }) => api(`/tasks/${data.taskId}/dependencies`, { method: 'POST', body: JSON.stringify({ predecessor_id: data.predecessorId, dependency_type: 'FS' }) }),
    onSuccess: async () => { await refresh(); setDependencyTask(null); onNotice('Finish-to-start dependency added.'); },
  });
  const remove = useMutation({
    mutationFn: (taskId: string) => api(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: async () => { if (query.data?.items.length === 1 && page > 1) setPage((current) => current - 1); await refresh(); onNotice('Task deleted.'); },
  });
  if (query.isLoading || projectsQuery.isLoading) return <LoadingPage />;
  if (query.isError || projectsQuery.isError) return <QueryError error={query.error || projectsQuery.error} retry={() => void query.refetch()} />;
  return <>
    <div className="flex justify-end">{canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />New task</button>}</div>
    {query.data?.items.length ? <div className={`${panelClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Task</th><th className="px-4 py-3">Project</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Effort</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th>{canEdit && <th className="px-4 py-3">Actions</th>}</tr></thead><tbody>{query.data.items.map((task) => <tr key={task.id} className="border-t border-slate-100"><td className="px-5 py-3"><div className="font-semibold">{task.title}</div><div className="text-xs text-slate-500">{task.blocked_by_dependency ? 'Blocked by unfinished prerequisite' : task.description || 'No description'}</div></td><td className="px-4 py-3">{task.project_name}</td><td className="px-4 py-3">{task.assignee || 'Unassigned'}</td><td className="px-4 py-3">{shortDate(task.due_date)}</td><td className="px-4 py-3">{task.actual_hours}/{task.estimated_hours}h</td><td className="px-4 py-3"><StatusBadge value={task.priority} /></td><td className="px-4 py-3"><StatusBadge value={task.blocked_by_dependency ? 'Blocked' : task.status} /></td>{canEdit && <td className="px-4 py-3"><div className="flex items-center gap-2"><select aria-label={`Update status for ${task.title}`} value={task.status} onChange={(event) => update.mutate({ id: task.id, status: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">{['Todo','In Progress','Blocked','Done'].map((status) => <option key={status}>{status}</option>)}</select><button className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => setDependencyTask(task)}>Link</button><button className="text-xs text-rose-700 hover:underline" onClick={() => { if (window.confirm(`Delete task "${task.title}"?`)) remove.mutate(task.id); }}>Delete</button></div></td>}</tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>Showing {(page - 1) * query.data.limit + 1}–{(page - 1) * query.data.limit + query.data.items.length} of {query.data.total} tasks. Only finish-to-start dependencies are currently supported.</span><div className="flex gap-2"><button className={buttonSecondary} disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><button className={buttonSecondary} disabled={page * query.data.limit >= query.data.total} onClick={() => setPage((current) => current + 1)}>Next</button></div></div></div> : <EmptyState title="No tasks yet" detail="Add tasks to track assignments, effort, deadlines and dependencies." action={canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />Create task</button>} />}
    <Modal open={open} title="Create task" onClose={() => setOpen(false)}><SimpleForm busy={create.isPending} error={create.error?.message} submitLabel="Create task" onSubmit={(form) => create.mutate({ project_id: form.project_id, title: form.title, description: form.description, acceptance_criteria: form.acceptance_criteria, status: form.status, priority: form.priority, assignee: form.assignee, start_date: form.start_date || null, due_date: form.due_date || null, estimated_hours: Number(form.estimated_hours || 0), actual_hours: Number(form.actual_hours || 0) })}>
      <Field label="Project"><select className={inputClass} name="project_id" required>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field><Field label="Task title"><input className={inputClass} name="title" required minLength={2} /></Field><Field label="Assignee"><input className={inputClass} name="assignee" /></Field><Field label="Status"><select className={inputClass} name="status"><option>Todo</option><option>In Progress</option><option>Blocked</option></select></Field><Field label="Priority"><select className={inputClass} name="priority" defaultValue="P2"><option>P1</option><option>P2</option><option>P3</option></select></Field><Field label="Estimated hours"><input className={inputClass} name="estimated_hours" type="number" min="0" step="0.5" defaultValue="0" /></Field><Field label="Start date"><input className={inputClass} name="start_date" type="date" /></Field><Field label="Due date"><input className={inputClass} name="due_date" type="date" /></Field><div className="md:col-span-2"><Field label="Description"><textarea className={inputClass} name="description" rows={2} /></Field></div><div className="md:col-span-2"><Field label="Acceptance criteria"><textarea className={inputClass} name="acceptance_criteria" rows={2} /></Field></div>
    </SimpleForm></Modal>
    <Modal open={Boolean(dependencyTask)} title="Add prerequisite" onClose={() => setDependencyTask(null)}><SimpleForm busy={dependency.isPending} error={dependency.error?.message || dependencyTasksQuery.error?.message} submitLabel="Add dependency" onSubmit={(form) => dependencyTask && dependency.mutate({ taskId: dependencyTask.id, predecessorId: form.predecessor_id })}><p className="md:col-span-2 text-sm text-slate-600">Choose a task that must finish before <strong>{dependencyTask?.title}</strong> starts. Only finish-to-start links are enabled; cycles, date conflicts and cross-project links are rejected.</p><Field label="Prerequisite task"><select className={inputClass} name="predecessor_id" required disabled={dependencyTasksQuery.isLoading || dependencyTasksQuery.isError}><option value="">{dependencyTasksQuery.isLoading ? 'Loading tasks…' : 'Select a task'}</option>{dependencyTasksQuery.data?.items.filter((task) => task.id !== dependencyTask?.id).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></Field></SimpleForm></Modal>
  </>;
}

function RoadmapPage({ onNotice, role }: { onNotice: (message: string) => void; role: Role }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['milestones'], queryFn: () => api<Milestone[]>('/milestones') });
  const projectsQuery = useQuery({ queryKey: ['projects', '', ''], queryFn: () => api<{ items: Project[] }>('/projects') });
  const create = useMutation({
    mutationFn: (data: object) => api('/milestones', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['milestones'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); setOpen(false); onNotice('Milestone added.'); },
  });
  const update = useMutation({
    mutationFn: (data: { id: string; status: string }) => api(`/milestones/${data.id}`, { method: 'PATCH', body: JSON.stringify({ status: data.status }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['milestones'] }); onNotice('Milestone updated.'); },
  });
  const canEdit = ['owner','admin','portfolio_manager','project_manager','team_lead'].includes(role);
  if (query.isLoading || projectsQuery.isLoading) return <LoadingPage />;
  if (query.isError || projectsQuery.isError) return <QueryError error={query.error || projectsQuery.error} retry={() => void query.refetch()} />;
  const tasksQuery = query.data;
  return <>
    <div className="flex justify-end">{canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />New milestone</button>}</div>
    {tasksQuery?.length ? <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Milestone plan" title="Delivery calendar" /><div className="divide-y divide-slate-100">{tasksQuery.map((milestone) => <div key={milestone.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_0.8fr_130px_150px] md:items-center"><div><div className="font-semibold">{milestone.name}</div><div className="text-xs text-slate-500">{milestone.project_name}</div></div><div className="text-sm text-slate-600">{shortDate(milestone.due_date)}</div><div><StatusBadge value={milestone.status} /></div>{canEdit ? <select aria-label={`Update ${milestone.name} status`} className={`${inputClass} py-1.5`} value={milestone.status} onChange={(event) => update.mutate({ id: milestone.id, status: event.target.value })}>{['On track','Needs attention','Delayed','Complete'].map((status) => <option key={status}>{status}</option>)}</select> : <div />}</div>)}</div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Milestones are ordered by committed due date. Drag-to-reschedule is not enabled.</div></div> : <EmptyState title="No milestones yet" detail="Create milestones to make delivery dates visible to the portfolio." action={canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />Create milestone</button>} />}
    <div className={`${panelClass} p-5`}><div className="mb-4 flex items-center gap-2"><CalendarDays size={17} className="text-[#3563E9]" /><h2 className="font-semibold">Project schedule overview</h2></div><div className="space-y-3">{projectsQuery.data?.items.map((project) => <div key={project.id} className="grid gap-2 sm:grid-cols-[180px_1fr_120px] sm:items-center"><div className="truncate text-sm font-medium">{project.code} · {project.name}</div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${project.lifecycle_stage === 'At Risk' ? 'bg-amber-500' : 'bg-[#3563E9]'}`} style={{ width: `${Math.max(4, project.actual_progress)}%` }} /></div><div className="text-xs text-slate-500">{project.actual_progress}% · {shortDate(project.target_completion_date)}</div></div>)}</div><p className="mt-4 text-xs text-slate-500">Progress bars show actual progress; this compact roadmap is not a dependency-scaled Gantt schedule.</p></div>
    <Modal open={open} title="Create milestone" onClose={() => setOpen(false)}><SimpleForm busy={create.isPending} error={create.error?.message} submitLabel="Create milestone" onSubmit={(form) => create.mutate({ project_id: form.project_id, name: form.name, due_date: form.due_date, status: form.status })}><Field label="Project"><select className={inputClass} name="project_id" required>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field><Field label="Milestone"><input className={inputClass} name="name" required minLength={2} /></Field><Field label="Due date"><input className={inputClass} type="date" name="due_date" required /></Field><Field label="Status"><select className={inputClass} name="status"><option>On track</option><option>Needs attention</option><option>Delayed</option><option>Complete</option></select></Field></SimpleForm></Modal>
  </>;
}

function ResourcesPage({ onNotice, role }: { onNotice: (message: string) => void; role: Role }) {
  const client = useQueryClient();
  const [resourceOpen, setResourceOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const query = useQuery({ queryKey: ['resources'], queryFn: () => api<{ resources: Resource[]; assignments: Assignment[] }>('/resources') });
  const projectsQuery = useQuery({ queryKey: ['projects', '', ''], queryFn: () => api<{ items: Project[] }>('/projects') });
  const createResource = useMutation({
    mutationFn: (data: object) => api('/resources', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resources'] }); setResourceOpen(false); onNotice('Resource added.'); },
  });
  const assign = useMutation({
    mutationFn: (data: object) => api('/assignments', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['resources'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); setAssignmentOpen(false); onNotice('Resource assignment created.'); },
  });
  const canEdit = ['owner','admin','portfolio_manager','team_lead'].includes(role);
  if (query.isLoading || projectsQuery.isLoading) return <LoadingPage />;
  if (query.isError || projectsQuery.isError) return <QueryError error={query.error || projectsQuery.error} retry={() => void query.refetch()} />;
  return <>
    <div className="flex flex-wrap justify-end gap-2">{canEdit && <><button className={buttonSecondary} onClick={() => setResourceOpen(true)}><Plus size={15} />Add resource</button><button className={buttonPrimary} onClick={() => setAssignmentOpen(true)}><Users size={15} />Assign resource</button></>}</div>
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard title="Team members" value={query.data?.resources.length || 0} detail="Capacity records in this workspace" /><MetricCard title="Assigned this week" value={query.data?.assignments.length || 0} detail="Assignments active today" /><MetricCard title="Overallocated" value={query.data?.resources.filter((item) => item.allocated_percent > 100).length || 0} detail="Resource allocations above 100%" /></div>
    {query.data?.resources.length ? <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Capacity planning" title="Resource allocation" /><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Resource</th><th className="px-4 py-3">Team / role</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Available hours / wk</th><th className="px-4 py-3">Allocation</th><th className="px-4 py-3">Capacity view</th></tr></thead><tbody>{query.data.resources.map((resource) => <tr key={resource.id} className="border-t border-slate-100"><td className="px-5 py-3 font-semibold">{resource.name}</td><td className="px-4 py-3 text-slate-600">{resource.department} · {resource.role}</td><td className="px-4 py-3 text-slate-600">{resource.location || '—'}</td><td className="px-4 py-3">{resource.weekly_capacity_hours}h</td><td className="px-4 py-3">{resource.allocated_percent}%</td><td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${resource.allocated_percent > 100 ? 'bg-rose-500' : resource.allocated_percent > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, resource.allocated_percent)}%` }} /></div><span className="text-xs text-slate-500">{resource.allocated_percent > 100 ? 'Over capacity' : `${resource.weekly_capacity_hours * resource.allocated_percent / 100}h allocated`}</span></div></td></tr>)}</tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Utilization = allocated working hours ÷ available weekly hours × 100. Weekly capacity is configured as project-available hours; leave calendars are not yet modeled.</div></div> : <EmptyState title="No resources yet" detail="Add team capacity before creating assignments." action={canEdit && <button className={buttonPrimary} onClick={() => setResourceOpen(true)}><Plus size={16} />Add resource</button>} />}
    <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Active workload" title="Project assignments" />{query.data?.assignments.length ? <div className="divide-y divide-slate-100">{query.data.assignments.map((assignment) => <div key={assignment.id} className="grid gap-1 px-5 py-3 sm:grid-cols-4 sm:items-center"><span className="font-medium">{assignment.resource_name}</span><span className="text-sm text-slate-600">{assignment.project_name}</span><span className="text-sm text-slate-600">{assignment.allocation_percent}% allocation</span><span className="text-xs text-slate-500">{shortDate(assignment.start_date)} – {shortDate(assignment.end_date)}</span></div>)}</div> : <p className="p-5 text-sm text-slate-500">No assignments are active today.</p>}</div>
    <Modal open={resourceOpen} title="Add resource" onClose={() => setResourceOpen(false)}><SimpleForm busy={createResource.isPending} error={createResource.error?.message} submitLabel="Add resource" onSubmit={(form) => createResource.mutate({ name: form.name, role: form.role, department: form.department, location: form.location, weekly_capacity_hours: Number(form.weekly_capacity_hours || 30) })}><Field label="Name"><input className={inputClass} name="name" required minLength={2} /></Field><Field label="Role"><input className={inputClass} name="role" /></Field><Field label="Department"><input className={inputClass} name="department" /></Field><Field label="Location"><input className={inputClass} name="location" /></Field><Field label="Project-available hours / week"><input className={inputClass} name="weekly_capacity_hours" type="number" min="0" max="168" defaultValue="30" /></Field></SimpleForm></Modal>
    <Modal open={assignmentOpen} title="Assign a resource" onClose={() => setAssignmentOpen(false)}><SimpleForm busy={assign.isPending} error={assign.error?.message} submitLabel="Assign resource" onSubmit={(form) => assign.mutate({ project_id: form.project_id, resource_id: form.resource_id, allocation_percent: Number(form.allocation_percent), start_date: form.start_date, end_date: form.end_date })}><Field label="Resource"><select className={inputClass} name="resource_id" required>{query.data?.resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.allocated_percent}% allocated</option>)}</select></Field><Field label="Project"><select className={inputClass} name="project_id" required>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field><Field label="Allocation (%)"><input className={inputClass} name="allocation_percent" type="number" min="1" max="100" defaultValue="25" required /></Field><Field label="Start date"><input className={inputClass} name="start_date" type="date" required /></Field><Field label="End date"><input className={inputClass} name="end_date" type="date" required /></Field><p className="md:col-span-2 text-xs text-slate-500">The API rejects overlapping assignments that exceed 100% allocation.</p></SimpleForm></Modal>
  </>;
}

function MetricCard({ title, value, detail }: { title: string; value: ReactNode; detail: string }) {
  return <div className={`${panelClass} p-4`}><div className="text-sm text-slate-500">{title}</div><div className="mt-1 text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}

function FinancePage({ organization, onNotice, role }: { organization: Organization; onNotice: (message: string) => void; role: Role }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['finance'], queryFn: () => api<FinancialData>('/finance') });
  const projectsQuery = useQuery({ queryKey: ['projects', '', ''], queryFn: () => api<{ items: Project[] }>('/projects') });
  const create = useMutation({
    mutationFn: (data: object) => api('/finance/entries', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['finance'] }); await client.invalidateQueries({ queryKey: ['projects'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); setOpen(false); onNotice('Financial entry recorded.'); },
  });
  const canEdit = ['owner','admin','finance_viewer'].includes(role);
  if (query.isLoading || projectsQuery.isLoading) return <LoadingPage />;
  if (query.isError || projectsQuery.isError) {
    if (query.error instanceof RequestError && query.error.status === 403) return <CenteredState title="Financial access restricted" message="Your organization role does not grant access to project financial information." />;
    return <QueryError error={query.error || projectsQuery.error} retry={() => void query.refetch()} />;
  }
  const variance = (query.data?.summary.budget_cents ?? 0) - (query.data?.summary.actual_cents ?? 0);
  return <>
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard title="Approved budget" value={money(query.data?.summary.budget_cents || 0, organization.currency)} detail="Approved project budget total" /><MetricCard title="Actual expenditure" value={money(query.data?.summary.actual_cents || 0, organization.currency)} detail="Sum of recorded actual entries" /><MetricCard title="Forecast at completion" value={money(query.data?.summary.forecast_cents || 0, organization.currency)} detail="Sum of latest recorded forecast entries" /></div>
    <div className="flex justify-end">{canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />Record cost / forecast</button>}</div>
    <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Project financials" title="Budget variance" action={<span className={`text-sm font-semibold ${(variance || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{money(variance || 0, organization.currency)} remaining</span>} /><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Project</th><th className="px-4 py-3">Budget</th><th className="px-4 py-3">Actual</th><th className="px-4 py-3">Forecast</th><th className="px-4 py-3">Budget variance</th><th className="px-4 py-3">Forecast variance</th></tr></thead><tbody>{query.data?.projects.map((project) => <tr key={project.id} className="border-t border-slate-100"><td className="px-5 py-3"><div className="font-semibold">{project.name}</div><div className="text-xs text-slate-500">{project.code}</div></td><td className="px-4 py-3">{money(project.budget_cents, organization.currency)}</td><td className="px-4 py-3">{money(project.actual_cents, organization.currency)}</td><td className="px-4 py-3">{money(project.forecast_cents, organization.currency)}</td><td className={project.variance_cents >= 0 ? 'px-4 py-3 text-emerald-700' : 'px-4 py-3 text-rose-700'}>{money(project.variance_cents, organization.currency)}</td><td className={project.forecast_variance_cents >= 0 ? 'px-4 py-3 text-emerald-700' : 'px-4 py-3 text-rose-700'}>{money(project.forecast_variance_cents, organization.currency)}</td></tr>)}</tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Budget variance = approved budget − actual cost. Forecast variance = approved budget − forecast cost. Positive values are favorable. Persisted monetary values use integer minor currency units.</div></div>
    <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Ledger" title="Recorded entries" />{query.data?.entries.length ? <div className="divide-y divide-slate-100">{query.data.entries.map((entry) => <div key={entry.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[1fr_150px_120px_140px] sm:items-center"><div><div className="font-medium">{entry.project_name}</div><div className="text-xs text-slate-500">{entry.memo || entry.project_code}</div></div><span className="capitalize text-slate-600">{entry.entry_type.replace('_', ' ')}</span><span className="text-slate-600">{shortDate(entry.entry_date)}</span><strong>{money(entry.amount_cents, organization.currency)}</strong></div>)}</div> : <p className="p-5 text-sm text-slate-500">No financial entries are recorded yet.</p>}</div>
    <Modal open={open} title="Record financial entry" onClose={() => setOpen(false)}><SimpleForm busy={create.isPending} error={create.error?.message} submitLabel="Save entry" onSubmit={(form) => create.mutate({ project_id: form.project_id, entry_type: form.entry_type, amount_cents: Math.round(Number(form.amount) * 100), entry_date: form.entry_date, memo: form.memo })}><Field label="Project"><select className={inputClass} name="project_id" required>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field><Field label="Entry type"><select className={inputClass} name="entry_type"><option value="actual">Actual expenditure</option><option value="forecast">Forecast cost at completion</option></select></Field><Field label={`Amount (${organization.currency})`}><input className={inputClass} name="amount" type="number" min="0" step="0.01" required /></Field><Field label="Date"><input className={inputClass} name="entry_date" type="date" required /></Field><div className="md:col-span-2"><Field label="Memo"><input className={inputClass} name="memo" maxLength={500} /></Field></div></SimpleForm></Modal>
  </>;
}

function RisksPage({ onNotice, role }: { onNotice: (message: string) => void; role: Role }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['risks'], queryFn: () => api<Risk[]>('/risks') });
  const projectsQuery = useQuery({ queryKey: ['projects', '', ''], queryFn: () => api<{ items: Project[] }>('/projects') });
  const create = useMutation({
    mutationFn: (data: object) => api('/risks', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['risks'] }); await client.invalidateQueries({ queryKey: ['dashboard'] }); setOpen(false); onNotice('Risk recorded.'); },
  });
  const update = useMutation({
    mutationFn: (data: { id: string; status: string }) => api(`/risks/${data.id}`, { method: 'PATCH', body: JSON.stringify({ status: data.status }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['risks'] }); onNotice('Risk status updated.'); },
  });
  const canEdit = ['owner','admin','portfolio_manager','project_manager','team_lead'].includes(role);
  if (query.isLoading || projectsQuery.isLoading) return <LoadingPage />;
  if (query.isError || projectsQuery.isError) return <QueryError error={query.error || projectsQuery.error} retry={() => void query.refetch()} />;
  return <>
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard title="Open risks" value={query.data?.filter((risk) => risk.status !== 'Closed').length || 0} detail="Open, mitigating or accepted" /><MetricCard title="Critical exposure" value={query.data?.filter((risk) => risk.inherent_score >= 20 && risk.status !== 'Closed').length || 0} detail="Probability × impact score ≥ 20" /><MetricCard title="Escalated" value={query.data?.filter((risk) => risk.escalated).length || 0} detail="Flagged for executive attention" /></div>
    <div className="flex justify-end">{canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />New risk</button>}</div>
    {query.data?.length ? <div className={`${panelClass} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3">Risk</th><th className="px-4 py-3">Project / owner</th><th className="px-4 py-3">P × I</th><th className="px-4 py-3">Inherent</th><th className="px-4 py-3">Residual</th><th className="px-4 py-3">Review</th><th className="px-4 py-3">Status</th>{canEdit && <th className="px-4 py-3">Update</th>}</tr></thead><tbody>{query.data.map((risk) => <tr key={risk.id} className="border-t border-slate-100 align-top"><td className="px-5 py-3"><div className="font-semibold">{risk.title}</div><div className="mt-1 max-w-sm text-xs text-slate-500">{risk.mitigation || risk.description}</div>{risk.escalated ? <span className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">Escalated</span> : null}</td><td className="px-4 py-3"><div>{risk.project_name}</div><div className="text-xs text-slate-500">{risk.owner || 'Owner unassigned'} · {risk.category}</div></td><td className="px-4 py-3">{risk.probability} × {risk.impact}</td><td className="px-4 py-3"><StatusBadge value={`${risk.inherent_score}/25`} /></td><td className="px-4 py-3">{risk.residual_score}/25</td><td className="px-4 py-3">{shortDate(risk.review_date)}</td><td className="px-4 py-3"><StatusBadge value={risk.status} /></td>{canEdit && <td className="px-4 py-3"><select className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" value={risk.status} aria-label={`Update status for ${risk.title}`} onChange={(event) => update.mutate({ id: risk.id, status: event.target.value })}>{['Open','Mitigating','Accepted','Closed'].map((status) => <option key={status}>{status}</option>)}</select></td>}</tr>)}</tbody></table></div><div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Inherent and residual risk scores = probability × impact on a 1–5 scale (range 1–25); thresholds are configurable only by product changes in this MVP.</div></div> : <EmptyState title="Risk register is clear" detail="Record project risks with accountable owners and mitigation plans." action={canEdit && <button className={buttonPrimary} onClick={() => setOpen(true)}><Plus size={16} />Add a risk</button>} />}
    <Modal open={open} title="Create risk" onClose={() => setOpen(false)}><SimpleForm busy={create.isPending} error={create.error?.message} submitLabel="Create risk" onSubmit={(form) => create.mutate({ project_id: form.project_id, title: form.title, description: form.description, category: form.category, probability: Number(form.probability), impact: Number(form.impact), mitigation: form.mitigation, contingency: form.contingency, owner: form.owner, review_date: form.review_date || null, status: form.status, residual_probability: Number(form.residual_probability), residual_impact: Number(form.residual_impact), escalated: form.escalated === 'on' })}><Field label="Project"><select className={inputClass} name="project_id" required>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.code} · {project.name}</option>)}</select></Field><Field label="Risk title"><input className={inputClass} name="title" required minLength={2} /></Field><Field label="Category"><input className={inputClass} name="category" defaultValue="Delivery" /></Field><Field label="Risk owner"><input className={inputClass} name="owner" /></Field><Field label="Probability (1–5)"><select className={inputClass} name="probability">{[1,2,3,4,5].map((number) => <option key={number}>{number}</option>)}</select></Field><Field label="Impact (1–5)"><select className={inputClass} name="impact">{[1,2,3,4,5].map((number) => <option key={number}>{number}</option>)}</select></Field><Field label="Residual probability (1–5)"><select className={inputClass} name="residual_probability">{[1,2,3,4,5].map((number) => <option key={number}>{number}</option>)}</select></Field><Field label="Residual impact (1–5)"><select className={inputClass} name="residual_impact">{[1,2,3,4,5].map((number) => <option key={number}>{number}</option>)}</select></Field><Field label="Review date"><input className={inputClass} name="review_date" type="date" /></Field><Field label="Status"><select className={inputClass} name="status"><option>Open</option><option>Mitigating</option><option>Accepted</option></select></Field><div className="md:col-span-2"><Field label="Description"><textarea className={inputClass} name="description" rows={2} /></Field></div><div className="md:col-span-2"><Field label="Mitigation plan"><textarea className={inputClass} name="mitigation" rows={2} /></Field></div><div className="md:col-span-2"><Field label="Contingency plan"><textarea className={inputClass} name="contingency" rows={2} /></Field></div><label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="escalated" className="rounded border-slate-300" />Escalate to executive action list</label></SimpleForm></Modal>
  </>;
}

function ReportsPage({ organization }: { organization: Organization }) {
  const query = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/dashboard') });
  const finance = useQuery({ queryKey: ['finance'], queryFn: () => api<FinancialData>('/finance') });
  const risks = useQuery({ queryKey: ['risks'], queryFn: () => api<Risk[]>('/risks') });
  const [reportDate] = useState(() => new Date().toLocaleDateString(undefined, { dateStyle: 'long' }));
  if (query.isLoading || finance.isLoading || risks.isLoading) return <LoadingPage />;
  if (query.isError || finance.isError || risks.isError) return <QueryError error={query.error || finance.error || risks.error} />;
  const data = query.data!;
  return <>
    <div className="flex flex-wrap justify-end gap-2 print:hidden"><button className={buttonSecondary} onClick={() => window.print()}><FileBarChart size={15} />Print review</button><a className={buttonSecondary} href={`${API}/reports/portfolio.csv`}><ArrowDownToLine size={15} />Portfolio CSV</a><a className={buttonSecondary} href={`${API}/reports/risk-register.csv`}><ArrowDownToLine size={15} />Risk CSV</a></div>
    <article className={`${panelClass} space-y-6 p-6 sm:p-8 print:border-0 print:shadow-none`}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#3563E9]">AbhiNexus · Portfolio review</div><h2 className="mt-2 text-2xl font-bold">{organization.name}</h2><p className="mt-1 text-sm text-slate-500">Prepared {reportDate} · {organization.currency} · Current recorded portfolio</p></div><StatusBadge value={data.illustrative_data ? 'Synthetic demo' : 'Current data'} /></div>
      <section><h3 className="font-semibold">Executive summary</h3><p className="mt-2 text-sm leading-6 text-slate-700">This report reflects {data.summary.active_projects} active projects, of which {data.summary.projects_at_risk} are flagged at risk. Approved budget is {money(data.summary.budget_cents ?? 0, organization.currency)}, actual expenditure is {money(data.summary.actual_cents ?? 0, organization.currency)}, and current forecast is {money(data.summary.forecast_cents ?? 0, organization.currency)}. {data.illustrative_data ? 'These are clearly labelled synthetic demonstration records and should not be represented as customer results.' : 'Values are computed from the organization’s current project and financial records.'}</p></section>
      <section className="grid gap-3 sm:grid-cols-4"><Metric label="Active projects" value={data.summary.active_projects} detail="Excludes completed, cancelled and archived" /><Metric label="At risk" value={data.summary.projects_at_risk} detail="At-risk lifecycle, critical health or rating" /><Metric label="Budget variance" value={money(data.summary.budget_variance_cents ?? 0, organization.currency)} detail="Approved budget minus actual cost" /><Metric label="Resource utilization" value={`${data.summary.resource_utilization_percent}%`} detail="Allocated project hours over available capacity" /></section>
      <section><h3 className="font-semibold">Delivery and financial position</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2">Project</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Progress</th><th className="px-3 py-2">Budget</th><th className="px-3 py-2">Actual</th><th className="px-3 py-2">Forecast</th></tr></thead><tbody>{data.projects.map((project) => <tr key={project.id} className="border-t border-slate-100"><td className="px-3 py-2">{project.code} · {project.name}</td><td className="px-3 py-2">{project.lifecycle_stage}</td><td className="px-3 py-2">{project.actual_progress}%</td><td className="px-3 py-2">{money(project.approved_budget_cents ?? 0, organization.currency)}</td><td className="px-3 py-2">{money(project.actual_cost_cents ?? 0, organization.currency)}</td><td className="px-3 py-2">{money(project.forecast_cost_cents ?? 0, organization.currency)}</td></tr>)}</tbody></table></div></section>
      <section><h3 className="font-semibold">Top risks and decisions</h3><ul className="mt-3 space-y-2">{(risks.data || []).filter((risk) => risk.status !== 'Closed').slice(0, 5).map((risk) => <li key={risk.id} className="rounded-xl border border-slate-200 p-3 text-sm"><strong>{risk.title}</strong> · score {risk.inherent_score}/25 · owner {risk.owner || 'unassigned'}<div className="mt-1 text-xs text-slate-600">Mitigation: {risk.mitigation || 'Not recorded'}</div></li>)}</ul><p className="mt-3 text-xs text-slate-500">Decisions required: assign owners to unowned risks; review negative budget/forecast variances; resolve resource capacity conflicts before approving new work.</p></section>
      <section><h3 className="font-semibold">Work and capacity exceptions</h3><p className="mt-2 text-sm text-slate-600">{data.summary.blocked_tasks} tasks are blocked by unfinished prerequisites; {data.summary.overdue_milestones} milestones are overdue; {data.summary.overallocated_resources} resources are overallocated.</p></section>
      <section><h3 className="font-semibold">Formula notes and assumptions</h3><p className="mt-2 text-xs leading-5 text-slate-500">Budget variance = approved budget − actual cost. Forecast variance = approved budget − forecast cost. Positive cost variances are favorable. On-time delivery uses completed projects with both an actual and target date. Resource utilization is weekly project-available hours allocated divided by configured available hours. Risk score is probability × impact on a 1–5 scale. No historical comparison is inferred without persisted snapshots.</p></section>
    </article>
  </>;
}

function NotificationsPage({ onRead }: { onRead: () => Promise<void> }) {
  const query = useQuery({ queryKey: ['notifications'], queryFn: () => api<Array<{ id: string; title: string; message: string; href: string; read_at: string | null; created_at: string }>>('/notifications') });
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['notifications'] }); },
  });
  if (query.isLoading) return <LoadingPage />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <>
    <div className="flex justify-end"><button className={buttonSecondary} onClick={() => void onRead()}>Mark all read</button></div>
    {query.data?.length ? <div className={`${panelClass} divide-y divide-slate-100`}>{query.data.map((notification) => <div key={notification.id} className={`flex items-start gap-3 p-4 ${notification.read_at ? '' : 'bg-blue-50/50'}`}><div className={`mt-0.5 rounded-lg p-2 ${notification.read_at ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}><Bell size={16} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="text-sm">{notification.title}</strong>{!notification.read_at && <span className="h-2 w-2 rounded-full bg-blue-600" />}</div><p className="mt-1 text-sm text-slate-600">{notification.message}</p><p className="mt-1 text-xs text-slate-400">{new Date(notification.created_at).toLocaleString()}</p></div>{!notification.read_at && <button className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => mutation.mutate(notification.id)}>Mark read</button>}</div>)}</div> : <EmptyState title="You’re all caught up" detail="In-app notification preferences and external email delivery are not configured in this MVP." />}
  </>;
}

function MembersPage({ role }: { role: Role }) {
  const allowed = ['owner','admin'].includes(role);
  const query = useQuery({ queryKey: ['members'], queryFn: () => api<Array<{ name: string; email: string; role: Role; created_at: string }>>('/members'), enabled: allowed });
  if (!allowed) return <CenteredState title="Member administration restricted" message="Only organization owners and administrators can view organization membership." />;
  if (query.isLoading) return <LoadingPage />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Organization access" title="Members" /><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Joined</th></tr></thead><tbody>{query.data?.map((member) => <tr key={member.email} className="border-t border-slate-100"><td className="px-5 py-3"><div className="font-medium">{member.name}</div><div className="text-xs text-slate-500">{member.email}</div></td><td className="px-4 py-3 capitalize">{member.role.replaceAll('_', ' ')}</td><td className="px-4 py-3 text-slate-600">{shortDate(member.created_at.slice(0, 10))}</td></tr>)}</tbody></table></div><div className="border-t border-slate-100 p-4 text-xs leading-5 text-slate-500">Invitation creation, email verification and delivery require a configured email provider and are not enabled. Member and role changes are not currently exposed in the UI.</div></div>;
}

function RolesPage({ role }: { role: Role }) {
  if (!['owner','admin'].includes(role)) return <CenteredState title="Permission matrix restricted" message="Only organization owners and administrators can view access-control details." />;
  const permissions = [
    ['Organization owner', 'Full organization access, membership and billing controls'],
    ['Organization admin', 'Workspace administration, members, audit and data operations'],
    ['Portfolio manager', 'Portfolio, project, task, resource, risk and reporting workflows'],
    ['Project manager', 'Project, task, milestone and risk updates'],
    ['Team lead', 'Task, resource assignment and risk operations'],
    ['Contributor', 'Read access to core portfolio and work records'],
    ['Finance viewer', 'Financial data and exports; can record financial entries'],
    ['Executive viewer', 'Read-only dashboard, reports and financial views'],
  ];
  return <div className={`${panelClass} overflow-hidden`}><SectionHeader eyebrow="Authorization model" title="Roles and permissions" /><div className="divide-y divide-slate-100">{permissions.map(([name, description]) => <div key={name} className="grid gap-1 px-5 py-4 md:grid-cols-[200px_1fr]"><strong className="text-sm">{name}</strong><span className="text-sm text-slate-600">{description}</span></div>)}</div><p className="border-t border-slate-100 p-4 text-xs leading-5 text-slate-500">Server-side role gates protect each write and sensitive read endpoint. Platform administrator is intentionally not implemented; no global support backdoor is present.</p></div>;
}

function AuditPage({ role }: { role: Role }) {
  const allowed = ['owner','admin'].includes(role);
  const query = useQuery({ queryKey: ['audit'], queryFn: () => api<Array<{ id: string; action: string; entity_type: string; entity_id: string; details: Record<string, unknown>; created_at: string; actor_name: string; actor_email: string }>>('/admin/audit'), enabled: allowed });
  if (!allowed) return <CenteredState title="Audit log restricted" message="Only organization owners and administrators can access the organization audit log." />;
  if (query.isLoading) return <LoadingPage />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return query.data?.length ? <div className={`${panelClass} overflow-hidden`}><div className="divide-y divide-slate-100">{query.data.map((event) => <div key={event.id} className="grid gap-2 px-5 py-3 md:grid-cols-[1fr_180px_180px] md:items-center"><div><div className="font-medium">{event.action}</div><div className="text-xs text-slate-500">{event.entity_type} · {event.entity_id}</div></div><div className="text-sm text-slate-600">{event.actor_name || event.actor_email || 'System'}</div><div className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</div></div>)}</div></div> : <EmptyState title="No audit events yet" detail="Security-sensitive changes will appear here." />;
}

function SubscriptionPage({ role, onNotice }: { role: Role; onNotice: (message: string) => void }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['subscription'], queryFn: () => api<{ plan: string; status: string; trial_ends_at: string | null; billing_live: boolean; limits: { projects: number | null; members: number | null }; usage: { projects: number } }>('/subscription') });
  const mutation = useMutation({
    mutationFn: (plan: string) => api('/subscription/plan', { method: 'PATCH', body: JSON.stringify({ plan }) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['subscription'] }); onNotice('Development plan updated. No payment was made.'); },
  });
  if (query.isLoading) return <LoadingPage />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  const plans = [
    { name: 'Starter', description: 'Small teams and core project delivery', projects: 10, members: 5 },
    { name: 'Professional', description: 'Portfolio, resource and financial workflows', projects: 50, members: 25 },
    { name: 'Business', description: 'Multi-team management and deeper analytics', projects: 200, members: 100 },
    { name: 'Enterprise', description: 'Custom limits and governance, subject to contract', projects: null, members: null },
  ];
  return <><div className={`${panelClass} flex flex-wrap items-center justify-between gap-4 p-5`}><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current subscription</div><div className="mt-1 text-xl font-bold">{query.data?.plan} · {query.data?.status}</div><div className="mt-1 text-sm text-slate-500">Project usage: {query.data?.usage.projects} / {query.data?.limits.projects ?? 'custom'}</div></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{query.data?.billing_live ? 'Billing active' : 'Simulator only'}</span></div><div className="grid gap-4 lg:grid-cols-2">{plans.map((plan) => <article key={plan.name} className={`${panelClass} p-5`}><div className="flex items-center justify-between"><h2 className="font-semibold">{plan.name}</h2>{query.data?.plan === plan.name && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-800">Current</span>}</div><p className="mt-1 text-sm text-slate-500">{plan.description}</p><div className="mt-4 text-sm">{plan.projects ?? 'Custom'} project limit · {plan.members ?? 'Custom'} member limit</div>{['owner','admin'].includes(role) && <button className={`${buttonSecondary} mt-4`} disabled={mutation.isPending || query.data?.plan === plan.name} onClick={() => mutation.mutate(plan.name)}>{mutation.isPending ? 'Updating…' : 'Select in development'}</button>}</article>)}</div><p className="text-xs leading-5 text-slate-500">No payment provider or webhook is configured. Plan selection is a local development simulator; do not treat it as a live subscription or billing event.</p></>;
}

function SettingsPage({ role, organization, onNotice }: { role: Role; organization: Organization; onNotice: (message: string) => void }) {
  const client = useQueryClient();
  const allowed = ['owner','admin'].includes(role);
  const query = useQuery({ queryKey: ['settings'], queryFn: () => api<{ organization: Organization & { industry: string; size_band: string }; settings: { weekly_capacity_hours: number; working_days: string } }>('/settings'), enabled: allowed });
  const mutation = useMutation({
    mutationFn: (data: object) => api('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ['settings'] }); await client.invalidateQueries({ queryKey: ['me'] }); onNotice('Organization settings saved.'); },
  });
  if (!allowed) return <CenteredState title="Organization settings restricted" message="Only organization owners and administrators can change workspace settings." />;
  if (query.isLoading) return <LoadingPage />;
  if (query.isError) return <QueryError error={query.error} retry={() => void query.refetch()} />;
  return <div className={`${panelClass} p-5`}><SimpleForm busy={mutation.isPending} error={mutation.error?.message} submitLabel="Save settings" onSubmit={(form) => mutation.mutate({ name: form.name, industry: form.industry, size_band: form.size_band, currency: form.currency, weekly_capacity_hours: Number(form.weekly_capacity_hours), working_days: [1,2,3,4,5] })}><Field label="Organization name"><input className={inputClass} name="name" defaultValue={query.data?.organization.name || organization.name} required minLength={2} /></Field><Field label="Industry"><input className={inputClass} name="industry" defaultValue={query.data?.organization.industry} /></Field><Field label="Organization size"><select className={inputClass} name="size_band" defaultValue={query.data?.organization.size_band}><option>Small</option><option>Mid-market</option><option>Enterprise</option></select></Field><Field label="Reporting currency"><select className={inputClass} name="currency" defaultValue={query.data?.organization.currency}>{['USD','INR','EUR','GBP','CAD','AUD'].map((currency) => <option key={currency}>{currency}</option>)}</select></Field><Field label="Project-available hours / week"><input className={inputClass} name="weekly_capacity_hours" type="number" min="1" max="168" defaultValue={query.data?.settings.weekly_capacity_hours} /></Field><p className="md:col-span-2 text-xs leading-5 text-slate-500">Changing organization currency does not convert existing amounts; all persisted entries retain the organization’s configured currency code.</p></SimpleForm></div>;
}

function IntegrationsPage() {
  const integrations = [
    ['Email delivery', 'Not configured', 'Configure a transactional email provider before invitations and password resets can be sent.'],
    ['Identity provider / SSO', 'Not implemented', 'SAML/OIDC and SCIM need provider metadata, security review and provisioning tests.'],
    ['Billing provider', 'Not configured', 'Subscription selection is a development simulator; no payment collection is enabled.'],
    ['Calendar / work tools', 'Not implemented', 'No external calendar, chat or project-tool connection has been configured.'],
  ];
  return <div className="grid gap-4 lg:grid-cols-2">{integrations.map(([name, status, description]) => <article key={name} className={`${panelClass} p-5`}><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{name}</h2><StatusBadge value={status} /></div><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></article>)}</div>;
}

function SimpleForm({ children, busy, error, submitLabel, onSubmit }: {
  children: ReactNode;
  busy: boolean;
  error?: string;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
}) {
  return <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])));
  }}>
    {children}
    {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 md:col-span-2">{error}</p>}
    <div className="flex items-center justify-end gap-3 pt-1 md:col-span-2"><button className={buttonPrimary} disabled={busy} type="submit">{busy ? 'Saving…' : submitLabel}</button></div>
  </form>;
}

function Modal({ open, title, onClose, children, wide = false }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6`}><div className="mb-5 flex items-center justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">AbhiNexus workspace</div><h2 className="mt-1 text-xl font-bold">{title}</h2></div><button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>{children}</section></div>;
}

export default App;
