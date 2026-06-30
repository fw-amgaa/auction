import { getResults } from "@/lib/results";
import { requirePageAccess } from "@/lib/session";

import { ResultsManager } from "./ResultsManager";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  await requirePageAccess("results.view");
  const { rows, kpis } = await getResults();
  return <ResultsManager rows={rows} kpis={kpis} />;
}
