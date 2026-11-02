import { getCookie } from "@neup/core/helpers/cookie";
import Link from "next/link";
import { ensureAccount } from "@neup/shared/account/self";
import { prisma } from "@neup/core/database/prisma";
import { getPublicAccountToken } from "@/services/request/auth";

export const dynamic = "force-dynamic";

type AppDirectoryEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  instructions: string;
  endpoints: unknown;
  authMethod: string;
  moreDetails: string | null;
  displayImage: string | null;
  coverImage: string | null;
  _count: { integrations: number };
};

type AppsPageData = {
  applications: AppDirectoryEntry[];
  installedApplicationIds: string[];
  error: boolean;
};

/** Loads the application directory and IDs installed by the current account. */
async function loadAppsPageData(): Promise<AppsPageData> {
  try {
    const account = await ensureAccount(await getPublicAccountToken(getCookie));
    const [applications, integrations] = await Promise.all([
      prisma.application.findMany({
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
          _count: { select: { integrations: true } },
        },
        orderBy: { name: "asc" },
      }),
      account
        ? prisma.integration.findMany({
            where: { account_id: account.id },
            select: { application_id: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      applications,
      installedApplicationIds: integrations.map(({ application_id }) => application_id),
      error: false,
    };
  } catch {
    return { applications: [], installedApplicationIds: [], error: true };
  }
}

/** Renders a searchable directory of available applications. */
export default async function AppsAndIntegrationsPage() {
  const { applications, installedApplicationIds, error } = await loadAppsPageData();
  const installedApplicationIdSet = new Set(installedApplicationIds);

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),980px)] py-[39px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),980px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[25px] [&_h1]:m-0 [&_h1]:text-[clamp(35px,4vw,47px)] [&_h1]:font-medium [&_h1]:tracking-[-.055em] [&_h1]:text-foreground [&_p]:mb-0 [&_p]:mt-2 [&_p]:text-[15px] [&_p]:text-muted-foreground">
          <h1>Apps and Integrations</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Browse and connect applications for your workspace.</p>
        </div>

        <label className="mb-5 block">
          <span className="sr-only">Search applications</span>
          <input type="search" placeholder="Search applications" className="h-11 w-full rounded-lg border border-[#dfe5df] bg-white px-4 text-sm text-[#465349] outline-none placeholder:text-[#89938a] focus:border-[#78927b] focus:ring-2 focus:ring-[#78927b]/15" />
        </label>

        {error ? (
          <div className="rounded-xl border border-border bg-card p-[18px] flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground" role="status">Could not load apps and integrations from the database.</div>
        ) : (
          <section aria-label="Applications">
            {applications.length === 0 ? (
              <div className="flex min-h-[110px] items-center justify-center gap-[9px] rounded-lg border border-dashed border-border text-sm text-muted-foreground">No applications have been added yet.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {applications.map((application) => (
                  <Link key={application.id} href={`/applications/${application.id}`} className="block rounded-lg border border-[#edf0ec] bg-white p-4 transition-colors hover:border-[#c8d7c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78927b]">
                    <div className="flex items-center gap-3">
                      {application.displayImage && <img src={application.displayImage} alt="" className="h-10 w-10 rounded-lg border border-[#edf0ec] object-cover" />}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="mb-0 text-base font-semibold text-[#3c4940]">{application.name}</h2>
                          {installedApplicationIdSet.has(application.id) && <span className="rounded-full bg-[#edf4ec] px-2 py-0.5 text-[11px] font-semibold text-[#5b8062]">Installed</span>}
                        </div>
                        <p className="mb-0 mt-0.5 text-xs text-[#7c8c7e]">{application.category}</p>
                      </div>
                    </div>
                    <p className="mb-0 mt-3 text-sm leading-6 text-[#69756c]">{application.description}</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </section>
  );
}
