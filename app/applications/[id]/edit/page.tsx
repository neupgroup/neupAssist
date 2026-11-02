import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@neup/core/database/prisma";
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
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>Edit application</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Update the application details and the endpoints it provides.</p>
        </div>
        <EditApplicationForm application={{
          ...application,
          endpoints: JSON.stringify(application.endpoints, null, 2),
        }} />
      </div>
    </section>
  );
}
