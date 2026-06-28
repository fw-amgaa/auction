"use client";

import Link from "next/link";
import { useState } from "react";

const MONEY = [
  { icon: "🔒", bg: "#FBF1DF", fg: "#C77A0A", title: "Санал = барьцаа", body: "Санал өгмөгц тухайн дүн боломжит үлдэгдлээс түр хасагдана." },
  { icon: "↩", bg: "#E5F4EC", fg: "#1F8A5B", title: "Давуулбал буцна", body: "Таныг давсан даруйд барьцаалсан мөнгө бүрэн буцаж ирнэ." },
  { icon: "✓", bg: "#EEF1F5", fg: "#14294A", title: "Хожвол зарцуулна", body: "Лот хожвол барьцаа худалдан авалтад шилжинэ." },
];

const FAQS: [string, string][] = [
  ["Хэрхэн санал өгөх вэ?", "Шууд явагдаж буй лотын танхимд орж +1–+5 алхмын товчийг дарна. Товч бүр та яг хэдийг төлөхийг харуулна. Гарын товчлол 1–5 эсвэл Enter-ээр ч өгч болно."],
  ["Анти-снайп гэж юу вэ?", "Дуудлага дуусахын өмнөх сүүлийн 15 секундэд санал ирвэл хугацаа автоматаар 30 секундээр сунгагдана. Ингэснээр хэн ч сүүлийн агшинд гэнэт хожих боломжгүй болж, шударга өрсөлдөөн хангагдана."],
  ["Үнийн алхам хэрхэн тооцогддог вэ?", "Нэг алхам нь босго үнийн 10%. Нэг саналд +1-ээс +5 хүртэл алхам нэмж болох ба дээд тал нь босго үнийн 50%."],
  ["Лимитээ хэрхэн нэмэх вэ?", "Захиргаанд хандаж барьцаагаа нэмэгдүүлнэ. Захиргаа баримт шалгаад лимитийг тань нэмэгдүүлэх ба мэдэгдэл ирнэ."],
  ["KYC батлагдахад хэр хугацаа орох вэ?", "Ихэвчлэн ажлын 1 өдрийн дотор. Баримт тодорхой, бүрэн байвал хурдан батлагдана. Татгалзсан тохиолдолд шалтгаан болон засах зааврыг мэдэгдэлд хүргэнэ."],
];

export default function HelpPage() {
  const [open, setOpen] = useState(0);

  function replayAppTour() {
    try {
      localStorage.removeItem("wpa_app_tour");
    } catch {
      /* ignore */
    }
    window.location.href = "/catalog?tour=1";
  }

  return (
    <main>
      <h1 className="text-[28px] font-bold text-navy">Тусламж</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Системийг хэрхэн ашиглах, дуудлага худалдааны дүрэм, түгээмэл асуултууд.</p>

      {/* tour replay cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] bg-navy p-[22px] text-white">
          <span className="grid size-[42px] place-items-center rounded-[11px] bg-gold/20 text-xl text-gold">🧭</span>
          <div className="mt-3 text-[17px] font-bold">Аппын танилцуулга</div>
          <div className="mt-1 text-[13px] leading-relaxed text-[#A9BAD4]">
            Каталог, үлдэгдэл, мэдэгдлийг хэрхэн ашиглахыг алхам алхмаар үзүүлнэ.
          </div>
          <button onClick={replayAppTour} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-white px-4.5 py-2.5 text-[13.5px] font-bold text-navy" style={{ paddingInline: 18 }}>
            ▶ Дахин үзэх
          </button>
        </div>
        <div className="rounded-[14px] bg-[#0E1B14] p-[22px] text-white">
          <span className="grid size-[42px] place-items-center rounded-[11px] bg-[#2BD07A]/20 text-xl text-[#5BE39B]">⚡</span>
          <div className="mt-3 text-[17px] font-bold">Шууд танхимын заавар</div>
          <div className="mt-1 text-[13px] leading-relaxed text-[#9DB8AB]">
            Бодит цагийн санал, гарын товчлол. Танхимд ? товчоор бүх заавар.
          </div>
          <Link href="/catalog?status=live" className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#2BD07A] px-[18px] py-2.5 text-[13.5px] font-bold text-[#06180E]">
            Шууд лот үзэх ›
          </Link>
        </div>
      </div>

      {/* how money works */}
      <div className="mt-6 rounded-[14px] border border-[#EAE0C9] bg-[#FBF7EE] p-[22px]">
        <h2 className="mb-4 text-[17px] font-bold text-navy">Мөнгө хэрхэн ажилладаг вэ?</h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
          {MONEY.map((m) => (
            <div key={m.title} className="flex items-start gap-3">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] text-base font-bold" style={{ background: m.bg, color: m.fg }}>{m.icon}</span>
              <div>
                <div className="text-[13.5px] font-bold text-navy">{m.title}</div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{m.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-6">
        <h2 className="mb-3.5 text-lg font-bold text-navy">Түгээмэл асуултууд</h2>
        <div className="overflow-hidden rounded-[14px] border border-line bg-white">
          {FAQS.map(([q, a], i) => (
            <div key={q} className="border-b border-[#F0ECE2] last:border-0">
              <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-3.5 px-5 py-4 text-left">
                <span className="text-[14.5px] font-semibold text-navy">{q}</span>
                <span className="text-muted transition-transform" style={{ transform: open === i ? "rotate(180deg)" : "none" }}>⌄</span>
              </button>
              {open === i && <div className="px-5 pb-4 text-[13.5px] leading-relaxed text-ink-soft">{a}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* contact + terms */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] border border-line bg-white p-5">
          <h3 className="mb-3 text-[15px] font-bold text-navy">Холбоо барих</h3>
          <div className="mb-2 text-[13px] text-ink-soft">☎ 1800-1234 (ажлын өдөр 9:00–18:00)</div>
          <div className="text-[13px] text-ink-soft">✉ tuslamj@agnuur.gov.mn</div>
        </div>
        <Link href="/terms" className="flex items-center justify-between gap-3.5 rounded-[14px] border border-line bg-white p-5 hover:border-[#CDD4DE]">
          <div>
            <h3 className="text-[15px] font-bold text-navy">Үйлчилгээний нөхцөл</h3>
            <div className="mt-0.5 text-[12.5px] text-muted">Дуудлага худалдааны дүрэм журам</div>
          </div>
          <span className="text-[#C7CFD9]">›</span>
        </Link>
      </div>
    </main>
  );
}
