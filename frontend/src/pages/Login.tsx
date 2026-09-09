/**
 * Login page — placeholder for OIDC redirect flow.
 * In production: redirects to IdP authorization endpoint.
 * In dev: shows a simple form using the dev OIDC fixture.
 */

import styles from './Login.module.css';

export function Login() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.lockup}>
          <h1 className={styles.title}>Qori</h1>
          <p className={styles.subtitle}>Research Workspace</p>
        </div>

        <p className={styles.description}>
          Sign in with your organization account to continue.
        </p>

        <a
          href={`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/auth/oidc/authorize`}
          className={styles.signInButton}
        >
          Sign in
        </a>

        <p className={styles.footer}>
          Powered by Qori
        </p>
      </div>
    </div>
  );
}
