import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Search } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { AppSidebar } from './AppSidebar';
import { CommandPalette } from './CommandPalette';
import { ThemeSwitch } from './ThemeSwitch';

export function Shell({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const role = state.status === 'signed-in' ? state.user.role : null;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-background focus:p-2"
        >
          Skip to content
        </a>
        {state.status === 'signed-in' ? <AppSidebar /> : null}
        <SidebarInset id="main" tabIndex={-1} className="outline-none">
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
            {state.status === 'signed-in' ? (
              <>
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-4" />
              </>
            ) : (
              <span className="text-sm font-semibold">
                Ilham{' '}
                <span dir="rtl" lang="ar" className="font-arabic">
                  إلهام
                </span>
              </span>
            )}
            {state.status === 'signed-in' ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setPaletteOpen(true)}
                  className="hidden max-w-md flex-1 justify-start font-normal text-muted-foreground md:flex"
                >
                  <Search data-icon="inline-start" />
                  <span className="flex-1 text-left">Search hadiths, narrators, pages…</span>
                  <kbd className="text-xs opacity-60">⌘K</kbd>
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPaletteOpen(true)}
                  aria-label="Search and go to"
                  className="md:hidden"
                >
                  <Search />
                </Button>
              </>
            ) : null}
            <span className="flex-1" />
            <ThemeSwitch />
          </header>
          {state.status === 'signed-in' && role === 'teacher' && state.user.is_verified !== true ? (
            <Alert className="rounded-none border-x-0 border-t-0">
              <AlertDescription>
                Your teaching account is waiting for review. You can build study sets, write notes,
                and review students. You cannot open a circle yet.
              </AlertDescription>
            </Alert>
          ) : null}
          {/* The single page column for every route: centered, capped,
              evenly padded. Pages must not add their own outer padding. */}
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
            {children}
          </div>
        </SidebarInset>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}
