/**
 * Human labels for audit-log action codes. Plain module (no server-only deps) so
 * both the server audit page and the client toolbar can import it.
 *
 * Action codes are written by writeAudit() across the admin server actions; the
 * group is the part before the first dot (kyc / user / limit / lot / result /
 * admin), which the audit UI uses for the section filter.
 */

export const ACTION_LABELS: Record<string, string> = {
  "kyc.approve": "KYC баталгаажуулсан",
  "kyc.reject": "KYC татгалзсан",
  "user.create": "Хэрэглэгч үүсгэсэн",
  "user.suspend": "Хэрэглэгч түр хаасан",
  "user.unsuspend": "Хэрэглэгч сэргээсэн",
  "user.reset_credentials": "Нэвтрэх мэдээлэл сэргээсэн",
  "user.update_codes": "Шифр (эрх) шинэчилсэн",
  "user.update": "Мэдээлэл засварласан",
  "limit.issue": "Лимит олгосон",
  "limit.raise": "Лимит нэмэгдүүлсэн",
  "limit.lower": "Лимит бууруулсан",
  "lot.create": "Лот үүсгэсэн",
  "lot.update": "Лот засварласан",
  "lot.cancel": "Лот цуцалсан",
  "lot.delete": "Лот устгасан",
  "lot.rerun": "Лот дахин зарласан",
  "result.mark_paid": "Төлбөр төлсөн гэж тэмдэглэсэн",
  "result.permit_issued": "Эрхийн бичиг олгосон",
  "result.default_winner": "Ялагчийг төлбөргүй болгосон",
  "admin.create": "Дашбоард хэрэглэгч үүсгэсэн",
  "admin.update_permissions": "Эрх шинэчилсэн",
  "admin.disable": "Дашбоард хэрэглэгч идэвхгүй болгосон",
  "admin.enable": "Дашбоард хэрэглэгч идэвхжүүлсэн",
  "admin.resend_invite": "Урилга дахин илгээсэн",
};

const GROUP_LABELS: Record<string, string> = {
  kyc: "KYC",
  user: "Хэрэглэгч",
  limit: "Лимит",
  lot: "Лот",
  result: "Үр дүн",
  admin: "Админ эрх",
};

/** Human label for an action code (falls back to the raw code). */
export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code;
}

/** The section group an action belongs to (text before the first dot). */
export function actionGroup(code: string): string {
  return code.split(".")[0] ?? "other";
}

/** Human label for a section group. */
export function groupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group;
}
