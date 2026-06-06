export function Notice({ message, error }: { message: string; error: string }) {
  return (
    <>
      {message ? (
        <p className="mt-4 rounded-md border border-[#cddfce] bg-[#f1f8f1] px-3 py-2 text-sm text-[#27613a]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-[#efc8c8] bg-[#fff2f2] px-3 py-2 text-sm text-[#9a2f2f]">
          {error}
        </p>
      ) : null}
    </>
  );
}
