import { Sheet } from "@/components/sheet";
import Page from "@/app/artist/[slug]/page";

export const dynamic = "force-dynamic";

export default async function Intercepted({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Sheet label="Details">
      <Page params={params} />
    </Sheet>
  );
}
