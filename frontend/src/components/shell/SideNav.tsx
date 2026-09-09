/**
 * SideNav — Global navigation + pinned studies.
 * Variants: expanded 264px, icon rail 64px, mobile sheet.
 */

import { useEffect, useRef } from 'react';
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
import styles from './SideNav.module.css';

interface SideNavProps {
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
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onMobileClose,
}: SideNavProps) {
  const { me } = useAuth();
  const navRef = useRef<HTMLElement>(null);

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
