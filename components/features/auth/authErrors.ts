import {
  isAuthError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  isAuthWeakPasswordError,
} from "@supabase/supabase-js";

/**
 * Error codes the email forms react to with more than a message — a "Log in
 * instead" button, a resend link, and so on.
 */
export const ACCOUNT_EXISTS = "user_already_exists";
export const EMAIL_NOT_CONFIRMED = "email_not_confirmed";
export const NEEDS_FRESH_LOGIN = "reauthentication_needed";

export interface AuthFailure {
  message: string;
  /** Supabase's error code, normalised so a caller only has to check one spelling. */
  code?: string;
}

/**
 * Supabase's auth messages are written for developers ("Invalid login
 * credentials", "For security purposes, you can only request this after 37
 * seconds"). This turns the ones a person can actually hit into sentences
 * that say what to do next, and passes the rest through untouched.
 */
export function describeAuthError(error: unknown): AuthFailure {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return { message: "Couldn't reach the server. Check your connection and try again." };
  }
  if (isAuthSessionMissingError(error)) {
    return { message: "You've been signed out. Log in again to continue.", code: "session_missing" };
  }
  if (!isAuthError(error)) {
    return { message: error instanceof Error ? error.message : "Something went wrong. Try again." };
  }

  const code = error.code;
  switch (code) {
    case "invalid_credentials":
      return {
        code,
        message:
          "That email and password don't match. If you signed up with Google, use Continue with Google instead.",
      };
    case EMAIL_NOT_CONFIRMED:
      return {
        code,
        message: "Confirm your email first — open the link we sent when you signed up.",
      };
    // `email_exists` is the same situation reached through an anonymous
    // account's upgrade rather than a fresh sign-up.
    case ACCOUNT_EXISTS:
    case "email_exists":
      return { code: ACCOUNT_EXISTS, message: "There's already an account with this email." };
    case "weak_password":
      return {
        code,
        message:
          isAuthWeakPasswordError(error) && error.reasons.includes("pwned")
            ? "That password has turned up in a data breach. Choose a different one."
            : error.message,
      };
    case "same_password":
      return { code, message: "That's already your password. Choose a new one." };
    case "over_email_send_rate_limit": {
      const seconds = /(\d+) seconds?/.exec(error.message)?.[1];
      return {
        code,
        message: seconds
          ? `Wait ${seconds} seconds before asking for another email.`
          : "Too many emails have gone out in the last hour. Try again later.",
      };
    }
    case "over_request_rate_limit":
      return { code, message: "Too many attempts. Wait a minute, then try again." };
    case "email_address_invalid":
      return { code, message: "That email address can't receive mail. Check it and try again." };
    // The project is still on Supabase's built-in mailer, which only delivers
    // to members of the Supabase organisation.
    case "email_address_not_authorized":
      return {
        code,
        message: "We can't send email to this address yet. Continue with Google instead.",
      };
    case "email_provider_disabled":
    case "signup_disabled":
      return {
        code,
        message: "Email accounts aren't available right now. Continue with Google instead.",
      };
    case "otp_expired":
      return { code, message: "That link has expired or was already used." };
    case NEEDS_FRESH_LOGIN:
    case "current_password_required":
      return {
        code: NEEDS_FRESH_LOGIN,
        message: "For your security, confirm it's you first: we'll email you a link to set it.",
      };
    default:
      return { code, message: error.message || "Something went wrong. Try again." };
  }
}
