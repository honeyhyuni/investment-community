export function Notice({ message, error }: { message: string; error: string }) {
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
    </>
  );
}
