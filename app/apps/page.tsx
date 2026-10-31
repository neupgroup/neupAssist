import { getCookie } from "@neup/core/helpers/cookie";
import Link from "next/link";
import { ensureAccount } from "@/services/account";
import { prisma } from "@/prisma/client/server";

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
    const account = await ensureAccount(await getCookie("auth_account"));
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
    <section className="keys-page">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Apps and Integrations</strong></div>
      </header>
      <div className="keys-content">
        <div className="page-intro">
          <div className="page-icon"><span aria-hidden="true" className="text-lg">⌘</span></div>
          <p className="page-eyebrow">CONNECTED SERVICES</p>
          <h1>Apps and Integrations</h1>
          <p className="page-description">Browse and connect applications for your workspace.</p>
        </div>

        <label className="mb-5 block">
          <span className="sr-only">Search applications</span>
          <input type="search" placeholder="Search applications" className="h-11 w-full rounded-lg border border-[#dfe5df] bg-white px-4 text-sm text-[#465349] outline-none placeholder:text-[#89938a] focus:border-[#78927b] focus:ring-2 focus:ring-[#78927b]/15" />
        </label>

        {error ? (
          <div className="api-card keys-empty" role="status">Could not load apps and integrations from the database.</div>
        ) : (
          <section aria-label="Applications">
            {applications.length === 0 ? (
              <div className="keys-empty">No applications have been added yet.</div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {applications.map((application) => (
                  <Link key={application.id} href={`/apps/${application.id}`} className="block rounded-lg border border-[#edf0ec] bg-white p-4 transition-colors hover:border-[#c8d7c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78927b]">
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
