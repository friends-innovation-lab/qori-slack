/**
 * TopBar — Agency lockup, search entry, user menu.
 * Height: 56px (--layout-topbar). Sticky at top.
 */

import { useNavigate } from 'react-router';
import { Search, Menu } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { UserMenu } from './UserMenu';
import styles from './TopBar.module.css';

interface TopBarProps {
  onMenuToggle: () => void;
  navCollapsed: boolean;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { me } = useAuth();
  const navigate = useNavigate();

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

      <div className={styles.end}>
        <UserMenu />
      </div>
    </header>
  );
}
