import { getOctokit } from '@actions/github'

export type GitHubClient = ReturnType<typeof getOctokit>

export function createGitHubClient(token: string): GitHubClient {
  return getOctokit(token, {
    userAgent: 'github-pr-stats-action/1.0.0',
  })
}
