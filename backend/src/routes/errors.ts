import type { Response } from 'express'

/**
 * One error shape, always. A stack trace on a screen is a demo over.
 */
export function fail(
  response: Response,
  status: number,
  code: string,
  message: string,
): void {
  response.status(status).json({ error: { code, message } })
}
