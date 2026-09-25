import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { ApiError, apiFetch } from '../../../lib/apiClient';

// A note has no title, no privacy flag, no updated_at, and no soft delete
// (docs/frontend-prd.md §7.22), so the UI offers none of those controls.
// This page is a library: it lists and deletes. Writing happens on the
// hadith page, at the point of study.
const noteSchema = z.object({
  note_id: z.number(),
  user_id: z.number(),
  hadith_id: z.number(),
  body: z.string(),
  created_at: z.string(),
});
const notesSchema = z.array(noteSchema);

export const Route = createFileRoute('/_authed/notes/')({
  component: NotesPage,
});

function NotesPage() {
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<number | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['notes'],
    queryFn: () => apiFetch('/notes', notesSchema),
  });

  async function handleDelete(noteId: number) {
    try {
      await apiFetch(`/notes/${noteId}`, z.unknown(), { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast.success('Note deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the note. Try again.');
    } finally {
      setDeleting(null);
    }
  }

  const grouped = new Map<number, { note_id: number; body: string; created_at: string }[]>();
  for (const note of data ?? []) {
    const list = grouped.get(note.hadith_id) ?? [];
    list.push(note);
    grouped.set(note.hadith_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notes"
        description="Everything you wrote, grouped by hadith. Write new notes from a hadith page."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((n) => (
            <Skeleton key={n} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The notes could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No notes yet</EmptyTitle>
            <EmptyDescription>Open any hadith and write the first one there.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {[...grouped].map(([groupHadithId, notes]) => (
            <Card key={groupHadithId}>
              <CardHeader>
                <CardTitle>
                  <Link
                    to="/hadiths/$hadithId"
                    params={{ hadithId: String(groupHadithId) }}
                    className="hover:underline"
                  >
                    Hadith {groupHadithId}
                  </Link>
                </CardTitle>
                <CardAction>
                  <Badge variant="secondary">
                    {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {notes.map((note) => (
                    <li
                      key={note.note_id}
                      className="flex items-start gap-2 rounded-lg bg-muted/50 p-3"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString('en', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        onClick={() => setDeleting(note.note_id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a note is final. The hadith stays where it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting !== null && handleDelete(deleting)}>
              Delete it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
