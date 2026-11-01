import { Link } from "@neup/components/ui/link";
import { Icon } from "./ui-icon";

/** Shows a helpful message when a requested page does not exist. */
export default function NotFound() {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[#e4eae2] bg-white text-[#67866d]">
          <Icon name="search" size={24} />
        </div>
        <p className="mb-2 mt-6 text-xs font-bold tracking-[.14em] text-[#77917a]">404 · PAGE NOT FOUND</p>
        <h1 className="m-0 text-3xl font-medium tracking-[-.05em] text-[#26332c]">This page wandered off.</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[#818b83]">
          The link may be outdated, or the page may have moved. Head back to your workspace and continue from there.
        </p>
        <Link href="/chat" className="mx-auto mt-7 inline-flex h-10 items-center gap-2 rounded-lg bg-[#52785e] px-4 text-sm font-medium text-white transition-colors hover:bg-[#456b51]">
          <Icon name="chat" size={16} />
          Go to chat
        </Link>
      </div>
    </section>
  );
}
