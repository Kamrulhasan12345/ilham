import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';

// A note has no title, no privacy flag, no updated_at, and no soft delete
// (docs/frontend-prd.md §7.22), so the UI offers none of those controls.
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
  const [hadithId, setHadithId] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notes'],
    queryFn: () => apiFetch('/notes', notesSchema),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['notes'] });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/notes', noteSchema, {
        method: 'POST',
        body: { hadith_id: Number(hadithId), body },
      });
      setHadithId('');
      setBody('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(noteId: number) {
    setError(null);
    try {
      await apiFetch(`/notes/${noteId}`, z.unknown(), {
        method: 'DELETE',
      });
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    }
  }

  const grouped = new Map<number, { note_id: number; body: string }[]>();
  for (const note of data ?? []) {
    const list = grouped.get(note.hadith_id) ?? [];
    list.push(note);
    grouped.set(note.hadith_id, list);
  }

  return (
    <div>
      <h1>Notes</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="note-hadith">Hadith number</label>
          <input
            id="note-hadith"
            type="number"
            required
            value={hadithId}
            onChange={(event) => setHadithId(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="note-body">Note</label>
          <input
            id="note-body"
            type="text"
            required
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        {error ? <p>{error}</p> : null}
        <Button type="submit" variant="primary" disabled={submitting}>
          Add note
        </Button>
      </form>

      {isLoading ? <p>Loading the notes…</p> : null}
      {isError || (!isLoading && !data) ? <p>The notes could not be loaded. Try again.</p> : null}
      {data && data.length === 0 ? <p>No notes yet. Add the first one above.</p> : null}
      {[...grouped].map(([hadithId, notes]) => (
        <section key={hadithId}>
          <h2>
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(hadithId) }}>
              Hadith <span className="m">[{hadithId}]</span>
            </Link>
          </h2>
          <ul>
            {notes.map((note) => (
              <li key={note.note_id}>
                {note.body}{' '}
                <Button type="button" variant="default" onClick={() => handleDelete(note.note_id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
