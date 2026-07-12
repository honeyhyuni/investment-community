export function Notice({
  message,
  error,
  info,
}: {
  message?: string;
  error?: string;
  info?: string;
}) {
  return (
    <>
      {message ? (
        <p className="mt-4 rounded-md border border-positive/30 bg-positive-surface px-3 py-2 text-sm text-positive">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-negative/30 bg-negative-surface px-3 py-2 text-sm text-negative">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          {info}
        </p>
      ) : null}
    </>
  );
}
