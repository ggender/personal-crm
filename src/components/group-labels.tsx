/** A contact's groups as small tags in one line; what does not fit is cut off. */
export function GroupLabels({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <ul aria-label="Группы" className="mt-1.5 flex gap-1.5 overflow-hidden">
      {names.map((name) => (
        <li
          key={name}
          className="max-w-full shrink-0 truncate rounded-full bg-strip px-2 py-0.5 text-13 text-muted"
        >
          {name}
        </li>
      ))}
    </ul>
  );
}
