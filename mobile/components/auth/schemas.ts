/**
 * Zod schemas for the S2.0 auth forms. Validation lives here (not in the
 * screens) so the rules are unit-testable and shared between sign-in/sign-up.
 * Kept under components/auth (not app/) because expo-router treats every file
 * in app/ as a route.
 */
import { z } from 'zod';

const email = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email');

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(40, 'Keep it under 40 characters'),
  email,
  password: z.string().min(8, 'At least 8 characters'),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

/** Flatten a ZodError to the first message per field, for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && out[key] === undefined) {
      out[key] = issue.message;
    }
  }
  return out;
}
