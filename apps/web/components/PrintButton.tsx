"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-[9px] bg-navy px-4 py-2.5 text-sm font-semibold text-white"
    >
      ⎙ Хэвлэх / PDF
    </button>
  );
}
