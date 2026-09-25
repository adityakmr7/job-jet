"use client";

import { createAuthClient } from "better-auth/react";

/** Browser-side Better Auth client (same origin; cookies only). */
export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;

/** Maps Better Auth error codes to copy for the forms. */
export function authErrorMessage(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "That email and password don't match. Try again or reset your password.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "An account with this email already exists. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Password is too short.";
    case "PASSWORD_TOO_LONG":
      return "Password is too long.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email first — we've sent you a new link.";
    case "INVALID_TOKEN":
      return "This link is invalid or has expired. Request a new one.";
    case "INVALID_PASSWORD":
      return "Your current password is incorrect.";
    case "SESSION_EXPIRED":
      return "For your security, please sign in again before doing this.";
    default:
      return error.message || "Something went wrong. Please try again.";
  }
}
