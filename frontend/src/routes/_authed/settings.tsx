import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';
import { Moon } from 'lucide-react';
import { ThemeSwitch } from '../../app/ThemeSwitch';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Moon className="size-4" />
            Appearance
          </CardTitle>
          <CardDescription>Light or dark. The app remembers your choice.</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitch />
        </CardContent>
      </Card>
    </div>
  );
}
