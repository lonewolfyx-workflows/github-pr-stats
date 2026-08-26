import type {
  PullRequestRecord,
  RepositoryPRStats,
} from '../types'

export function aggregatePullRequests(
  pullRequests: PullRequestRecord[],
): RepositoryPRStats[] {
  const repositories = new Map<
    string,
    RepositoryPRStats
  >()

  for (const pullRequest of pullRequests) {
    const current = repositories.get(
      pullRequest.repository,
    )

    if (!current) {
      repositories.set(
        pullRequest.repository,
        {
          repo: pullRequest.repository,
          pr_count: 1,
          first_pr: pullRequest.createdAt,
          latest_pr_time:
                    pullRequest.createdAt,
          star: 0,
        },
      )

      continue
    }

    current.pr_count += 1

    if (
      pullRequest.createdAt
      < current.first_pr
    ) {
      current.first_pr
        = pullRequest.createdAt
    }

    if (
      pullRequest.createdAt
      > current.latest_pr_time
    ) {
      current.latest_pr_time
        = pullRequest.createdAt
    }
  }

  return [
    ...repositories.values(),
  ]
}

export function sortRepositoryStats(
  stats: RepositoryPRStats[],
): RepositoryPRStats[] {
  return stats.sort(
    (a, b) => {
      const countDiff
        = b.pr_count - a.pr_count

      if (countDiff !== 0) {
        return countDiff
      }

      return a.repo.localeCompare(
        b.repo,
      )
    },
  )
}
