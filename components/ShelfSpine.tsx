import { bindingColour } from "./BookCover";

// One book on the room shelf. Height and width vary a little by title so the row looks like a real shelf.

export function ShelfSpine({ href, title, author, count }: { href: string; title: string; author?: string | null; count: number }) {
  const seed = title + (author ?? "");
  let h = 0;
  for (const c of seed) h = (h * 17 + c.charCodeAt(0)) >>> 0;
  const height = 112 + (h % 5) * 8;
  const width = 28 + (h % 3) * 4 + Math.min(count - 1, 3) * 6;

  return (
    <a
      href={href}
      title={author ? `${title} by ${author}` : title}
      className="flex items-center justify-center rounded-t-sm px-1 py-2 text-paper shadow-sm"
      style={{ background: bindingColour(seed), height, width }}
    >
      <span className="line-clamp-1 font-serif text-[11px] leading-none [writing-mode:vertical-rl] rotate-180">{title}</span>
      <span className="sr-only">
        {count > 1 ? `, ${count} people` : ""}
      </span>
    </a>
  );
}
