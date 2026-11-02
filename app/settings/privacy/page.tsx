import Link from "next/link";
import { Icon } from "../../ui-icon";

/** Shows privacy information about voice processing. */
export default function SettingsPrivacyPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),900px)] pt-[56px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-10 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[34px]">
        <div className="mb-[27px]"><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Privacy</h1><p className="mt-2 text-[15px] text-[#818b83]">Learn how Nia handles voice input in this workspace.</p></div>
        <article className="rounded-xl border border-[#e6ebe4] bg-white p-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="key" size={18} /></span><span><strong className="block text-[14px] font-semibold text-[#3d4941]">Voice stays on your device</strong><span className="mt-1 block text-[13px] leading-5 text-[#858f86]">Microphone audio is analyzed in your browser to animate the voice orb. Speech recognition depends on your browser’s built-in service.</span></span></div>
        </article>
      </div>
    </section>
  );
}
