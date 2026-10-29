import Image from "next/image";

/** Displays one or more images included in a chat response. */
export function ChatImages({ images }: { images: string[] }) {
  return <div className="my-[10px] flex flex-wrap gap-[9px]">
    {images.map((src, index) => <a className="block max-w-[min(100%,420px)] overflow-hidden rounded-[11px] border border-[#e5eae3] bg-[#f7f9f6]" href={src} target="_blank" rel="noreferrer" key={`${src}-${index}`} aria-label={`Open image ${index + 1}`}>
      <Image className="block max-h-[360px] w-full object-contain" src={src} alt={`Chat attachment ${index + 1}`} width={720} height={480} unoptimized />
    </a>)}
  </div>;
}
