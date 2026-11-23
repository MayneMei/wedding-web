"use client";

import { useEffect, useState } from "react";
import type { RegistryItem } from "@/db/schema";

export function useWeddingLanguage() {
  const [zh, setZh] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("wedding-language"); } catch { /* Use browser language if storage is unavailable. */ }
    setZh(saved ? saved === "zh" : navigator.language.toLowerCase().startsWith("zh"));
  }, []);

  useEffect(() => {
    document.documentElement.lang = zh ? "zh-Hans" : "en";
  }, [zh]);

  function toggle() {
    try { localStorage.setItem("wedding-language", zh ? "en" : "zh"); } catch { /* The language switch also works without storage. */ }
    setZh(!zh);
  }

  return { zh, toggle };
}

export function GuestHeader({ zh, toggle, registryPage = false }: {
  zh: boolean;
  toggle: () => void;
  registryPage?: boolean;
}) {
  return <header className="site-header site-width">
    <a className="wordmark" href={registryPage ? "/" : "#top"} aria-label="Maggie and Mayne">M<span>&amp;</span>M</a>
    <nav aria-label={zh ? "婚礼导航" : "Wedding navigation"}>
      <a href={registryPage ? "/#details" : "#details"}>{zh ? "婚礼详情" : "Details"}</a>
      <a href={registryPage ? "/registry" : "#registry"} aria-current={registryPage ? "page" : undefined}>{zh ? "礼物清单" : "Registry"}</a>
      {!registryPage && <a href="#rsvp">RSVP</a>}
    </nav>
    <button className="language" type="button" onClick={toggle} aria-label={zh ? "Switch to English" : "切换到中文"}>
      {zh ? "EN" : "中文"}
    </button>
  </header>;
}

export function GuestFooter() {
  return <footer className="site-footer site-width">
    <span aria-hidden="true">✧</span><span>Maggie &amp; Mayne</span><span aria-hidden="true">✧</span>
  </footer>;
}

export function RegistryList({ items, zh }: { items: RegistryItem[]; zh: boolean }) {
  if (!items.length) return <p className="section-note">{zh ? "礼物清单整理好后会放在这里。" : "We’ll add our registry here when it’s ready."}</p>;
  return <ul className="registry-grid">
    {items.map((item, index) => <li key={index}>
      {item.url
        ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.name}</a>
        : <strong>{item.name}</strong>}
      {item.note && <p>{item.note}</p>}
    </li>)}
  </ul>;
}
