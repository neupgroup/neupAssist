import { notFound } from "next/navigation";
import { LetterImage } from "@neup/components/ui/letterImage";
import { getCookie } from "@neup/core/helpers/cookie";
import { ensureAccount } from "@neup/shared/account/self";
import { getPublicAccountToken } from "@/services/request/auth";

export const dynamic = "force-dynamic";

/** Loads and displays the signed-in user's account profile. */
export default async function ProfilePage() {
  const account = await ensureAccount(await getPublicAccountToken(getCookie));
  if (!account) notFound();

  const initials = account.displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="relative z-[1] flex h-[61px] shrink-0 items-center justify-between border-b border-border/70 bg-background/75 px-[34px] shadow-[0_3px_12px_rgb(32_48_38_/_5%)] max-[760px]:px-5 max-[600px]:h-[53px] max-[600px]:px-[15px]">
        <div className="flex items-center gap-[9px] text-[14px] text-[#989f99]"><span>Workspace</span><span className="text-[#c4c9c3]">/</span><strong className="font-semibold text-[#3e4942]">Profile</strong></div>
        <span className="text-[14px] text-[#738b76]">Account details</span>
      </header>
      <div className="mx-auto w-[min(calc(100%-60px),900px)] py-[39px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-7 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[22px]">
        <div className="mb-[27px]">
          <p className="mb-2 text-[12px] font-bold tracking-[.13em] text-[#77917a]">YOUR ACCOUNT</p>
          <h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Profile</h1>
          <p className="mt-2 text-[15px] text-[#818b83]">Your profile information from NeupID.</p>
        </div>

        <section className="overflow-hidden rounded-xl border border-[#e6ebe4] bg-white" aria-labelledby="profile-card-title">
          <div className="flex items-center gap-5 border-b border-[#edf0ec] px-6 py-6 max-[600px]:gap-4 max-[600px]:px-4">
            <LetterImage src={account.displayImage} initials={initials} alt={account.displayName} className="h-[76px] w-[76px] rounded-full border border-[#e6ebe4] text-2xl" />
            <div className="min-w-0">
              <h2 id="profile-card-title" className="m-0 truncate text-[21px] font-semibold tracking-[-.03em] text-[#344139]">{account.displayName}</h2>
              <p className="mt-1 text-[14px] text-[#7b877e]">{account.neupId ? `@${account.neupId}` : "NeupID profile"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-6 px-6 py-6 max-[600px]:grid-cols-1 max-[600px]:gap-y-5 max-[600px]:px-4">
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">Display name</dt><dd className="mt-1.5 break-words text-[14px] text-[#465349]">{account.displayName}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">NeupID</dt><dd className="mt-1.5 break-words text-[14px] text-[#465349]">{account.neupId ? `@${account.neupId}` : "Not set"}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">Account type</dt><dd className="mt-1.5 capitalize text-[14px] text-[#465349]">{account.type}</dd></div>
            <div><dt className="text-[12px] font-semibold uppercase tracking-[.08em] text-[#89938a]">Account status</dt><dd className="mt-1.5 capitalize text-[14px] text-[#465349]">{account.status}</dd></div>
          </dl>
        </section>
      </div>
    </section>
  );
}
