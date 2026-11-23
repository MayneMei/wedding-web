import type { Metadata } from "next";
import RegistryPage from "@/components/registry-page";
import { settings } from "@/lib/wedding-server";

export const metadata: Metadata = {
  title: "Maggie & Mayne · Gift Registry",
  description: "The wedding gift registry for Maggie and Mayne.",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  return <RegistryPage items={(await settings()).registry} />;
}
