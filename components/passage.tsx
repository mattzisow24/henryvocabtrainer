/** A question passage. A blank is "______"; a marked word is wrapped as [[word]] and shown underlined. */
export function Passage({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\[\[.+?\]\]|_{4,})/g);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        part.startsWith("[[") ? (
          <span key={i} className="font-semibold underline decoration-2 underline-offset-4">
            {part.slice(2, -2)}
          </span>
        ) : /^_{4,}$/.test(part) ? (
          <span key={i} aria-label="blank" className="mx-0.5 inline-block w-16 border-b-2 border-ink align-baseline">
            &nbsp;
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}
