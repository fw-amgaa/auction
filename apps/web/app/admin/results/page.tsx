import { getResults } from "@/lib/results";

import { ResultsManager } from "./ResultsManager";

export const dynamic = "force-dynamic";

export default async function AdminResultsPage() {
  const { rows, kpis } = await getResults();
  return <ResultsManager rows={rows} kpis={kpis} />;
}
