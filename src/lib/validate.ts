// Client-side form checks that replace the browser's own validation bubbles.
// The server validates again; this only gives friendly, in-app messages early.

export type Rule = "required" | "email" | "password" | "code";
export type FieldErrors = Record<string, Rule>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE = /^\d{4,8}$/;

/** Returns the first failed rule per field (empty object = valid). */
export function validateFields(data: FormData, rules: Record<string, Rule[]>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, fieldRules] of Object.entries(rules)) {
    const raw = data.get(field);
    const value = typeof raw === "string" ? raw.trim() : "";
    for (const rule of fieldRules) {
      const failed =
        (rule === "required" && !value) ||
        (rule === "email" && value !== "" && !EMAIL.test(value)) ||
        (rule === "password" && value.length > 0 && value.length < 8) ||
        (rule === "code" && value !== "" && !CODE.test(value));
      if (failed) {
        errors[field] = rule;
        break;
      }
    }
  }
  return errors;
}
