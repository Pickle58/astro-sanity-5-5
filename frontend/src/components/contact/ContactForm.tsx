import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const MESSAGE_MAX_LENGTH = 1000

type Status = "idle" | "submitting" | "success" | "error"

interface ContactApiResponse {
  ok: boolean
  message?: string
}

export function ContactForm() {
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [message, setMessage] = React.useState("")
  const [company, setCompany] = React.useState("")
  const [status, setStatus] = React.useState<Status>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const isSubmitting = status === "submitting"

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setStatus("submitting")
    setErrorMessage(null)

    let response: Response
    try {
      response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, message, company }),
      })
    } catch {
      setStatus("error")
      setErrorMessage("Network error. Please try again.")
      return
    }

    const data = (await response
      .json()
      .catch(() => null)) as ContactApiResponse | null

    if (!response.ok || !data?.ok) {
      setStatus("error")
      setErrorMessage(
        data?.message ?? "Something went wrong. Please try again."
      )
      return
    }

    setStatus("success")
    setFirstName("")
    setLastName("")
    setEmail("")
    setMessage("")
    setCompany("")
  }

  return (
    <Card className="w-full max-w-lg">
      <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>
            Send a message. We will respond at the email you provide.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contact-first-name">First name</Label>
              <Input
                id="contact-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contact-last-name">Last name</Label>
              <Input
                id="contact-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              name="message"
              rows={5}
              maxLength={MESSAGE_MAX_LENGTH}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              disabled={isSubmitting}
            />
            <p
              className="text-xs text-muted-foreground self-end"
              aria-live="polite"
            >
              {message.length} / {MESSAGE_MAX_LENGTH}
            </p>
          </div>

          <div aria-hidden="true" className="hidden">
            <Label htmlFor="contact-company">Company</Label>
            <Input
              id="contact-company"
              name="company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </div>

          {status === "success" && (
            <p role="status" className="text-sm text-muted-foreground">
              Thanks &mdash; your message was sent. Check your inbox for a
              confirmation.
            </p>
          )}
          {status === "error" && errorMessage && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send message"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
