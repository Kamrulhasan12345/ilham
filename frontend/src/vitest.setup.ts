import '@testing-library/jest-dom/vitest';

// jsdom has no layout, so it refuses window.scrollTo and prints a
// "Not implemented" stack for every call. TanStack Router calls it on each
// navigation to restore scroll position, which buries real output under a
// dozen fake errors per run. Stub it: no test asserts on scroll position, and
// a no-op is exactly what a headless DOM should do here.
window.scrollTo = () => {};
