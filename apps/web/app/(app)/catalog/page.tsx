import { asc } from "drizzle-orm";

import { db, schema } from "@auction/db";
import { formatTugrug } from "@auction/shared";

// Reads live data — don't statically prerender at build time.
export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const species = await db
    .select()
    .from(schema.categories)
    .orderBy(asc(schema.categories.sortOrder));

  return (
    <main>
      <h1 className="text-2xl font-bold text-navy">Каталог</h1>
      <p className="mt-1 text-sm text-ink-soft">Амьтны төрлөөр сонгох</p>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {species.map((s) => (
          <li
            key={s.id}
            className="rounded-card border border-line bg-card p-4 transition-shadow hover:shadow-sm"
          >
            <div className="font-semibold text-navy">{s.name}</div>
            <div className="tnum mt-1 text-sm text-ink-soft">
              {s.defaultReserve ? `Босго: ${formatTugrug(s.defaultReserve)}` : "Босго: —"}
            </div>
          </li>
        ))}
      </ul>

      {species.length === 0 && (
        <p className="mt-8 text-sm text-muted">
          Ангилал алга байна. <code>pnpm db:seed</code> ажиллуулна уу.
        </p>
      )}
    </main>
  );
}
