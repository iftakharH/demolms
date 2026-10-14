/** Shared state shape for form actions (kept out of 'use server' files). */

export interface FormState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Optional per-field errors. */
  fieldErrors?: Record<string, string>;
}

export const EMPTY_FORM_STATE: FormState = {};
