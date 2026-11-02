import { redirect } from "next/navigation";

/** Redirects legacy application detail and edit URLs. */
export default async function LegacyApplicationRoute({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  redirect(slug.length ? `/applications/${slug.join("/")}` : "/applications");
}
