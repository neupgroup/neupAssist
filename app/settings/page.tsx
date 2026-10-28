"use client";

import { useEffect, useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Input } from "@neup/components/ui/input";
import { Icon } from "../ui-icon";

const sections = ["Profile", "Preferences", "Voice", "Privacy"] as const;
type SettingsSection = (typeof sections)[number];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("Profile");
  const [displayName, setDisplayName] = useState("Kishor Neupane");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedName = window.localStorage.getItem("nia.displayName");
    if (savedName) setDisplayName(savedName);
  }, []);

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem("nia.displayName", displayName.trim());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return <section className="settings-page"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Settings</strong></div><span className="settings-save-status">{saved ? <><Icon name="check" size={14} /> Saved</> : "Personal workspace"}</span></header><div className="settings-content"><div className="settings-heading"><p className="page-eyebrow">YOUR WORKSPACE</p><h1>Settings</h1><p>Make Nia feel more like yours.</p></div><div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections">{sections.map((section) => <button key={section} className={`settings-nav-item${activeSection === section ? " selected" : ""}`} onClick={() => setActiveSection(section)}>{section}</button>)}</nav><div className="settings-panel">{activeSection === "Profile" && <form onSubmit={saveProfile}><div className="settings-panel-header"><div><h2>Profile</h2><p>How Nia knows and addresses you.</p></div><span className="settings-avatar">K</span></div><label className="setting-field"><span>Display name</span><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" /></label><label className="setting-field"><span>Email address</span><Input type="email" value="" placeholder="Not connected to an account" readOnly /></label><div className="setting-divider" /><div className="setting-actions"><span className="setting-caption">Changes apply to your personal workspace.</span><Button type="submit" variant="solid" className="save-settings">Save changes</Button></div></form>}{activeSection === "Preferences" && <div className="settings-section-content"><div className="settings-panel-header"><div><h2>Preferences</h2><p>Set the tone for your conversations.</p></div></div><div className="setting-row"><div><strong>Response style</strong><span>Choose how Nia communicates with you.</span></div><select className="settings-select" defaultValue="Balanced"><option>Balanced</option><option>Concise</option><option>Detailed</option></select></div><div className="setting-row"><div><strong>Language</strong><span>Language used for conversations.</span></div><select className="settings-select" defaultValue="English"><option>English</option><option>Nepali</option><option>Hindi</option></select></div></div>}{activeSection === "Voice" && <div className="settings-section-content"><div className="settings-panel-header"><div><h2>Voice</h2><p>Adjust your voice assistant experience.</p></div></div><div className="setting-row"><div><strong>Spoken responses</strong><span>Let Nia read responses aloud when using voice.</span></div><label className="toggle-control"><input type="checkbox" defaultChecked /><span /></label></div><div className="setting-row"><div><strong>Voice input language</strong><span>Language used to recognize your speech.</span></div><select className="settings-select" defaultValue="English (US)"><option>English (US)</option><option>English (UK)</option><option>Nepali</option></select></div></div>}{activeSection === "Privacy" && <div className="settings-section-content"><div className="settings-panel-header"><div><h2>Privacy</h2><p>Control how this workspace handles your data.</p></div></div><div className="privacy-note"><span className="privacy-icon"><Icon name="key" size={17} /></span><div><strong>Voice stays on your device</strong><p>Microphone audio is analyzed in your browser to animate the voice orb. Speech recognition depends on your browser’s built-in service.</p></div></div><div className="setting-row"><div><strong>Conversation history</strong><span>Manage saved conversations for this workspace.</span></div><Button variant="outlined" size="sm" disabled>Coming soon</Button></div></div>}</div></div></div></section>;
}
