import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ApiError, onSessionLost } from './lib/apiClient';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // A 4xx is the server's answer, not a flaky network: retrying a 404
      // three times is how one missing row becomes four identical requests.
      // Contract errors (zod) are client bugs and never heal on retry either.
      retry: (failureCount, error) => {
        if (error instanceof ApiError) return false;
        return failureCount < 2;
      },
    },
  },
});

function InnerApp() {
  const auth = useAuth();
  useEffect(() => {
    return onSessionLost(() => {
      router.invalidate();
    });
  }, []);
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
