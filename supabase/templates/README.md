# Auth email templates

Supabase's default emails link to `/auth/callback`, and those links only sign
someone in from the browser that asked for them, within five minutes. These
link to `/auth/confirm` instead, which works from any browser for as long as
the link is valid.

Paste each file into Dashboard → Authentication → Emails → Templates:

| Template             | File                  | Subject                           |
| -------------------- | --------------------- | --------------------------------- |
| Confirm signup       | `confirm-signup.html` | Confirm your SevenFold account   |
| Reset password       | `reset-password.html` | Reset your SevenFold password    |
| Change email address | `change-email.html`   | Confirm your email for SevenFold |

The app never changes an existing account's address. "Change email address" is
what a guest gets when they create an account with analyses already saved (the
guest account is upgraded in place), so it doesn't mention an old address:
there isn't one.

Links are built on `{{ .SiteURL }}`, so they open the production site even for
a sign-up started on localhost. It's the same Supabase project, so confirm
there, then log in locally.
