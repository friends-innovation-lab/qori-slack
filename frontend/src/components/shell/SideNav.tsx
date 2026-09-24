/**
 * SideNav — Global navigation + pinned studies.
 * Variants: default (expanded 264px, icon rail 64px, mobile sheet),
 *           inverse (64px dark rail for workspace routes).
 */

import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import {
  Home,
  FolderOpen,
  BookOpen,
  Search,
  MessageSquare,
  ListChecks,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { UserMenu } from './UserMenu';
import styles from './SideNav.module.css';

interface SideNavProps {
  /** Visual variant: default or inverse (workspace dark rail) */
  variant?: 'default' | 'inverse';
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onMobileClose: () => void;
}

const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/projects', icon: FolderOpen, label: 'Projects' },
  { to: '/studies', icon: BookOpen, label: 'Studies' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/ask', icon: MessageSquare, label: 'Ask Qori' },
  { to: '/queue', icon: ListChecks, label: 'Work Queue', hasBadge: true },
];

export function SideNav({
  variant = 'default',
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onMobileClose,
}: SideNavProps) {
  const { me } = useAuth();
  const navRef = useRef<HTMLElement>(null);
  const [tooltipItem, setTooltipItem] = useState<string | null>(null);

  const isInverse = variant === 'inverse';

  // Close mobile nav on Escape
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onMobileClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  // Trap focus in mobile nav
  useEffect(() => {
    if (!mobileOpen || !navRef.current) return;
    const firstFocusable = navRef.current.querySelector<HTMLElement>(
      'button, a, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, [mobileOpen]);

  const isAdmin = me?.memberships.some((m) => m.role === 'owner');

  // Inverse variant — 64px dark rail
  if (isInverse) {
    return (
      <nav
        ref={navRef}
        className={styles.navInverse}
        aria-label="Main"
      >
        <div className={styles.mark}>
          <img src="/assets/qori_logo.png" alt="Qori" width={24} height={24} />
        </div>

        <ul className={styles.list} role="list">
          {navItems.map((item) => (
            <li key={item.to} className={styles.itemWrapper}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${styles.itemInverse} ${isActive ? styles.activeInverse : ''}`
                }
                onMouseEnter={() => setTooltipItem(item.to)}
                onMouseLeave={() => setTooltipItem(null)}
                onFocus={() => setTooltipItem(item.to)}
                onBlur={() => setTooltipItem(null)}
              >
                <item.icon size={20} aria-hidden="true" />
                <span className={styles.labelHidden}>{item.label}</span>
              </NavLink>
              {tooltipItem === item.to && (
                <span className={styles.navTooltip} aria-hidden="true">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>

        {isAdmin && (
          <>
            <div className={styles.dividerInverse} role="separator" />
            <ul className={styles.list} role="list">
              <li className={styles.itemWrapper}>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `${styles.itemInverse} ${isActive ? styles.activeInverse : ''}`
                  }
                  onMouseEnter={() => setTooltipItem('/admin')}
                  onMouseLeave={() => setTooltipItem(null)}
                  onFocus={() => setTooltipItem('/admin')}
                  onBlur={() => setTooltipItem(null)}
                >
                  <Settings size={20} aria-hidden="true" />
                  <span className={styles.labelHidden}>Admin</span>
                </NavLink>
                {tooltipItem === '/admin' && (
                  <span className={styles.navTooltip} aria-hidden="true">
                    Admin
                  </span>
                )}
              </li>
            </ul>
          </>
        )}

        <div className={styles.footerInverse}>
          <UserMenu variant="inverse" />
        </div>
      </nav>
    );
  }

  // Default variant
  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className={styles.backdrop}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <nav
        ref={navRef}
        className={`${styles.nav} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
        aria-label="Main"
      >
        <div className={styles.mobileHeader}>
          <span className={styles.mobileTitle}>Navigation</span>
          <button
            className={styles.closeButton}
            onClick={onMobileClose}
            aria-label="Close navigation"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <ul className={styles.list} role="list">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${styles.item} ${isActive ? styles.active : ''}`
                }
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={20} aria-hidden="true" />
                {!collapsed && (
                  <span className={styles.label}>{item.label}</span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {isAdmin && (
          <>
            <div className={styles.divider} role="separator" />
            <ul className={styles.list} role="list">
              <li>
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `${styles.item} ${isActive ? styles.active : ''}`
                  }
                  onClick={onMobileClose}
                  title={collapsed ? 'Admin' : undefined}
                >
                  <Settings size={20} aria-hidden="true" />
                  {!collapsed && <span className={styles.label}>Admin</span>}
                </NavLink>
              </li>
            </ul>
          </>
        )}

        <div className={styles.footer}>
          <button
            className={styles.collapseButton}
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            type="button"
          >
            {collapsed ? (
              <PanelLeftOpen size={16} />
            ) : (
              <>
                <PanelLeftClose size={16} />
                <span className={styles.label}>Collapse</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
