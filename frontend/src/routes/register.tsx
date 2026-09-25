import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { AuthLayout } from '../app/AuthLayout';
import { ApiError, apiFetch } from '../lib/apiClient';

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
  const errorRef = useRef<HTMLDivElement>(null);

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
      await auth.signIn(accessToken);
      navigate({ to: '/' });
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
          <Link to="/login">Sign in</Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Create an account</h1>
        <p className="text-balance text-muted-foreground">Join a circle and start studying.</p>
      </div>
      <div>
        {/* docs/frontend-prd.md §7.2: same failed-submit behavior as /login. */}
        {error ? (
          // Alert takes no ref (React 18, generated file), so the focus
          // target is this wrapper, not the Alert itself.
          <div ref={errorRef} tabIndex={-1} className="mb-6 outline-none">
            <Alert variant="destructive">
              <AlertTitle>Registration failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="register-name">Full name</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="register-email">Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="register-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </InputGroup>
            </Field>
            <Field data-invalid={passwordFieldError !== null}>
              <FieldLabel htmlFor="register-password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  aria-invalid={passwordFieldError !== null}
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
              <FieldDescription>Eight characters or more.</FieldDescription>
              {passwordFieldError ? <FieldError>{passwordFieldError}</FieldError> : null}
            </Field>
            <FieldSet>
              <FieldLabel>Role</FieldLabel>
              {/* Stated before the choice, not after — §7.2. */}
              <FieldDescription>
                An admin verifies the ijaza or the institution before the first circle opens.
              </FieldDescription>
              <RadioGroup
                value={role}
                onValueChange={(value) => setRole(value as Role)}
                className="flex gap-4"
              >
                <Field orientation="horizontal">
                  <RadioGroupItem value="student" id="role-student" />
                  <FieldLabel htmlFor="role-student">Student</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem value="teacher" id="role-teacher" />
                  <FieldLabel htmlFor="role-teacher">Teacher</FieldLabel>
                </Field>
              </RadioGroup>
            </FieldSet>
            <Field>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? <Spinner data-icon="inline-start" /> : null}
                Create account
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Sign in instead
        </Link>
      </p>
    </AuthLayout>
  );
}
