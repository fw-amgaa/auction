import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { RegisterLink } from "@/components/RegisterLink";
import { isRegistrationOpen } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Ховд аймаг · 2026 ан агнуурын цахим дуудлага худалдаа",
  description:
    "Ховд аймагт 2026 онд тусгай зориулалтаар Алтайн угалз, Алтайн тэх агнах зөвшөөрлийн албан ёсны, нээлттэй, ил тод цахим дуудлага худалдаа. ANAV.MN дээр бүртгүүлж оролцоно уу.",
  openGraph: {
    title: "Ховд аймаг · 2026 ан агнуурын цахим дуудлага худалдаа",
    description:
      "Алтайн угалз, Алтайн тэх агнах тусгай зөвшөөрлийн нээлттэй, ил тод цахим дуудлага худалдаа.",
    images: ["/wilderness.jpg"],
    type: "website",
  },
};

/* ── auction facts, drawn from the official 2026 Khovd удирдамж ───────── */

const HERO_STATS: [string, string][] = [
  ["2", "Агнуурын амьтны төрөл"],
  ["09:00", "Эхлэх цаг · орон нутгийн"],
  ["10%", "Босго үнийн дэнчин"],
  ["100%", "Нээлттэй, цахим процесс"],
];

type Species = {
  num: string;
  name: string;
  latin: string;
  valuation: string;
  threshold: string;
  deposit: string;
  bids: string[];
  batch: string;
  duration: string;
  accent: string;
};

const SPECIES: Species[] = [
  {
    num: "01",
    name: "Алтайн угалз",
    latin: "Ovis ammon",
    valuation: "22,200,000₮",
    threshold: "22,200,000₮",
    deposit: "2,220,000₮",
    bids: ["3,000,000₮", "4,000,000₮"],
    batch: "20 минутаар · 4 ба 3 толгойгоор",
    duration: "20 минут",
    accent: "#e7b24b",
  },
  {
    num: "02",
    name: "Алтайн тэх",
    latin: "Capra sibirica",
    valuation: "5,300,000₮",
    threshold: "5,300,000₮",
    deposit: "530,000₮",
    bids: ["600,000₮", "1,200,000₮"],
    batch: "20 минутаар · 5 ба 4 толгойгоор",
    duration: "20 минут",
    accent: "#9db4d6",
  },
];

/* ── auction-day timetable (from the official багц schedule) ─────────── */

type SpeciesSchedule = {
  name: string;
  latin: string;
  accent: string;
  window: string;
  totalLots: number;
  batches: { label: string; time: string; codes: string[] }[];
};

const SCHEDULE: SpeciesSchedule[] = [
  {
    name: "Алтайн угалз",
    latin: "Ovis ammon",
    accent: "#e7b24b",
    window: "09:00 – 10:10",
    totalLots: 11,
    batches: [
      {
        label: "1-р багц",
        time: "09:00 – 09:20",
        codes: ["U1", "U2", "U3", "U4"],
      },
      {
        label: "2-р багц",
        time: "09:25 – 09:45",
        codes: ["U5", "U6", "U7", "U8"],
      },
      { label: "3-р багц", time: "09:50 – 10:10", codes: ["U9", "U10", "U11"] },
    ],
  },
  {
    name: "Алтайн тэх",
    latin: "Capra sibirica",
    accent: "#9db4d6",
    window: "10:20 – 12:20",
    totalLots: 24,
    batches: [
      {
        label: "1-р багц",
        time: "10:20 – 10:40",
        codes: ["T101", "T102", "T103", "T104", "T105"],
      },
      {
        label: "2-р багц",
        time: "10:45 – 11:05",
        codes: ["T106", "T107", "T108", "T109", "T110"],
      },
      {
        label: "3-р багц",
        time: "11:10 – 11:30",
        codes: ["T111", "T112", "T113", "T114", "T115"],
      },
      {
        label: "4-р багц",
        time: "11:35 – 11:55",
        codes: ["T116", "T117", "T118", "T119", "T120"],
      },
      {
        label: "5-р багц",
        time: "12:00 – 12:20",
        codes: ["T121", "T122", "T123", "T124"],
      },
    ],
  },
];

