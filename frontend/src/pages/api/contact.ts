import type { APIRoute } from "astro"

import { FROM_ADDRESS, NOTIFY_TO, resend } from "@/lib/resend"

export const prerender = false

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NAME_LENGTH = 80
const MAX_EMAIL_LENGTH = 254
const MIN_MESSAGE_LENGTH = 10
const MAX_MESSAGE_LENGTH = 1000

function jsonResponse(
  body: { ok: boolean; message?: string },
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, "<br>")
}

function quotePlainText(value: string): string {
  return value
    .split(/\r\n|\r|\n/)
    .map((line) => `> ${line}`)
    .join("\n")
}

export const POST: APIRoute = async ({ request }) => {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return jsonResponse({ ok: false, message: "Invalid JSON." }, 400)
  }

  if (!raw || typeof raw !== "object") {
    return jsonResponse({ ok: false, message: "Invalid request body." }, 400)
  }

  const payload = raw as Record<string, unknown>
  const firstName =
    typeof payload.firstName === "string" ? payload.firstName.trim() : ""
  const lastName =
    typeof payload.lastName === "string" ? payload.lastName.trim() : ""
  const email = typeof payload.email === "string" ? payload.email.trim() : ""
  const message =
    typeof payload.message === "string" ? payload.message.trim() : ""
  const honeypot =
    typeof payload.company === "string" ? payload.company.trim() : ""

  if (honeypot.length > 0) {
    // Pretend success so bots don't learn the trap exists.
    return jsonResponse({ ok: true }, 200)
  }

  if (!firstName || firstName.length > MAX_NAME_LENGTH) {
    return jsonResponse({ ok: false, message: "First name is required." }, 400)
  }
  if (!lastName || lastName.length > MAX_NAME_LENGTH) {
    return jsonResponse({ ok: false, message: "Last name is required." }, 400)
  }
  if (
    !email ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_REGEX.test(email)
  ) {
    return jsonResponse(
      { ok: false, message: "A valid email is required." },
      400
    )
  }
  if (
    message.length < MIN_MESSAGE_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return jsonResponse(
      {
        ok: false,
        message: `A message between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters is required.`,
      },
      400
    )
  }

  const fullName = `${firstName} ${lastName}`
  const safeFirst = escapeHtml(firstName)
  const safeLast = escapeHtml(lastName)
  const safeEmail = escapeHtml(email)
  const safeMessageHtml = escapeHtmlMultiline(message)
  const quotedMessageText = quotePlainText(message)
  const requestId = crypto.randomUUID()

  const notificationText = `New contact form submission

Name: ${fullName}
Email: ${email}

Message:
${message}`

  const notificationHtml = `<h2>New contact form submission</h2>
<p><strong>Name:</strong> ${safeFirst} ${safeLast}</p>
<p><strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a></p>
<p><strong>Message:</strong></p>
<p>${safeMessageHtml}</p>`

  const notification = await resend.emails.send(
    {
      from: FROM_ADDRESS,
      to: [NOTIFY_TO],
      replyTo: email,
      subject: `New contact form submission from ${fullName}`,
      text: notificationText,
      html: notificationHtml,
      tags: [{ name: "category", value: "contact-form" }],
    },
    { idempotencyKey: `contact-notify/${requestId}` }
  )

  if (notification.error) {
    console.error("[contact] notification send failed", notification.error)
    return jsonResponse(
      {
        ok: false,
        message: "Could not send your message. Please try again later.",
      },
      502
    )
  }

  const autoReplyText = `Hi ${firstName},

Thanks for reaching out. We received your message and will get back to you shortly at ${email}.

Your message:
${quotedMessageText}

— Pilkington Enterprises`

  const autoReplyHtml = `<p>Hi ${safeFirst},</p>
<p>Thanks for reaching out. We received your message and will get back to you shortly at <a href="mailto:${safeEmail}">${safeEmail}</a>.</p>
<p><strong>Your message:</strong></p>
<blockquote style="margin:0 0 0 1em;padding-left:1em;border-left:3px solid #ccc;color:#555;">${safeMessageHtml}</blockquote>
<p>&mdash; Pilkington Enterprises</p>`

  const autoReply = await resend.emails.send(
    {
      from: FROM_ADDRESS,
      to: [email],
      subject: "We received your message",
      text: autoReplyText,
      html: autoReplyHtml,
      tags: [{ name: "category", value: "contact-autoreply" }],
    },
    { idempotencyKey: `contact-autoreply/${requestId}` }
  )

  if (autoReply.error) {
    // Primary notification already sent; log and continue.
    console.error("[contact] auto-reply send failed", autoReply.error)
  }

  return jsonResponse({ ok: true }, 200)
}
