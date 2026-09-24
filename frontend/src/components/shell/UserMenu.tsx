/**
 * UserMenu — User avatar trigger with sign-out menu.
 * Extracted from TopBar for reuse in SideNav inverse variant (DDR-01).
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import styles from './UserMenu.module.css';

interface UserMenuProps {
  /** Visual variant: default (TopBar) or inverse (SideNav dark rail) */
  variant?: 'default' | 'inverse';
}

export function UserMenu({ variant = 'default' }: UserMenuProps) {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const displayName = me?.actor.display_name || 'User';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Close on outside click
  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape and return focus
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  const isInverse = variant === 'inverse';
  const containerClass = isInverse ? styles.containerInverse : styles.container;
  const triggerClass = isInverse ? styles.avatarInverse : styles.trigger;
  const menuClass = isInverse ? styles.menuInverse : styles.menu;

  return (
    <div ref={menuRef} className={containerClass}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClass}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`User menu for ${displayName}`}
      >
        {isInverse ? (
          initials
        ) : (
          <>
            <User size={16} aria-hidden="true" />
            <span className={styles.userName}>{displayName}</span>
          </>
        )}
      </button>

      {open && (
        <div className={menuClass} role="menu">
          <button
            className={styles.menuItem}
            role="menuitem"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
