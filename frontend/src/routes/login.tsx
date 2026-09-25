import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { AuthLayout } from '../app/AuthLayout';
import { ApiError, apiFetch } from '../lib/apiClient';

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
  const errorRef = useRef<HTMLDivElement>(null);

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
      navigate({ to: redirect || '/' });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      switchTo={
        <Button variant="ghost" asChild>
          <Link to="/register">Sign up</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-balance text-muted-foreground">
          Welcome back. Pick up your study where you left off.
        </p>
      </div>
      {/* docs/frontend-prd.md §7.1: a failed submit shows one plain error
          above the form, and focus moves to it. Alert takes no ref, so the
          focus target is this wrapper. */}
      {error ? (
        <div ref={errorRef} tabIndex={-1} className="outline-none">
          <Alert variant="destructive">
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="login-email">Email</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </InputGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
          <Field>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" /> : null}
              Sign in
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        New to Ilham?{' '}
        <Link to="/register" className="font-medium text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
