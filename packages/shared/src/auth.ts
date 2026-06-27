/**
 * Auth & registration validation schemas — shared by the browser (form
 * validation) and the server (action validation). Pure Zod, no server deps.
 */
import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("И-мэйл буруу байна");
export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => v.replace(/\D/g, "").length >= 8, "Утас буруу байна");
export const passwordSchema = z.string().min(8, "Нууц үг дор хаяж 8 тэмдэгт байх ёстой");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Нууц үг оруулна уу"),
});
export type LoginInput = z.infer<typeof loginSchema>;

const baseAccount = {
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  address: z.string().trim().min(1, "Заавал бөглөнө"),
  termsVersion: z.string().min(1),
};

export const individualRegisterSchema = z.object({
  accountType: z.literal("individual"),
  surname: z.string().trim().min(1, "Заавал бөглөнө"),
  givenName: z.string().trim().min(1, "Заавал бөглөнө"),
  registryNumber: z.string().trim().min(1, "Заавал бөглөнө"),
  ...baseAccount,
});
export type IndividualRegisterInput = z.infer<typeof individualRegisterSchema>;

export const legalRegisterSchema = z.object({
  accountType: z.literal("legal_entity"),
  registeredName: z.string().trim().min(1, "Заавал бөглөнө"),
  stateCertNumber: z.string().trim().min(1, "Заавал бөглөнө"),
  registryNumber: z.string().trim().min(1, "Заавал бөглөнө"),
  directorName: z.string().trim().min(1, "Заавал бөглөнө"),
  ...baseAccount,
});
export type LegalRegisterInput = z.infer<typeof legalRegisterSchema>;

export const registerSchema = z.discriminatedUnion("accountType", [
  individualRegisterSchema,
  legalRegisterSchema,
]);
export type RegisterInput = z.infer<typeof registerSchema>;
