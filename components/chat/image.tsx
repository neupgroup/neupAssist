import Image from "next/image";

/** Displays one or more images included in a chat response. */
export function ChatImages({ images }: { images: string[] }) {
  return <div className="chat-images">
    {images.map((src, index) => <a className="chat-image-link" href={src} target="_blank" rel="noreferrer" key={`${src}-${index}`} aria-label={`Open image ${index + 1}`}>
      <Image className="chat-image" src={src} alt={`Chat attachment ${index + 1}`} width={720} height={480} unoptimized />
    </a>)}
  </div>;
}
