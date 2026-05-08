import {
  RESEND_API_KEY,
  RESEND_FROM_ADDRESS,
  RESEND_NOTIFY_TO,
} from "astro:env/server"
import { Resend } from "resend"

export const FROM_ADDRESS = RESEND_FROM_ADDRESS
export const NOTIFY_TO = RESEND_NOTIFY_TO

export const resend = new Resend(RESEND_API_KEY)