const AUCTION_DATE = "2026 оны 07 сарын 08, Лхагва гараг";

const STEPS: [string, string, string][] = [
  [
    "Бүртгүүлэх",
    "ANAV.MN системд иргэн эсвэл аж ахуйн нэгж, байгууллагаар бүртгэл үүсгэнэ.",
    "Албан бичиг, өргөдөл, итгэмжлэл, иргэний үнэмлэхээ хавсаргана.",
  ],
  [
    "Дэнчин төлөх",
    "Босго үнийн 10%-тай тэнцэх дэнчинг тогтоосон хугацаанд холбогдох дансанд байршуулна.",
    "Дэнчин төлсөн баримтын хуулбараа бүртгэлдээ хавсаргана.",
  ],
  [
    "Эрх олгох",
    "Ажлын хэсэг бичиг баримтын бүрдлийг хянаж, шаардлага хангасан оролцогчид эрх олгоно.",
    "Дутуу баримтыг дуудлага эхлэхээс өмнө засах боломж олгоно.",
  ],
  [
    "Үнэ хаялцах",
    "Тогтоосон цагт нээлттэй, ил тод цахим танхимд үнийн саналаа ээлж дараалан өсгөнө.",
    "Хамгийн өндөр үнэ хүлээн зөвшөөрөгдсөн оролцогч ялагч болно.",
  ],
];

const DOCS: string[] = [
  "Нээлттэй дуудлага худалдаанд оролцох хүсэлт /ААНБ албан бичиг, иргэн өргөдөл/",
  "Иргэн бол — Иргэний үнэмлэхний хуулбар",
  "Хуулийн этгээд бол — Улсын бүртгэлийн гэрчилгээний хуулбар",
  "Нотариатаар батлуулсан итгэмжлэл — хуулийн этгээдийг төлөөлж оролцох тохиолдолд",
  "Дэнчин төлсөн баримтын хуулбар",
];

const PRINCIPLES: [string, string][] = [
  [
    "Нээлттэй, ил тод",
    "Дуудлага бүхэлдээ цахим хэлбэрээр, нийтэд ил тод явагдана.",
  ],
  ["Тэгш, шударга", "Бүх оролцогчид адил тэгш нөхцөлд өрсөлдөнө."],
  [
    "Алхамтай өсөлт",
    "Үнийн саналыг ээлж дараалан, тодорхой алхамтайгаар өсгөнө.",
  ],
  [
    "Нөөцдөө нийцсэн",
    "Агнуурын менежментийн төлөвлөгөө, баталсан тоо хэмжээнээс хэтрүүлэхгүй.",
  ],
];

const TERMS: [string, string][] = [
  ["Эхлэх цаг", "Орон нутгийн 09:00 цаг"],
  ["Алтайн угалз", "20 минут · 4 ба 3 толгойгоор багцлагдана"],
  ["Алтайн тэх", "20 минут · 5 ба 4 толгойгоор багцлагдана"],
  ["Ялагчийн төлбөр", "Ялсан үнийг 24 цагийн дотор төлнө"],
  ["Дэнчин буцаалт", "Ялаагүй бол ажлын 14 хоногт шимтгэлгүй буцна"],
  ["Орлогын хуваарилалт", "50% нь Байгаль орчин, уур амьсгалын санд"],
];

