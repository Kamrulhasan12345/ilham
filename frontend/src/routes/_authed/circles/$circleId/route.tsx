import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/circles/$circleId')({
  component: () => <Outlet />,
});
