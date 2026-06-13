export function TextInput({
  label,
  value,
  setValue,
  type = "text",
  minLength,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  type?: string;
  minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type={type}
        required
        minLength={minLength}
        className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-foreground outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}
