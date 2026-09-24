import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card';
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
    <AuthLayout>
      <Card>
        <CardHeader>
          <h1 className="font-heading text-base leading-snug font-medium">Sign in</h1>
          <CardDescription>Welcome back to your study.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* docs/frontend-prd.md §7.1: a failed submit shows one plain error
              above the form. Alert autofocuses it; no separate focus hook. */}
          {error ? (
            // Alert takes no ref (React 18, generated file), so the focus
            // target is this wrapper, not the Alert itself.
            <div ref={errorRef} tabIndex={-1} className="mb-4 outline-none">
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
              <Field orientation="horizontal">
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Spinner data-icon="inline-start" /> : null}
                  Sign in
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
        <CardFooter>
          <Button variant="link" asChild>
            <Link to="/register">Create an account</Link>
          </Button>
        </CardFooter>
      </Card>
    </AuthLayout>
  );
}
