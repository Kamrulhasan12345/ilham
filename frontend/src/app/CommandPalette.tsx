import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useRouter } from '@tanstack/react-router';
import { BookOpen, ChartColumn, GraduationCap, NotebookPen, Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { label: 'Collections', to: '/collections', icon: BookOpen },
  { label: 'Search the hadiths', to: '/search', icon: Search },
  { label: 'Narrators', to: '/narrators', icon: Users },
  { label: 'Circles', to: '/circles', icon: GraduationCap },
  { label: 'Study sets', to: '/sets', icon: BookOpen },
  { label: 'Notes', to: '/notes', icon: NotebookPen },
  { label: 'Analytics', to: '/analytics', icon: ChartColumn },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
}: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  function go(to: string, search?: Record<string, string | number>) {
    onOpenChange(false);
    void router.navigate({ to, search });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search and go to">
      {/* This CommandDialog variant ships no Command root of its own —
          without it cmdk reads a missing store and throws on open. */}
      <Command>
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Search the Arabic text, or go to a page…"
        />
        <CommandList>
          <CommandEmpty>No page matches.</CommandEmpty>
          {q.trim() ? (
            <CommandGroup heading="Search the corpus">
              <CommandItem
                value={`search-${q}`}
                onSelect={() => go('/search', { q: q.trim(), offset: 0 })}
              >
                <Search />
                <span>
                  Search for “<span dir="rtl">{q.trim()}</span>”
                </span>
              </CommandItem>
            </CommandGroup>
          ) : null}
          <CommandGroup heading="Go to">
            {NAV_ITEMS.map((item) => (
              <CommandItem key={item.label} value={item.label} onSelect={() => go(item.to)}>
                <item.icon />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
