import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiFetch } from '../lib/apiClient';
import { Button } from '../ui/Button';
import styles from './auth-form.module.css';

const loginResponseSchema = z.object({ accessToken: z.string() });

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { auth } = Route.useRouteContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // docs/frontend-prd.md §7.1: a failed submit shows one plain error above
  // the form, and moves focus to it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { accessToken } = await apiFetch('/auth/login', loginResponseSchema, {
        method: 'POST',
        body: { email, password },
      });
      // §5.3: signIn does the rest (setAccessToken, GET /auth/me, sign-in state).
      await auth.signIn(accessToken);
      navigate({ to: redirect || '/collections' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1>Sign in</h1>

      {error ? (
        <p ref={errorRef} tabIndex={-1} className={styles.formError}>
          {error}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password">Password</label>
          <div className={styles.passwordRow}>
            <input
              id="login-password"
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              type="button"
              variant="default"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={submitting}>
          Sign in
        </Button>
      </form>

      <p>
        <Link to="/register">Create an account</Link>
      </p>
    </div>
  );
}
