import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/')({
  component: HomeStub,
});

function HomeStub() {
  return <p>You are signed in. The collections index lands in the Browse phase.</p>;
}
