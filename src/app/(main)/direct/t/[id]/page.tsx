import { demoParams } from "@/lib/demo-build";
import ClientPage from "./page-client";

// Pre-rendered pages for the static demo build; rendered on demand otherwise.
export function generateStaticParams() {
  return demoParams("conversations");
}

// A server component (not a bare re-export), so Next reads generateStaticParams from this file.
export default function Page() {
  return <ClientPage />;
}
