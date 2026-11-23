"use client";

import { useRef, useState } from "react";
import type { RegistryItem } from "@/db/schema";
import { GuestFooter, GuestHeader, RegistryList, useWeddingLanguage } from "./wedding-guest-ui";

export default function RegistryPage({ items }: { items: RegistryItem[] }) {
  const { zh, toggle } = useWeddingLanguage();
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState("");
  const linkField = useRef<HTMLInputElement>(null);

  async function copyLink() {
    const url = new URL("/registry", window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFallback("");
    } catch {
      setFallback(url);
      requestAnimationFrame(() => linkField.current?.select());
    }
  }

  return <div className="wedding-site">
    <GuestHeader zh={zh} toggle={toggle} registryPage />
    <main className="site-width registry-standalone">
      <div className="registry-letter">
        <span className="registry-ornament" aria-hidden="true">✧ <span>♡</span> ✧</span>
        <p className="eyebrow">Maggie &amp; Mayne</p>
        <h1>{zh ? "礼物清单" : "Gift Registry"}</h1>
        <p className="registry-message">{zh ? "能和你一起庆祝，就是最好的礼物。谢谢你惦记着我们！" : "Celebrating with you is the best gift. Thank you for thinking of us!"}</p>
        <RegistryList items={items} zh={zh} />
        <div className="registry-actions">
          <button type="button" className="button" onClick={copyLink}>{zh ? "复制清单链接" : "Copy registry link"}</button>
          <a className="text-button" href="/">{zh ? "返回婚礼首页" : "Back to the wedding"}</a>
        </div>
        {copied && <p className="copy-status" role="status">{zh ? "链接已复制。" : "Registry link copied."}</p>}
        {fallback && <label className="input-label copy-fallback">
          {zh ? "复制此链接" : "Copy this link"}
          <input ref={linkField} readOnly value={fallback} onFocus={(event) => event.target.select()} />
        </label>}
      </div>
    </main>
    <GuestFooter />
  </div>;
}
