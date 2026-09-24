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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { NotebookPen } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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

  const grouped = new Map<number, { note_id: number; body: string }[]>();
  for (const note of data ?? []) {
    const list = grouped.get(note.hadith_id) ?? [];
    list.push(note);
    grouped.set(note.hadith_id, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <NotebookPen className="size-6" />
          Notes
        </h1>
        <p className="text-muted-foreground">
          Everything you wrote, grouped by hadith. Write new notes from a hadith page.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((n) => (
            <Card key={n}>
              <CardHeader>
                <Skeleton className="h-5 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The notes could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No notes yet</EmptyTitle>
            <EmptyDescription>Open any hadith and write the first one there.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-4">
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
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {notes.map((note) => (
                    <li key={note.note_id} className="flex items-start justify-between gap-2">
                      <span>{note.body}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(note.note_id)}
                      >
                        Delete
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
