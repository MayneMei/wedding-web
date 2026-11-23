"use client";

import { useEffect, useRef, useState } from "react";

type Props = { name: string; slot: string; token?: string; demo: boolean; uploaded: boolean; zh: boolean; closed: boolean };
type State = "idle" | "working" | "saved" | "error";

const SIZE = 720;

// Square-crop, downscale and re-encode the photo on the device, so uploads are small and EXIF (incl. GPS) is dropped.
async function prepare(file: File) {
  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
  const w = source.width, h = source.height;
  const side = Math.min(w, h);
  // Faces sit in the upper part of most portrait photos, so bias a tall crop upward.
  const sx = (w - side) / 2, sy = h > w ? (h - side) * .3 : (h - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(SIZE, side);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("encode")), "image/jpeg", .86));
}

export function HeadshotUpload({ name, slot, token, demo, uploaded, zh, closed }: Props) {
  const t = (en: string, cn: string) => zh ? cn : en;
  const endpoint = token ? `/api/photo/${token}?slot=${slot}` : "";
  const [preview, setPreview] = useState(uploaded && endpoint ? endpoint : "");
  const [state, setState] = useState<State>(uploaded ? "saved" : "idle");
  const input = useRef<HTMLInputElement>(null);
  const objectUrl = useRef("");
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);

  async function choose(file: File | undefined) {
    if (!file) return;
    setState("working");
    try {
      const blob = await prepare(file);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(blob);
      setPreview(objectUrl.current);
      if (endpoint && !demo) {
        const res = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
        if (!res.ok) throw new Error("upload");
      }
      setState("saved");
    } catch {
      setState("error");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setState("working");
    try {
      if (endpoint && !demo) {
        const res = await fetch(endpoint, { method: "DELETE" });
        if (!res.ok) throw new Error("delete");
      }
      setPreview("");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  const id = `headshot-${slot}`;
  return <div className="headshot" data-state={state}>
    <div className="headshot-frame" aria-hidden="true">
      {preview ? <img src={preview} alt="" /> : <span>📷</span>}
    </div>
    <div className="headshot-body">
      <strong>{name}</strong>
      <small role="status">
        {state === "working" ? t("Uploading…", "上传中…")
          : state === "saved" ? (demo ? t("Looks great! (Sample journey: not uploaded.)", "很好看！（试玩模式，不会上传）") : t("Got it, thank you!", "收到啦，谢谢！"))
            : state === "error" ? t("Couldn’t use that photo. Try a JPG or PNG.", "这张照片用不了，换一张 JPG 或 PNG 试试。")
              : t("A clear photo of your face", "一张清晰的正脸照")}
      </small>
      <div className="headshot-actions">
        <input ref={input} id={id} className="headshot-input" type="file" accept="image/*" disabled={closed || state === "working"}
          onChange={(e) => void choose(e.target.files?.[0])} />
        <label htmlFor={id} className="journey-button headshot-pick" aria-disabled={closed || state === "working"}>
          {preview ? t("Change photo", "换一张") : t("Upload photo", "上传照片")}
        </label>
        {preview && <button type="button" className="journey-link" disabled={state === "working"} onClick={() => void remove()}>{t("Remove", "删除")}</button>}
      </div>
    </div>
  </div>;
}
