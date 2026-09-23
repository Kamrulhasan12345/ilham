import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { PageHeader } from '../../../ui/PageHeader';
import styles from './index.module.css';

const circleSchema = z.object({
  circle_id: z.number(),
  teacher_id: z.number(),
  name: z.string(),
  created_at: z.string(),
});
const circlesSchema = z.array(circleSchema);

export const Route = createFileRoute('/_authed/circles/')({
  component: CirclesPage,
});

function CirclesPage() {
  // Live auth context, same source as the shell: role reads here can never
  // disagree with the header.
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['circles'],
    queryFn: () => apiFetch('/circles', circlesSchema),
  });

  const role = state.status === 'signed-in' ? state.user.role : null;
  const verifiedTeacher =
    state.status === 'signed-in' &&
    state.user.role === 'teacher' &&
    state.user.is_verified === true;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/circles', circleSchema, { method: 'POST', body: { name } });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Circles" />

      {role === 'teacher' && !verifiedTeacher ? (
        <p>
          Only a verified teacher opens a circle. Your account is waiting for review — the create
          control below stays disabled until an admin verifies it.
        </p>
      ) : null}
      {role === 'student' ? (
        <p>
          Only a teacher opens a circle. You see here the circles you joined; enrolment happens
          through your teacher.
        </p>
      ) : null}

      {role === 'teacher' ? (
        <form onSubmit={handleSubmit}>
          <Field label="New circle name">
            {({ controlId, describedBy }) => (
              <Input
                id={controlId}
                aria-describedby={describedBy}
                type="text"
                required
                disabled={!verifiedTeacher || submitting}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          {error ? <p>{error}</p> : null}
          <Button type="submit" variant="primary" disabled={!verifiedTeacher || submitting}>
            Open circle
          </Button>
        </form>
      ) : null}

      {isLoading ? <p>Loading the circles…</p> : null}
      {isError || (!isLoading && !data) ? <p>The circles could not be loaded. Try again.</p> : null}
      {data && data.length === 0 ? <p>No circles yet.</p> : null}
      {data && data.length > 0 ? (
        <div>
          {data.map((circle) => (
            <Card key={circle.circle_id} className={styles.row}>
              {role === 'teacher' || role === 'admin' ? (
                <Link to="/circles/$circleId" params={{ circleId: String(circle.circle_id) }}>
                  {circle.name}
                </Link>
              ) : (
                circle.name
              )}
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
