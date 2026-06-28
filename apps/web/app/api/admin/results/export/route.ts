import { getCurrentUser } from "@/lib/session";
import { getResults } from "@/lib/results";

function csvCell(v: string | number | null): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Forbidden", { status: 403 });

  const { rows } = await getResults();
  const header = ["Код", "Зүйл", "Аймаг", "Хожсон оролцогч", "Хожсон үнэ", "Төлбөр", "Эрх олгосон"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.code, r.species, r.aimag ?? "", r.winnerName ?? "", r.price, r.payment, r.permitIssued ? "тийм" : "үгүй"]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = "﻿" + lines.join("\n"); // BOM for Excel + Cyrillic
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="results.csv"',
    },
  });
}
