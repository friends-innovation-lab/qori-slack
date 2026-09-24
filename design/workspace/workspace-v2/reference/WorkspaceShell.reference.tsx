/**
 * DESIGN REFERENCE — NOT PRODUCTION
 * Do not import from runtime code. Shows the target DOM and class names for:
 *   AppShell variant="workspace"  (frontend/src/components/shell/AppShell.tsx)
 *   SideNav  variant="inverse"    (frontend/src/components/shell/SideNav.tsx)
 *   WorkspaceLayout (new)         (frontend/src/components/study/workspace/WorkspaceLayout.tsx)
 * No data fetching, no business logic, no canonical state. Local UI state only.
 * Spec: WORKSPACE_V2_SPEC.md §3, COMPONENT_MAPPING.md §3.1, §3.2, §3.18, RESPONSIVE.md §3.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Home, FolderOpen, BookOpen, Search, MessageSquare, ListChecks, Settings } from 'lucide-react';
import './tokens.reference.css';
import './workspace-v2.reference.css';

/* Production navItems — unchanged list (PF-10 / DDR-14: keep as-is). */
const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/studies', icon: BookOpen, label: 'Studies' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/ask', icon: MessageSquare, label: 'Ask Qori' },
  { to: '/queue', icon: ListChecks, label: 'Work Queue' },
];

/** Production decides this with matchPath() against WORKSPACE_ROUTE_PATTERNS. */
export const WORKSPACE_ROUTE_PATTERNS = ['/studies/:studyPublicId/plan', '/studies/:studyPublicId/brief'] as const;

export function AppShellWorkspaceReference({ children }: { children: ReactNode }) {
  return (
    <div className="shellWorkspace">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* ≤980: SideNav column is hidden here and re-rendered inside the WorkspaceLayout drawer */}
      <SideNavInverseReference activePath="/studies" isAdmin />
      <main id="main-content" className="main" role="main" tabIndex={-1}>
        {children}
      </main>
      <div role="status" aria-live="polite" aria-label="Notifications" />
    </div>
  );
}

export function SideNavInverseReference({ activePath, isAdmin }: { activePath: string; isAdmin?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const avatarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); avatarRef.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const Item = ({ to, icon: Icon, label }: (typeof navItems)[number]) => (
    <li style={{ position: 'relative' }}>
      {/* production: <NavLink className={({isActive}) => …}> */}
      <a href={to} className={`item${activePath === to ? ' active' : ''}`} aria-current={activePath === to ? 'page' : undefined}>
        <Icon size={20} aria-hidden="true" />
        <span className="label">{label}</span>{/* visually hidden, NOT removed (PF-17) */}
      </a>
      {/* tooltip: shown on :hover/:focus-visible of the link via CSS sibling rule; aria-hidden duplicate of the name */}
      <span className="navTooltip" aria-hidden="true" hidden>{label}</span>
    </li>
  );

  return (
    <nav className="nav navInverse" aria-label="Main">
      <div className="mark"><img src="/assets/qori_logo.png" alt="Qori" width={24} height={24} /></div>
      <ul className="list" role="list">{navItems.map((n) => <Item key={n.to} {...n} />)}</ul>
      {isAdmin && (<><div className="divider" role="separator" /><ul className="list" role="list"><Item to="/admin" icon={Settings} label="Admin" /></ul></>)}
      <div className="footer" style={{ position: 'relative' }}>
        {/* DDR-01: user menu relocated from TopBar. Same handlers (logout → navigate('/login')). */}
        <button ref={avatarRef} type="button" className="avatar" aria-haspopup="menu" aria-expanded={menuOpen}
          aria-label="User menu for Dana Ortiz" onClick={() => setMenuOpen((v) => !v)}>DO</button>
        {menuOpen && (
          <div role="menu" className="userMenu" style={{ position: 'absolute', left: 'calc(100% + 8px)', bottom: 0 }}>
            <button role="menuitem" type="button" className="menuItem">Sign out</button>
          </div>
        )}
      </div>
    </nav>
  );
}

/**
 * WorkspaceLayout — lifecycle slot · header · canvas (scroll owner) · rail slot.
 * navOpen/onNavClose are owned by the page (or AppShell context); drawer is modal only ≤980.
 */
export function WorkspaceLayoutReference({ nav, header, rail, navOpen, onNavClose, isDrawerViewport, children }: {
  nav: ReactNode; header: ReactNode; rail?: ReactNode; navOpen: boolean; onNavClose: () => void; isDrawerViewport: boolean; children: ReactNode;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!(isDrawerViewport && navOpen)) return;
    drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onNavClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);   // production: also restore focus to header nav toggle
  }, [isDrawerViewport, navOpen, onNavClose]);

  const drawerProps = isDrawerViewport
    ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Study navigation', 'aria-hidden': !navOpen || undefined }
    : {};

  return (
    <div className="workspace">
      <div id="workspace-nav" ref={drawerRef} className={`navRegion${navOpen ? ' navRegionOpen' : ''}`} {...drawerProps}>
        {isDrawerViewport && <SideNavInverseReference activePath="/studies" />}
        {nav}
      </div>
      <div className={`scrim${isDrawerViewport && navOpen ? ' scrimOpen' : ''}`} onClick={onNavClose} aria-hidden="true" />
      <div className="column">
        {header}
        <div className="body">
          <div className="canvas">{children}</div>
          {rail}
        </div>
      </div>
    </div>
  );
}
