import { desc } from "drizzle-orm";
import Link from "next/link";

import { db, schema } from "@auction/db";

import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const [terms] = await db
    .select()
    .from(schema.termsVersions)
    .orderBy(desc(schema.termsVersions.publishedAt))
    .limit(1);

  return (
    <main className="min-h-screen bg-sand">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/">
            <Logo height={30} />
          </Link>
          <Link href="/catalog" className="text-sm font-semibold text-crimson">
            Каталог ›
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-[28px] font-bold text-navy">Үйлчилгээний нөхцөл</h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Хувилбар {terms?.version ?? "v1"} ·{" "}
          {terms ? terms.publishedAt.toISOString().slice(0, 10) : ""}
        </p>

        <article className="mt-6 whitespace-pre-wrap rounded-card border border-line bg-white p-7 text-[14px] leading-relaxed text-ink-strong">
          {terms?.body ?? "Үйлчилгээний нөхцөл удахгүй нийтлэгдэнэ."}
        </article>

        <div className="mt-6 text-sm text-ink-soft">
          Асуулт байвал{" "}
          <Link href="/help" className="font-semibold text-crimson">
            Тусламж
          </Link>{" "}
          хэсгээс холбогдоно уу.
        </div>
      </div>
    </main>
  );
}
