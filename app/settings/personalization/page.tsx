"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../../ui-icon";

type PersonalizationSettings = {
  responseStyle: string;
  language: string;
  spokenResponses: boolean;
  voiceLanguage: string;
};

const defaultSettings: PersonalizationSettings = {
  responseStyle: "Balanced",
  language: "English",
  spokenResponses: true,
  voiceLanguage: "English (US)",
};

const settingsStorageKey = "nia.personalization";

/** Shows saved assistant language and voice preferences. */
export default function SettingsPersonalizationPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(settingsStorageKey);
      if (storedSettings) setSettings({ ...defaultSettings, ...JSON.parse(storedSettings) as Partial<PersonalizationSettings> });
    } catch {
      window.localStorage.removeItem(settingsStorageKey);
    } finally {
      setLoaded(true);
    }
  }, []);

  /** Saves a changed preference to local storage. */
  function updateSetting<Key extends keyof PersonalizationSettings>(key: Key, value: PersonalizationSettings[Key]) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(nextSettings));
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-[min(calc(100%-60px),900px)] pt-[56px] pb-[42px] max-[760px]:w-[min(calc(100%-40px),900px)] max-[760px]:pt-10 max-[600px]:w-[calc(100%-30px)] max-[600px]:pt-[34px]">
        <div className="mb-[27px]"><h1 className="m-0 text-4xl font-medium tracking-[-.055em] text-[#26332c]">Personalization</h1><p className="mt-2 text-[15px] text-[#818b83]">Choose how Nia communicates with you.</p></div>
        <div className="grid gap-3">
          <article className="rounded-xl border border-[#e6ebe4] bg-white p-4">
            <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="settings" size={18} /></span><span><strong className="block text-[14px] font-semibold text-[#3d4941]">Response preferences</strong><span className="mt-1 block text-[13px] leading-5 text-[#858f86]">Set the tone and language used in conversations.</span></span></div>
            <div className="grid gap-2 border-t border-[#edf0ec] pt-3">
              <label className="flex min-h-[40px] items-center justify-between gap-4 text-[13px] text-[#566258]"><span><strong className="block font-semibold">Response style</strong><span className="text-[#858f86]">Choose how Nia communicates with you.</span></span><select disabled={!loaded} className="h-9 min-w-[135px] rounded-[7px] border border-[#e3e8e1] bg-white px-[9px] text-[13px] text-[#566258]" value={settings.responseStyle} onChange={(event) => updateSetting("responseStyle", event.target.value)}><option>Balanced</option><option>Concise</option><option>Detailed</option></select></label>
              <label className="flex min-h-[40px] items-center justify-between gap-4 border-t border-[#edf0ec] pt-2 text-[13px] text-[#566258]"><span><strong className="block font-semibold">Language</strong><span className="text-[#858f86]">Language used for conversations.</span></span><select disabled={!loaded} className="h-9 min-w-[135px] rounded-[7px] border border-[#e3e8e1] bg-white px-[9px] text-[13px] text-[#566258]" value={settings.language} onChange={(event) => updateSetting("language", event.target.value)}><option>English</option><option>Nepali</option><option>Hindi</option></select></label>
            </div>
          </article>
          <article className="rounded-xl border border-[#e6ebe4] bg-white p-4">
            <div className="mb-3 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[#edf3ec] text-[#66836b]"><Icon name="voice" size={18} /></span><span><strong className="block text-[14px] font-semibold text-[#3d4941]">Voice</strong><span className="mt-1 block text-[13px] leading-5 text-[#858f86]">Adjust your voice assistant experience.</span></span></div>
            <div className="grid gap-2 border-t border-[#edf0ec] pt-3">
              <div className="flex min-h-[40px] items-center justify-between gap-4 text-[13px] text-[#566258]"><span><strong className="block font-semibold">Spoken responses</strong><span className="text-[#858f86]">Let Nia read responses aloud when using voice.</span></span><label className="relative inline-flex h-[19px] w-[34px] shrink-0 items-center"><input disabled={!loaded} className="peer absolute h-px w-px opacity-0" type="checkbox" checked={settings.spokenResponses} onChange={(event) => updateSetting("spokenResponses", event.target.checked)} aria-label="Enable spoken responses" /><span className="relative h-[19px] w-[34px] cursor-pointer rounded-[20px] bg-[#dce3dc] transition-colors after:ml-[3px] after:mt-[3px] after:block after:h-[13px] after:w-[13px] after:rounded-full after:bg-white after:shadow-[0_1px_2px_#23302520] after:content-[''] after:transition-transform peer-checked:bg-[#6b9270] peer-checked:after:translate-x-[15px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-focus-visible:outline-offset-2" /></label></div>
              <label className="flex min-h-[40px] items-center justify-between gap-4 border-t border-[#edf0ec] pt-2 text-[13px] text-[#566258]"><span><strong className="block font-semibold">Voice input language</strong><span className="text-[#858f86]">Language used to recognize your speech.</span></span><select disabled={!loaded} className="h-9 min-w-[135px] rounded-[7px] border border-[#e3e8e1] bg-white px-[9px] text-[13px] text-[#566258]" value={settings.voiceLanguage} onChange={(event) => updateSetting("voiceLanguage", event.target.value)}><option>English (US)</option><option>English (UK)</option><option>Nepali</option></select></label>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
