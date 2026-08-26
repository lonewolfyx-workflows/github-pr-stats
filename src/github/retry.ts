import * as core from '@actions/core'

type UnknownRecord = Record<string, unknown>

function asRecord(
  value: unknown,
): UnknownRecord | undefined {
  if (
    typeof value !== 'object'
    || value === null
  ) {
    return undefined
  }

  return value as UnknownRecord
}

export function getErrorStatus(
  error: unknown,
): number | undefined {
  const value = asRecord(error)?.status

  if (typeof value === 'number') {
    return value
  }

  if (
    typeof value === 'string'
    && value.trim()
  ) {
    const parsed = Number(value)

    return Number.isFinite(parsed)
      ? parsed
      : undefined
  }

  return undefined
}

function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message
  }

  const message = asRecord(error)?.message

  return typeof message === 'string'
    ? message
    : String(error)
}

function getHeader(
  error: unknown,
  name: string,
): string | undefined {
  const response = asRecord(
    asRecord(error)?.response,
  )

  const headers = asRecord(
    response?.headers,
  )

  if (!headers) {
    return undefined
  }

  const value
    = headers[name]
      ?? headers[name.toLowerCase()]

  if (
    typeof value === 'string'
    || typeof value === 'number'
  ) {
    return String(value)
  }

  return undefined
}

function isRateLimitError(
  error: unknown,
): boolean {
  const status = getErrorStatus(error)

  if (status === 429) {
    return true
  }

  if (status !== 403) {
    return false
  }

  const remaining = getHeader(
    error,
    'x-ratelimit-remaining',
  )

  if (remaining === '0') {
    return true
  }

  const message = getErrorMessage(error)
    .toLowerCase()

  return (
    message.includes('rate limit')
    || message.includes('secondary rate')
  )
}

function shouldRetry(
  error: unknown,
): boolean {
  const status = getErrorStatus(error)

  if (isRateLimitError(error)) {
    return true
  }

  return (
    status === 502
    || status === 503
    || status === 504
  )
}

function resolveRetryDelay(
  error: unknown,
  attempt: number,
): number {
  const retryAfter = Number(
    getHeader(error, 'retry-after'),
  )

  if (
    Number.isFinite(retryAfter)
    && retryAfter > 0
  ) {
    return retryAfter * 1000
  }

  const reset = Number(
    getHeader(error, 'x-ratelimit-reset'),
  )

  if (
    Number.isFinite(reset)
    && reset > 0
  ) {
    return Math.max(
      reset * 1000 - Date.now() + 1000,
      1000,
    )
  }

  const exponential
    = 1000 * (2 ** attempt)

  const jitter
    = Math.floor(Math.random() * 500)

  return Math.min(
    exponential + jitter,
    30_000,
  )
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

export async function withGitHubRetry<T>(
  task: () => Promise<T>,
  label: string,
  maxAttempts = 4,
): Promise<T> {
  let lastError: unknown

  for (
    let attempt = 0;
    attempt < maxAttempts;
    attempt += 1
  ) {
    try {
      return await task()
    }
    catch (error) {
      lastError = error

      if (
        !shouldRetry(error)
        || attempt === maxAttempts - 1
      ) {
        throw error
      }

      const delay = resolveRetryDelay(
        error,
        attempt,
      )

      core.warning(
        `${label} failed: ${getErrorMessage(error)}. `
        + `Retrying in ${Math.ceil(delay / 1000)}s.`,
      )

      await sleep(delay)
    }
  }

  throw lastError
}
