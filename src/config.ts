import * as core from '@actions/core'

export interface ActionConfig {
  username: string
  token: string
  output: string
  maxRows: number
}

function parseNonNegativeInteger(
  value: string,
  name: string,
): number {
  const parsed = Number.parseInt(value, 10)

  if (
    !Number.isInteger(parsed)
    || parsed < 0
  ) {
    throw new Error(
      `"${name}" must be a non-negative integer.`,
    )
  }

  return parsed
}

export function resolveConfig(): ActionConfig {
  const username = core
    .getInput('username', { required: true })
    .trim()

  const token = core
    .getInput('token', { required: true })
    .trim()

  const output = core
    .getInput('output')
    .trim() || 'github-pr-stats.svg'

  const maxRows = parseNonNegativeInteger(
    core.getInput('max-rows') || '0',
    'max-rows',
  )

  if (!username) {
    throw new Error('GitHub username is required.')
  }

  if (!token) {
    throw new Error('GitHub token is required.')
  }

  return {
    username,
    token,
    output,
    maxRows,
  }
}
