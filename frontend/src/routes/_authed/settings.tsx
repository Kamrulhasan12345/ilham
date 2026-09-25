import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../app/PageHeader';
import { ThemeSwitch } from '../../app/ThemeSwitch';
import { ApiError, apiFetch } from '../../lib/apiClient';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiFetch('/auth/change-password', z.unknown(), {
        method: 'POST',
        body: { current_password: currentPassword, new_password: newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed. Use it next time you sign in.');
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not change the password. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="How Ilham looks for you, and how you sign in." />

      <Section title="Appearance" description="Light or dark. The app remembers your choice.">
        <Card>
          <CardContent>
            <Field orientation="horizontal" className="justify-between">
              <div className="flex flex-col gap-1">
                <FieldLabel>Theme</FieldLabel>
                <FieldDescription>Switch between the light and the dark look.</FieldDescription>
              </div>
              <ThemeSwitch />
            </Field>
          </CardContent>
        </Card>
      </Section>

      <Section title="Password" description="Change the password you sign in with.">
        <Card>
          <form onSubmit={handleChangePassword}>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                    />
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                    />
                  </InputGroup>
                  <FieldDescription>Eight characters at least.</FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="mt-6 justify-end border-t pt-6">
              <Button type="submit" disabled={busy || !currentPassword || newPassword.length < 8}>
                Change password
              </Button>
            </CardFooter>
          </form>
        </Card>
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-8">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="max-w-2xl">{children}</div>
    </section>
  );
}
