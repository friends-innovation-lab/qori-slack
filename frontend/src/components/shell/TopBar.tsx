/**
 * TopBar — Agency lockup, search entry, user menu.
 * Height: 56px (--layout-topbar). Sticky at top.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import styles from './TopBar.module.css';

interface TopBarProps {
  onMenuToggle: () => void;
  navCollapsed: boolean;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [userMenuOpen]);

  // Close on Escape
  useEffect(() => {
    if (!userMenuOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [userMenuOpen]);

  const orgName = me?.organization.name || 'Qori';

  return (
    <header className={styles.topbar} role="banner">
      <div className={styles.start}>
        <button
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
          type="button"
        >
          <Menu size={20} />
        </button>

        <div className={styles.lockup}>
          <span className={styles.orgName}>{orgName}</span>
          <span className={styles.productName}>Qori Research Workspace</span>
        </div>
      </div>

      <div className={styles.center}>
        <button
          className={styles.searchTrigger}
          onClick={() => navigate('/search')}
          aria-label="Search, or ask Qori a question"
          type="button"
        >
          <Search size={16} aria-hidden="true" />
          <span className={styles.searchPlaceholder}>
            Search, or ask Qori a question...
          </span>
          <kbd className={styles.searchKbd}>⌘K</kbd>
        </button>
      </div>

      <div className={styles.end} ref={menuRef}>
        <button
          className={styles.userButton}
          onClick={() => setUserMenuOpen((prev) => !prev)}
          aria-expanded={userMenuOpen}
          aria-haspopup="menu"
          aria-label={`User menu for ${me?.actor.display_name || 'User'}`}
          type="button"
        >
          <User size={16} aria-hidden="true" />
          <span className={styles.userName}>
            {me?.actor.display_name || 'User'}
          </span>
        </button>

        {userMenuOpen && (
          <div className={styles.userMenu} role="menu">
            <button
              className={styles.menuItem}
              role="menuitem"
              onClick={async () => {
                setUserMenuOpen(false);
                await logout();
                navigate('/login');
              }}
              type="button"
            >
              <LogOut size={16} aria-hidden="true" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
