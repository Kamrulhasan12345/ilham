import { createFileRoute } from '@tanstack/react-router';
import { ThemeSwitch } from '../../app/ThemeSwitch';
import { PageHeader } from '../../ui/PageHeader';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" />
      <section aria-label="Appearance">
        <h2 className="label">Appearance</h2>
        <ThemeSwitch />
      </section>
    </div>
  );
}
