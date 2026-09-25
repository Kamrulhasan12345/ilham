import { Field, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError, apiFetch } from '../../lib/apiClient';

const studySetsSchema = z.array(z.object({ study_set_id: z.number(), name: z.string() }));
// A bab or kitab reply carries `added`; a single hadith reply does not.
const addedSchema = z.object({ added: z.number().optional() });

export type SetTarget = { hadith_id: number } | { bab_id: number } | { kitab_id: number };

/** Adds one hadith, or every hadith of a bab or a kitab, to a study set. */
export function AddToSet({ target, label }: { target: SetTarget; label: string }) {
  const id = useId();
  const sets = useQuery({ queryKey: ['sets'], queryFn: () => apiFetch('/sets', studySetsSchema) });
  const [busy, setBusy] = useState(false);

  async function add(setId: string) {
    if (!setId) return;
    setBusy(true);
    try {
      const { added } = await apiFetch(`/sets/${setId}/items`, addedSchema, {
        method: 'POST',
        body: target,
      });
      toast.success(
        added === undefined ? 'Saved to the set.' : `Added ${added} hadiths to the set.`,
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save to the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {sets.data && sets.data.length > 0 ? (
        <Select value="" onValueChange={add} disabled={busy}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose a set" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Study sets</SelectLabel>
              {sets.data.map((set) => (
                <SelectItem key={set.study_set_id} value={String(set.study_set_id)}>
                  {set.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm text-muted-foreground">
          No study sets yet — create one from the study sets page first.
        </p>
      )}
    </Field>
  );
}
