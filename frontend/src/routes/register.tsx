import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiFetch } from '../lib/apiClient';
import { Button } from '../ui/Button';
import styles from './auth-form.module.css';

const registerResponseSchema = z.object({ accessToken: z.string() });

type Role = 'student' | 'teacher';

export const Route = createFileRoute('/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = Route.useNavigate();
  const { auth } = Route.useRouteContext();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<Role>('student');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordFieldError, setPasswordFieldError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // docs/frontend-prd.md §7.2: same failed-submit behavior as /login — one
  // plain whole-form message, and focus moves to it.
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // The backend's zod schema requires password.min(8); catch it here as a
    // field-specific error rather than a round trip to the API.
    if (password.length < 8) {
      setPasswordFieldError('The password must have at least 8 characters.');
      return;
    }
    setPasswordFieldError(null);
    setSubmitting(true);
    setError(null);
    try {
      const { accessToken } = await apiFetch('/auth/register', registerResponseSchema, {
        method: 'POST',
        body: { email, password, full_name: fullName, role },
      });
      // §5.3: signIn does the rest (setAccessToken, GET /auth/me, sign-in state).
      // A fresh teacher lands on /collections like a student — the waiting
      // banner (§7.3) is a separate, later task.
      await auth.signIn(accessToken);
      navigate({ to: '/collections' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1>Register</h1>

      {error ? (
        <p ref={errorRef} tabIndex={-1} className={styles.formError}>
          {error}
        </p>
      ) : null}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            className={styles.input}
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="register-password">Password</label>
          <div className={styles.passwordRow}>
            <input
              id="register-password"
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={passwordFieldError ? 'register-password-error' : undefined}
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
          {passwordFieldError ? (
            <p id="register-password-error" className={styles.fieldError}>
              {passwordFieldError}
            </p>
          ) : null}
        </div>

        <fieldset className={styles.fieldset}>
          <legend>Role</legend>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="role"
              value="student"
              checked={role === 'student'}
              onChange={() => setRole('student')}
            />
            Student
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="role"
              value="teacher"
              checked={role === 'teacher'}
              onChange={() => setRole('teacher')}
            />
            Teacher
          </label>
          {/* Stated before the choice, not after — §7.2. */}
          <p className={styles.hint}>
            An admin verifies the ijaza or the institution before the first circle opens.
          </p>
        </fieldset>

        <Button type="submit" variant="primary" disabled={submitting}>
          Create account
        </Button>
      </form>

      <p>
        <Link to="/login">Sign in instead</Link>
      </p>
    </div>
  );
}
