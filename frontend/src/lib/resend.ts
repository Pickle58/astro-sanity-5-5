import { Resend } from "resend"

const apiKey = import.meta.env.RESEND_API_KEY

if (!apiKey) {
  console.warn(
    "[resend] RESEND_API_KEY is not set; contact form sends will fail."
  )
}

export const resend = new Resend(apiKey)

export const FROM_ADDRESS =
  "Pilkington Enterprises <no-reply@elderpickle.com>"

export const NOTIFY_TO = "jpilkington332@gmail.com"
