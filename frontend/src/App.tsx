export function App() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--ink-app)' }} className="label">
        Ilham
      </p>
      <p className="ar" dir="rtl" style={{ fontSize: 'var(--fs-ar-matn)' }}>
        الحمد لله
      </p>
      <p>
        A database value looks like this: <span className="m">1234</span>
      </p>
    </div>
  );
}
