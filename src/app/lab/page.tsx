import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { labEnabled } from "@/lib/lab/guard";
import { LabApp } from "./_components/lab-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Structure Lab",
  robots: { index: false, follow: false },
};

export default function LabPage() {
  if (!labEnabled()) notFound();
  return <LabApp />;
}
