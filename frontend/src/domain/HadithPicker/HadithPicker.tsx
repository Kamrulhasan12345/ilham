import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '../../lib/apiClient';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import styles from './HadithPicker.module.css';

const hadithMatchSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  text_en: z.string().nullable(),
});
const hadithMatchesSchema = z.array(hadithMatchSchema);

export type HadithMatch = z.infer<typeof hadithMatchSchema>;

export interface HadithPickerProps {
  onSelect: (hadith: HadithMatch) => void;
}

const MIN_QUERY_LENGTH = 2;

/** A type-ahead over the hadith corpus, for picking a hadith to attach a
    note to instead of typing its raw database id. Not a full ARIA
    combobox — a plain labelled input plus a list of match buttons. */
export function HadithPicker({ onSelect }: HadithPickerProps) {
  const [query, setQuery] = useState('');

  const results = useQuery({
    queryKey: ['hadiths', 'picker', query],
    queryFn: () => apiFetch(`/hadiths?q=${encodeURIComponent(query)}&limit=10`, hadithMatchesSchema),
    enabled: query.trim().length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });

  function pick(hadith: HadithMatch) {
    onSelect(hadith);
    setQuery('');
  }

  return (
    <div className={styles.picker}>
      <Field label="Find a hadith" hint="Type at least two characters, in English or Arabic.">
        {({ controlId, describedBy }) => (
          <Input
            id={controlId}
            aria-describedby={describedBy}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </Field>
      {query.trim().length >= MIN_QUERY_LENGTH && results.data && results.data.length > 0 ? (
        <ul className={styles.matches}>
          {results.data.map((hadith) => (
            <li key={hadith.hadith_id}>
              <button type="button" className={styles.match} onClick={() => pick(hadith)}>
                <span className={`m ${styles.num}`}>{hadith.hadith_num}</span>
                {hadith.text_en ? (
                  <span className={styles.matchEn}>{hadith.text_en.slice(0, 100)}</span>
                ) : (
                  <span className="ar" dir="rtl">
                    {hadith.text_plain.slice(0, 100)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length >= MIN_QUERY_LENGTH && results.data && results.data.length === 0 ? (
        <p className="label">No hadith matches “{query}”.</p>
      ) : null}
    </div>
  );
}
