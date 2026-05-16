# Supabase Auth email template

Noesis uses Supabase passwordless email auth for optional account backup. The
extension verifies a six-digit OTP in the popup, so the Supabase Magic Link
email must include the OTP token rather than only a clickable magic link.

In the Supabase dashboard, open:

Authentication -> Emails -> Magic Link

Set the template copy to include `{{ .Token }}` somewhere visible to the user.
Supabase documents this as the variable for a six-digit one-time password, while
`{{ .ConfirmationURL }}` produces the magic link flow.

Useful references:

- https://supabase.com/docs/guides/auth/auth-magic-link
- https://supabase.com/docs/guides/auth/auth-email-templates

