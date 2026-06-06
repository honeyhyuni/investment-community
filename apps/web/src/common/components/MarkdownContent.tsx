export function MarkdownContent({
  markdown,
  onImageClick,
}: {
  markdown: string;
  onImageClick?: (url: string) => void;
}) {
  const lines = markdown.split(/\r?\n/);

  return (
    <div className="space-y-3 text-sm leading-7 text-[#344052]">
      {lines.map((line, index) => {
        const image = line.match(/^!\[([^\]]*)\]\((.+)\)$/);
        if (image) {
          return (
            <img
              key={index}
              src={image[2]}
              alt={image[1]}
              onClick={() => onImageClick?.(image[2])}
              className={`max-h-[720px] w-full rounded-md object-contain ${
                onImageClick ? "cursor-zoom-in" : ""
              }`}
            />
          );
        }
        if (line.startsWith("### ")) {
          return <h3 key={index} className="pt-2 text-lg font-semibold">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={index} className="pt-3 text-xl font-semibold">{line.slice(3)}</h2>;
        }
        if (line.startsWith("# ")) {
          return <h1 key={index} className="pt-4 text-2xl font-semibold">{line.slice(2)}</h1>;
        }
        if (line.startsWith("- ")) {
          return <p key={index} className="pl-4 before:mr-2 before:content-['•']">{line.slice(2)}</p>;
        }
        if (line.startsWith("> ")) {
          return <blockquote key={index} className="border-l-2 border-[#9ab8c5] pl-4 text-[#607086]">{line.slice(2)}</blockquote>;
        }
        if (!line.trim()) {
          return <div key={index} className="h-2" />;
        }
        return <p key={index} className="whitespace-pre-wrap">{line}</p>;
      })}
    </div>
  );
}
