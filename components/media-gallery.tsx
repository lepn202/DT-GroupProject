/* eslint-disable @next/next/no-img-element -- signed URLs from private storage */
export function MediaGallery({ paths, urls }: { paths: string[]; urls: Record<string, string> }) {
  const items = paths.filter((p) => urls[p]);
  if (!items.length) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((p) => (
        <li key={p} className="overflow-hidden rounded-lg border border-border bg-muted">
          {/\.(jpe?g|png|webp|gif)$/i.test(p) ? (
            <a href={urls[p]} target="_blank" rel="noreferrer">
              <img src={urls[p]} alt="Report photo" className="aspect-[4/3] w-full object-cover" />
            </a>
          ) : (
            <video src={urls[p]} controls playsInline className="aspect-[4/3] w-full bg-black object-contain" />
          )}
        </li>
      ))}
    </ul>
  );
}
