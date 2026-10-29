import Image from "next/image";

type PropertyRecord = Record<string, unknown>;

/** Reads a non-empty display string from a property field. */
function readDisplayValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return new Intl.NumberFormat("en").format(value);
  return null;
}

/** Chooses a usable title from the saved property data. */
function getPropertyTitle(property: PropertyRecord): string {
  return readDisplayValue(property.title) ?? readDisplayValue(property.name) ?? readDisplayValue(property.propertyName) ?? "Saved property";
}

/** Reads the first available image URL from common property media fields. */
function getPropertyImage(property: PropertyRecord): string | null {
  const images = Array.isArray(property.images) ? property.images : [];
  const firstImage = images.find((image) => image && typeof image === "object") as Record<string, unknown> | undefined;
  return readDisplayValue(property.image)
    ?? readDisplayValue(property.imageUrl)
    ?? readDisplayValue(property.coverImage)
    ?? readDisplayValue(images[0])
    ?? (firstImage ? readDisplayValue(firstImage.url) : null);
}

/** Reads a property location as text without exposing nested object data. */
function getPropertyLocation(property: PropertyRecord): string | null {
  const location = property.location;
  if (typeof location === "string") return readDisplayValue(location);
  if (location && typeof location === "object" && !Array.isArray(location)) {
    const parts = Object.values(location as Record<string, unknown>).map(readDisplayValue).filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return readDisplayValue(property.address) ?? readDisplayValue(property.city) ?? readDisplayValue(property.area);
}

/** Renders one saved estate property as a compact chat card. */
export function EstateSavedProperty({ property: rawProperty }: { property: PropertyRecord }) {
  const nestedProperty = rawProperty.property && typeof rawProperty.property === "object" && !Array.isArray(rawProperty.property)
    ? rawProperty.property as PropertyRecord
    : {};
  const property = { ...nestedProperty, ...rawProperty };
  const title = getPropertyTitle(property);
  const image = getPropertyImage(property);
  const price = readDisplayValue(property.price) ?? readDisplayValue(property.amount);
  const location = getPropertyLocation(property);
  const propertyType = readDisplayValue(property.type) ?? readDisplayValue(property.propertyType);
  const savedAt = readDisplayValue(property.savedAt) ?? readDisplayValue(property.createdAt);
  const propertyId = readDisplayValue(property.propertyId) ?? readDisplayValue(property.id);
  const displayTitle = title === "Saved property" && propertyId ? `Property ${propertyId}` : title;

  return <article className="estate-saved-property-card">
    {image
      ? <Image className="estate-saved-property-image" src={image} alt="" width={76} height={68} unoptimized />
      : <span className="estate-saved-property-placeholder" aria-hidden="true">⌂</span>}
    <div className="estate-saved-property-content">
      <strong>{displayTitle}</strong>
      {price && <span className="estate-saved-property-price">{price}</span>}
      {(location || propertyType) && <span className="estate-saved-property-meta">{[propertyType, location].filter(Boolean).join(" · ")}</span>}
      {savedAt && <span className="estate-saved-property-meta">Saved {savedAt}</span>}
    </div>
  </article>;
}
