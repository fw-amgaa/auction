import Link from "next/link";

export default function LandingPage() {
  return (
    <main>
      {/* hero */}
      <section className="bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <span className="inline-block rounded-pill border border-white/20 px-3 py-1 text-xs tracking-wide text-white/80">
            АЛБАН ЁСНЫ ЦАХИМ ДУУДЛАГА ХУДАЛДАА
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight">
            Ан агнуурын эрхийн бодит цагийн дуудлага худалдаа
          </h1>
          <p className="mt-4 max-w-xl text-white/70">
            Иргэн, хуулийн этгээд бүртгүүлж, баталгаажуулалт хийлгэн, лимит авч, шударга
            бөгөөд ил тод дуудлага худалдаанд оролцоно.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/register"
              className="rounded-[--radius-input] bg-crimson px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-crimson-hover"
            >
              Бүртгүүлэх
            </Link>
            <Link
              href="/login"
              className="rounded-[--radius-input] border border-white/25 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Нэвтрэх
            </Link>
          </div>

          <div className="mt-12 flex gap-10">
            {[
              ["8", "Амьтны төрөл"],
              ["24+", "Лот"],
              ["1,240+", "Хэрэглэгч"],
            ].map(([n, label]) => (
              <div key={label}>
                <div className="tnum text-3xl font-bold">{n}</div>
                <div className="text-sm text-white/60">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-xl font-semibold text-navy">Хэрхэн оролцох вэ</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["1", "Бүртгүүлэх", "Иргэн эсвэл хуулийн этгээдээр бүртгэл үүсгэнэ."],
            ["2", "Баталгаажуулалт", "Бичиг баримтаа илгээж KYC шалгуулна."],
            ["3", "Лимит авах", "Админ дэнчинд тань тохирох лимит тогтооно."],
            ["4", "Үнэ хаялцах", "Бодит цагийн дуудлага худалдаанд оролцоно."],
          ].map(([n, title, body]) => (
            <div key={n} className="rounded-card border border-line bg-card p-5">
              <div className="tnum grid size-9 place-items-center rounded-full bg-navy text-sm font-semibold text-white">
                {n}
              </div>
              <h3 className="mt-3 font-semibold text-navy">{title}</h3>
              <p className="mt-1 text-sm text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        Ан агнуурын үнийн санал дуудах систем · Туршилтын хувилбар
      </footer>
    </main>
  );
}
