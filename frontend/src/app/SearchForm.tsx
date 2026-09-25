import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

/** One large Arabic search field with its submit inside, for the corpus
    search pages. The query lives in the URL, so the field is uncontrolled. */
export function SearchForm({
  id,
  label,
  defaultValue,
  placeholder,
  hint,
  onSearch,
}: {
  id: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  hint?: ReactNode;
  onSearch: (q: string) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const value = new FormData(event.currentTarget).get('q');
        onSearch(typeof value === 'string' ? value : '');
      }}
    >
      <Field>
        <FieldLabel htmlFor={id} className="sr-only">
          {label}
        </FieldLabel>
        <InputGroup className="h-12">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            id={id}
            name="q"
            type="search"
            defaultValue={defaultValue}
            dir="rtl"
            placeholder={placeholder}
            className="text-base"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton type="submit" variant="default">
              Search
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </Field>
    </form>
  );
}
