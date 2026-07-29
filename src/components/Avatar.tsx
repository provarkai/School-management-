const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  url,
  name,
  size = "md",
}: {
  url: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = SIZE_CLASSES[size];

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600`}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
