"use client";

import { useState } from "react";
import { Button } from "@neup/components/ui/button";
import { Link } from "@neup/components/ui/link";
import { Icon } from "../ui-icon";

const example = `curl https://api.nia.neupgroup.com/v1/chat/completions \\
  -H "Authorization: Bearer $NIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "nia-assistant",
    "messages": [{ "role": "user", "content": "Hello, Nia" }]
  }'`;

export default function ApiPage() {
  const [copied, setCopied] = useState(false);
  async function copyExample() { await navigator.clipboard.writeText(example); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  return <section className="api-page"><header className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>API</strong></div><Link href="https://github.com/neupgroup/neup.cloud" target="_blank" rel="noreferrer" className="docs-link">API setup guide <Icon name="arrow" size={15} /></Link></header><div className="api-content"><div className="page-intro"><div className="page-icon"><Icon name="code" size={19} /></div><p className="page-eyebrow">DEVELOPER ACCESS</p><h1>Nia API</h1><p className="page-description">Bring Nia into your own tools and workflows. One API, built around the way you work.</p></div><div className="api-status-row"><div className="api-status"><span className="api-pending-dot" /><div><strong>API access</strong><span>Service connection needed</span></div></div><Button variant="outlined" className="key-button" disabled title="API key management will be available when Nia’s API is connected"><Icon name="key" size={15} /> Create API key</Button></div><div className="api-two-col"><article className="api-card endpoint-card"><div className="card-title-row"><div><span className="card-eyebrow">GET STARTED</span><h2>Make your first request</h2></div><span className="method-pill">POST</span></div><div className="endpoint-line"><span>BASE URL</span><code>https://api.nia.neupgroup.com/v1</code></div><div className="code-head"><span>cURL</span><Button variant="plain" size="sm" onClick={copyExample}>{copied ? <Icon name="check" size={14} /> : <Icon name="copy" size={14} />}{copied ? "Copied" : "Copy"}</Button></div><pre className="code-block"><code>{example}</code></pre></article><article className="api-card access-card"><div className="access-icon"><Icon name="key" size={18} /></div><span className="card-eyebrow">YOUR CREDENTIALS</span><h2>Keep your keys safe</h2><p>API keys let your apps connect to Nia. Key creation will be enabled when the API service is connected.</p><div className="key-placeholder"><span className="key-placeholder-dot" /><span>No API keys yet</span></div><Button variant="solid" className="full-button" disabled title="API key management will be available when Nia’s API is connected"><Icon name="key" size={15} /> Create your first key</Button></article></div><div className="api-help"><span className="help-icon"><Icon name="help" size={17} /></span><div><strong>Need a hand?</strong><span>Explore the API setup guide or reach out to support.</span></div><Link href="https://github.com/neupgroup/neup.cloud" target="_blank" rel="noreferrer" className="help-link">Read the guide <Icon name="external" size={13} /></Link></div><p className="api-note">API access is being prepared for Nia. Keys and requests will be available when the service is connected.</p></div></section>;
}
