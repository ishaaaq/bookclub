import Image from "next/image";

// A cover from Open Library, or a plain cloth binding with the title when there isn't one.

const BINDINGS = ["#7a2e2a", "#2f4a3a", "#2c3e5c", "#6b4e2e", "#4a3552", "#3d4f4f"];

export function bindingColour(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BINDINGS[h % BINDINGS.length];
}

export function BookCover({
  title,
  author,
  coverUrl,
  className = "w-16",
}: {
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative aspect-[2/3] shrink-0 overflow-hidden rounded-sm shadow-sm ${className}`}>
      {coverUrl ? (
        <Image src={coverUrl} alt="" fill sizes="96px" className="object-cover" />
      ) : (
        <div
          className="flex h-full w-full items-center p-1 text-center font-serif text-[10px] leading-tight text-paper"
          style={{ background: bindingColour(title + (author ?? "")) }}
        >
          <span className="line-clamp-4 w-full">{title}</span>
        </div>
      )}
    </div>
  );
}
