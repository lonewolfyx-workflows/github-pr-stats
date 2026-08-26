export interface PullRequestRecord {
  id: number
  repository: string
  number: number
  createdAt: string
  url: string
}

export interface RepositoryPRStats {
  repo: string
  pr_count: number
  first_pr: string
  latest_pr_time: string
  star: number
}

export interface GitHubUserPullRequests {
  username: string
  pullRequests: PullRequestRecord[]
}
