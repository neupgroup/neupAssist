import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/prisma/client/server";
import { Icon } from "@/app/ui-icon";
import EditApplicationForm from "./edit-application-form";

export const dynamic = "force-dynamic";

/** Renders the edit form for an existing application. */
export default async function EditApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();

  const application = await prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      instructions: true,
      endpoints: true,
      authMethod: true,
      moreDetails: true,
      displayImage: true,
      coverImage: true,
    },
  });
  if (!application) notFound();

  return (
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><Link href="/apps">Apps and Integrations</Link><span className="crumb-slash">/</span><Link href={`/apps/${application.id}`}>{application.name}</Link><span className="crumb-slash">/</span><strong>Edit</strong></div>
        <Link href={`/apps/${application.id}`} className="text-sm text-[#738177] hover:text-[#365e45]">Back to application</Link>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><Icon name="code" size={19} /></div>
          <p className="page-eyebrow">APPLICATION CATALOG</p>
          <h1>Edit application</h1>
          <p className="page-description">Update the application details and the endpoints it provides.</p>
        </div>
        <EditApplicationForm application={{
          ...application,
          endpoints: JSON.stringify(application.endpoints, null, 2),
        }} />
      </div>
    </section>
  );
}
