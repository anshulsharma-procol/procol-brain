import type { Response } from 'express'

/**
 * One error shape, always — `{ error: { code, message } }` per the contract's
 * §0. A stack trace on a screen is a demo over.
 *
 * Codes are SCREAMING_SNAKE on the contract surface (NOT_FOUND, BAD_REQUEST,
 * CONFLICT); the widget's older surface keeps its lowercase spellings, which
 * is why this takes whatever the caller passes rather than enforcing one.
 */
export function fail(
  response: Response,
  status: number,
  code: string,
  message: string,
): void {
  response.status(status).json({ error: { code, message } })
}
