import type { Mail } from "@/lib/email";

const BRAND = "Ан агнуурын үнийн санал дуудах систем";

function shell(heading: string, lines: string[], cta: { label: string; href: string }, note: string): string {
  const body = lines.map((l) => `<p style="margin:0 0 12px;color:#3a4759;font-size:14px;line-height:1.6">${l}</p>`).join("");
  return `<!doctype html><html lang="mn"><body style="margin:0;background:#f5f2ec;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e6e1d6;border-radius:14px;overflow:hidden">
      <tr><td style="background:#14294a;padding:18px 28px;color:#fff;font-size:13px;font-weight:600">${BRAND}</td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 16px;color:#14294a;font-size:20px">${heading}</h1>
        ${body}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="border-radius:11px;background:#c8312c">
          <a href="${cta.href}" style="display:inline-block;padding:13px 26px;color:#fff;font-size:14px;font-weight:700;text-decoration:none">${cta.label}</a>
        </td></tr></table>
        <p style="margin:0 0 6px;color:#8a93a3;font-size:12px">${note}</p>
        <p style="margin:8px 0 0;color:#8a93a3;font-size:12px;word-break:break-all">${cta.href}</p>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #e6e1d6;color:#8a93a3;font-size:11px">© 2026 Байгаль орчны яам</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** "Set your password" email for the admin invite flow. */
export function inviteEmail(to: string, link: string): Mail {
  return {
    to,
    subject: `${BRAND} — бүртгэл идэвхжүүлэх`,
    html: shell(
      "Тавтай морил",
      [
        "Танд дуудлага худалдааны системд бүртгэл үүсгэлээ.",
        "Доорх товчоор нууц үгээ тохируулж бүртгэлээ идэвхжүүлнэ үү.",
      ],
      { label: "Нууц үг тохируулах", href: link },
      "Энэ холбоос 3 хоногийн дотор хүчинтэй. Хэрэв та хүсээгүй бол энэ захидлыг үл хэрэгсэнэ үү.",
    ),
    text: `${BRAND}\n\nТанд бүртгэл үүсгэлээ. Нууц үгээ тохируулахын тулд доорх холбоосоор орно уу (3 хоног хүчинтэй):\n\n${link}\n`,
  };
}

/** Password recovery email for the self-service forgot flow. */
export function resetEmail(to: string, link: string): Mail {
  return {
    to,
    subject: `${BRAND} — нууц үг сэргээх`,
    html: shell(
      "Нууц үг сэргээх",
      [
        "Таны бүртгэлийн нууц үгийг сэргээх хүсэлт хүлээн авлаа.",
        "Доорх товчоор шинэ нууц үг тохируулна уу.",
      ],
      { label: "Шинэ нууц үг тохируулах", href: link },
      "Энэ холбоос 1 цагийн дотор хүчинтэй. Хэрэв та хүсээгүй бол нууц үг хэвээр үлдэнэ.",
    ),
    text: `${BRAND}\n\nНууц үг сэргээх хүсэлт хүлээн авлаа. Шинэ нууц үг тохируулахын тулд доорх холбоосоор орно уу (1 цаг хүчинтэй):\n\n${link}\n`,
  };
}
