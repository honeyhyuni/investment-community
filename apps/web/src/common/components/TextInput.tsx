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
      <span className="text-sm font-medium text-[#344052]">{label}</span>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type={type}
        required
        minLength={minLength}
        className="mt-1 h-11 w-full rounded-md border border-[#c7ceda] px-3 outline-none focus:border-[#1f6f8b]"
      />
    </label>
  );
}