// Rendered per request: the register CTAs reflect the admin registration switch.
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const registrationOpen = await isRegistrationOpen();
  return (
    <div className="min-h-dvh bg-sand">
      {/* ── header ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-navy/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link href="/" aria-label="Нүүр хуудас">
            <Logo height={30} chip />
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-white/75 md:flex">
            <a href="#amitad" className="transition-colors hover:text-white">
              Амьтад
            </a>
            <a href="#huvaari" className="transition-colors hover:text-white">
              Хуваарь
            </a>
            <a href="#oroltsoh" className="transition-colors hover:text-white">
              Хэрхэн оролцох
            </a>
            <a href="#nohtsol" className="transition-colors hover:text-white">
              Нөхцөл
            </a>
            <Link
              href="/guidelines"
              className="transition-colors hover:text-white"
            >
              Удирдамж
            </Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="hidden rounded-input px-3.5 py-2 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 sm:inline-block"
            >
              Нэвтрэх
            </Link>
            <RegisterLink
              open={registrationOpen}
              className="rounded-input bg-crimson px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-crimson-hover active:translate-y-px"
            >
              Бүртгүүлэх
            </RegisterLink>
          </div>
        </div>
      </header>

      <main>
        {/* ── hero ───────────────────────────────────────────────── */}
        <section className="relative isolate overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/wilderness.jpg"
            alt="Ховд аймгийн уулархаг агнуурын нутаг"
            className="absolute inset-0 -z-10 size-full object-cover"
          />
          <div className="hero-scrim arena-grain absolute inset-0 -z-10" />

          <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 sm:pt-28">
            <span className="rise inline-flex items-center gap-2 rounded-pill border border-white/25 bg-white/5 px-3.5 py-1.5 text-xs font-medium tracking-wide text-white/85">
              <span className="size-1.5 rounded-full bg-gold" />
              Ховд аймаг · 2026 он · Албан ёсны цахим дуудлага худалдаа
            </span>

            <h1
              className="rise mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-[56px]"
              style={{ animationDelay: "80ms" }}
            >
              Тусгай зориулалтаар ан амьтан агнах зөвшөөрлийн дуудлага худалдаа
            </h1>

            <p
              className="rise mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-white/75 sm:text-base"
              style={{ animationDelay: "160ms" }}
            >
              Дэнчин төлж бүртгүүлсэн иргэн, аж ахуйн нэгж, байгууллага Алтайн угалз,
              Алтайн тэх агнуулах зөвшөөрлийн төлөө нээлттэй, ил тод өрсөлдөнө.
              Бүртгэл, үнэ хаялцах бүх үйл явц{" "}
              <span className="font-semibold text-white">ANAV.MN</span> дээр
              цахимаар явагдана.
            </p>

            <div
              className="rise mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: "240ms" }}
            >
              <RegisterLink
                open={registrationOpen}
                className="rounded-input bg-crimson px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-crimson/25 transition-colors hover:bg-crimson-hover active:translate-y-px"
              >
                Бүртгүүлж оролцох
              </RegisterLink>
              <Link
                href="/guidelines"
                className="rounded-input border border-white/30 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
              >
                Удирдамж унших
              </Link>
              <a
                href="/udirdamj-2026.pdf"
                download
                className="inline-flex items-center gap-2 rounded-input px-5 py-3.5 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <DownloadIcon />
                Удирдамж татах (PDF)
              </a>
            </div>

            {/* real stats from the удирдамж */}
            <dl
              className="rise mt-14 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4"
              style={{ animationDelay: "320ms" }}
            >
              {HERO_STATS.map(([n, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="tnum text-3xl font-bold text-white sm:text-[34px]">
                    {n}
                  </dd>
                  <div className="mt-1 text-[12.5px] leading-snug text-white/60">
                    {label}
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ── species / lots ─────────────────────────────────────── */}
        <section
          id="amitad"
          className="scroll-anchor mx-auto max-w-6xl px-5 py-20"
        >
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson">
              Дуудлагад орох амьтад
            </span>
            <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight text-navy">
              Хоёр төрлийн агнуурын амьтан
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Засгийн газрын 2026 оны 222 дугаар тогтоолд заасны дагуу амьтан
              тус бүрийн экологи-эдийн засгийн үнэлгээний 100 хувийг дуудлага
              худалдааны анхны үнийн санал болгон тооцно.
            </p>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {SPECIES.map((s) => (
              <article
                key={s.num}
                className="card-lift overflow-hidden rounded-card border border-line bg-card"
              >
                {/* header band */}
                <div className="topo relative bg-navy px-6 py-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[12.5px] font-medium text-white/55">
                        Амьтан {s.num}
                      </div>
                      <h3 className="mt-1 text-[26px] font-bold leading-tight text-white">
                        {s.name}
                      </h3>
                      <div className="mt-0.5 text-[13px] italic text-gold">
                        {s.latin}
                      </div>
                    </div>
                    <span
                      className="tnum mt-1 shrink-0 rounded-pill px-3 py-1 text-xs font-semibold"
                      style={{ background: `${s.accent}22`, color: s.accent }}
                    >
                      Дэнчин {s.deposit}
                    </span>
                  </div>
                </div>

                {/* data grid */}
                <dl className="grid grid-cols-2 gap-px bg-line">
                  <Field
                    label="Экологи-эдийн засгийн үнэлгээ"
                    value={s.valuation}
                  />
                  <Field
                    label="Дуудлагын босго үнэ"
                    value={s.threshold}
                    accent
                  />
                  <Field
                    label="Үнэ хаялцах саналууд"
                    value={s.bids.join("  /  ")}
                  />
                  <Field label="Багцлалт" value={s.batch} />
                </dl>

                <div className="flex items-center gap-2 px-6 py-4 text-[12.5px] text-muted">
                  <span className="size-1.5 rounded-full bg-success" />
                  Босго үнэ = экологи-эдийн засгийн үнэлгээний 100%
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ── auction-day schedule / timetable ───────────────────── */}
        <section
          id="huvaari"
          className="scroll-anchor border-y border-line bg-card"
        >
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson">
                Дуудлагын хуваарь
              </span>
              <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight text-navy">
                Аль лот хэдэн цагт дуудагдах вэ
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                Дуудлага{" "}
                <span className="font-semibold text-navy">Алтайн угалзаар</span> эхэлж,
                10 минутын завсарлагааны дараа{" "}
                <span className="font-semibold text-navy">Алтайн тэх</span> үргэлжилнэ.
                Лотууд багц багцаар, 20 минутын зайтай дуудагдана. Бүх цаг орон
                нутгийн цагаар. (UTC +7)
              </p>
            </div>

            {/* day at a glance — the whole auction morning in one bar */}
            <div className="mt-9 rounded-card border border-line bg-sand p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-line pb-3">
                <CalendarIcon />
                <span className="tnum text-[14.5px] font-bold text-navy">
                  {AUCTION_DATE}
                </span>
                <span className="ml-auto rounded-pill bg-crimson/10 px-2.5 py-1 text-[11.5px] font-semibold text-crimson">
                  09:00 цагаас
                </span>
              </div>
              <div className="tnum flex items-center justify-between text-[12px] font-semibold text-muted">
                <span>09:00 · эхэлнэ</span>
                <span>12:20 · дуусна</span>
              </div>
              <div className="mt-2.5 flex items-stretch gap-1 overflow-hidden rounded-pill">
                <div
                  className="tnum flex h-10 items-center justify-center px-2 text-center text-[11.5px] font-bold text-navy"
                  style={{ flexGrow: 70, flexBasis: 0, background: "#e7b24b" }}
                >
                  Алтайн угалз · 09:00–10:10
                </div>
                <div
                  className="flex h-10 items-center justify-center px-1 text-center text-[10.5px] font-semibold text-ink-soft"
                  style={{ flexGrow: 10, flexBasis: 0, background: "#e6e1d6" }}
                >
                  10м
                </div>
                <div
                  className="tnum flex h-10 items-center justify-center px-2 text-center text-[11.5px] font-bold text-navy"
                  style={{ flexGrow: 120, flexBasis: 0, background: "#9db4d6" }}
                >
                  Алтайн тэх · 10:20–12:20
                </div>
              </div>
            </div>

            {/* per-species timelines */}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {SCHEDULE.map((sp) => (
                <article
                  key={sp.name}
                  className="overflow-hidden rounded-card border border-line bg-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-5">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-9 w-1.5 shrink-0 rounded-full"
                        style={{ background: sp.accent }}
                      />
                      <div>
                        <h3 className="text-[19px] font-bold leading-tight text-navy">
                          {sp.name}
                        </h3>
                        <div className="text-[12.5px] italic text-muted">
                          {sp.latin}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="tnum text-[15px] font-bold text-navy">
                        {sp.window}
                      </div>
                      <div className="text-[12px] text-muted">
                        {sp.totalLots} лот · {sp.batches.length} багц
                      </div>
                    </div>
                  </div>

                  <ol className="divide-y divide-line">
                    {sp.batches.map((b) => (
                      <li key={b.label} className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span
                            className="tnum rounded-md px-2.5 py-1 text-[13px] font-bold text-navy"
                            style={{ background: `${sp.accent}26` }}
                          >
                            {b.time}
                          </span>
                          <span className="text-[13px] font-semibold text-navy">
                            {b.label}
                          </span>
                          <span className="text-[12px] text-muted">
                            · {b.codes.length} лот
                          </span>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {b.codes.map((code) => (
                            <span
                              key={code}
                              className="tnum rounded-md border border-line bg-sand px-2 py-1 text-[12px] font-semibold text-navy"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>

            <p className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted">
              <span className="size-1.5 rounded-full bg-success" />
              Багц бүрийн хооронд 5 минут, Алтайн угалз ба Алтайн тэхийн хооронд 10 минутын
              завсарлага авна.
            </p>
          </div>
        </section>

        {/* ── how to participate ─────────────────────────────────── */}
        <section
          id="oroltsoh"
          className="scroll-anchor border-y border-line bg-card"
        >
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson">
                Хэрхэн оролцох вэ
              </span>
              <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight text-navy">
                Бүртгэлээс үнэ хаялцах хүртэл дөрвөн алхам
              </h2>
            </div>

            <ol className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {/* connecting line on desktop */}
              <span
                aria-hidden
                className="absolute left-0 top-5 hidden h-px w-full bg-line lg:block"
              />
              {STEPS.map(([title, body, note], i) => (
                <li key={title} className="relative">
                  <div className="tnum relative z-10 grid size-10 place-items-center rounded-full bg-navy text-sm font-bold text-white ring-4 ring-card">
                    {i + 1}
                  </div>
                  <h3 className="mt-4 text-[17px] font-bold text-navy">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                    {body}
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                    {note}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── required docs + key terms ──────────────────────────── */}
        <section
          id="nohtsol"
          className="scroll-anchor mx-auto max-w-6xl px-5 py-20"
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
            {/* required documents */}
            <div className="rounded-card border border-line bg-card p-7">
              <h2 className="text-[22px] font-bold tracking-tight text-navy">
                Бүрдүүлэх материал
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                Бүртгүүлэхдээ дараах баримт бичгийг ANAV.MN системд хавсаргана.
              </p>
              <ul className="mt-5 space-y-3">
                {DOCS.map((d) => (
                  <li key={d} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/12 text-[11px] font-bold text-success">
                      ✓
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-ink-strong">
                      {d}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* key terms */}
            <div className="rounded-card border border-line bg-card p-7">
              <h2 className="text-[22px] font-bold tracking-tight text-navy">
                Чухал нөхцөл
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                Дуудлага худалдааны хэлбэр, хугацаа, төлбөрийн гол нөхцлүүд.
              </p>
              <dl className="mt-5 divide-y divide-line">
                {TERMS.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-6 py-3"
                  >
                    <dt className="text-[13px] font-medium text-ink-soft">
                      {k}
                    </dt>
                    <dd className="text-right text-[13.5px] font-semibold text-navy">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* ── principles band ────────────────────────────────────── */}
        <section className="bg-navy-deep">
          <div className="topo">
            <div className="mx-auto max-w-6xl px-5 py-20">
              <div className="max-w-2xl">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
                  Баримтлах зарчим
                </span>
                <h2 className="mt-2 text-[32px] font-bold leading-tight tracking-tight text-white">
                  Шударга, ил тод зохион байгуулалт
                </h2>
              </div>

              <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
                {PRINCIPLES.map(([title, body], i) => (
                  <div key={title} className="flex gap-4">
                    <span className="tnum text-2xl font-bold text-gold/70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-bold text-white">
                        {title}
                      </h3>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-5 py-20">
          <div className="overflow-hidden rounded-card border border-line bg-card">
            <div className="grid items-center gap-8 p-8 sm:p-11 lg:grid-cols-[1.4fr_1fr]">
              <div>
                <h2 className="text-[28px] font-bold leading-tight tracking-tight text-navy sm:text-[34px]">
                  Дуудлага худалдаанд оролцоход бэлэн үү?
                </h2>
                <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
                  ANAV.MN дээр бүртгэл үүсгэж, дэнчингээ төлж, баримт бичгээ
                  хянуулснаар Алтайн угалз, Алтайн тэх агнах зөвшөөрлийн дуудлагад оролцох эрх
                  нээгдэнэ.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <RegisterLink
                    open={registrationOpen}
                    className="rounded-input bg-crimson px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-crimson-hover active:translate-y-px"
                  >
                    Бүртгүүлэх
                  </RegisterLink>
                  <Link
                    href="/guidelines"
                    className="rounded-input border border-line px-6 py-3.5 text-sm font-semibold text-navy transition-colors hover:border-ink-soft"
                  >
                    Бүрэн удирдамж
                  </Link>
                </div>
              </div>
              <div className="rounded-card bg-sand p-6">
                <div className="text-[12.5px] font-semibold uppercase tracking-wide text-muted">
                  Холбоо барих
                </div>
                <a
                  href="mailto:hovdduudlagahudaldaa@gmail.com"
                  className="mt-2 block break-all text-[14px] font-semibold text-navy hover:text-crimson"
                >
                  hovdduudlagahudaldaa@gmail.com
                </a>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                  Зохион байгуулагч: Ховд аймгийн Засаг даргын Тамгын газар,
                  Байгаль орчны газар.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-line bg-navy">
        <div className="mx-auto max-w-6xl px-5 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
            <div>
              <Logo height={30} chip />
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/55">
                Тусгай зориулалтаар ан амьтан агнах зөвшөөрлийн албан ёсны цахим
                дуудлага худалдааны систем.
              </p>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide text-white/40">
                Холбоосууд
              </div>
              <ul className="mt-3 space-y-2 text-[13.5px] text-white/70">
                <li>
                  <Link
                    href="/guidelines"
                    className="transition-colors hover:text-white"
                  >
                    Удирдамж
                  </Link>
                </li>
                <li>
                  <a
                    href="/udirdamj-2026.pdf"
                    download
                    className="inline-flex items-center gap-1.5 transition-colors hover:text-white"
                  >
                    Удирдамж (PDF)
                    <DownloadIcon />
                  </a>
                </li>
                <li>
                  <Link
                    href="/catalog"
                    className="transition-colors hover:text-white"
                  >
                    Каталог
                  </Link>
                </li>
                <li>
                  <RegisterLink open={registrationOpen} className="transition-colors hover:text-white">
                    Бүртгүүлэх
                  </RegisterLink>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-wide text-white/40">
                Зохион байгуулагч
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/70">
                Ховд аймгийн Засаг даргын Тамгын газар
              </p>
              <a
                href="mailto:hovdduudlagahudaldaa@gmail.com"
                className="mt-2 block break-all text-[13.5px] text-white/70 transition-colors hover:text-white"
              >
                hovdduudlagahudaldaa@gmail.com
              </a>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-[12.5px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <span>© 2026 ANAV.MN · Ан агнуурын цахим дуудлага худалдаа</span>
            <span>Ховд аймаг · Монгол Улс</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-crimson"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function Field({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card px-6 py-4">
      <dt className="text-[12px] leading-snug text-muted">{label}</dt>
      <dd
        className={`tnum mt-1 text-[15px] font-bold ${accent ? "text-crimson" : "text-navy"}`}
      >
        {value}
      </dd>
    </div>
  );
}
