import type { GitHubUserPullRequests, PullRequestRecord } from '../types'

import type { GitHubClient } from './client'

import { withGitHubRetry } from './retry'

const MAX_SEARCH_RESULTS = 1000
const PER_PAGE = 100

class IncompleteSearchError extends Error {
  constructor(
    public readonly start: Date,
    public readonly end: Date,
  ) {
    super(
      `GitHub returned incomplete search results `
      + `for ${toSearchTimestamp(start)}`
      + `..${toSearchTimestamp(end)}.`,
    )

    this.name = 'IncompleteSearchError'
  }
}

function normalizeToSecond(
  date: Date,
): Date {
  return new Date(
    Math.floor(date.getTime() / 1000) * 1000,
  )
}

function toSearchTimestamp(
  date: Date,
): string {
  return normalizeToSecond(date)
    .toISOString()
    .replace('.000Z', 'Z')
}

function buildSearchQuery(
  username: string,
  start: Date,
  end: Date,
): string {
  return [
    `author:${username}`,
    'is:pr',
    `created:${toSearchTimestamp(start)}..${toSearchTimestamp(end)}`,
  ].join(' ')
}

// eslint-disable-next-line ts/explicit-function-return-type
async function searchPage(
  client: GitHubClient,
  username: string,
  start: Date,
  end: Date,
  page: number,
) {
  const q = buildSearchQuery(
    username,
    start,
    end,
  )

  return withGitHubRetry(
    () => client.rest.search.issuesAndPullRequests({
      q,
      sort: 'created',
      order: 'asc',
      per_page: PER_PAGE,
      page,
    }),
    `Search pull requests page ${page}`,
  )
}

type SearchResponse = Awaited<
  ReturnType<typeof searchPage>
>

type SearchItem
  = SearchResponse['data']['items'][number]

function parseRepository(
  repositoryUrl: string,
): string {
  const url = new URL(repositoryUrl)

  const parts = url.pathname
    .split('/')
    .filter(Boolean)

  const reposIndex = parts
    .lastIndexOf('repos')

  const owner = parts[reposIndex + 1]
  const repo = parts[reposIndex + 2]

  if (!owner || !repo) {
    throw new Error(
      `Unable to parse repository from URL: ${repositoryUrl}`,
    )
  }

  return `${owner}/${repo}`
}

function toPullRequestRecord(
  item: SearchItem,
): PullRequestRecord {
  return {
    id: item.id,
    repository: parseRepository(
      item.repository_url,
    ),
    number: item.number,
    createdAt: item.created_at,
    url: item.html_url,
  }
}

function canSplitInterval(
  start: Date,
  end: Date,
): boolean {
  const startSecond = Math.floor(
    start.getTime() / 1000,
  )

  const endSecond = Math.floor(
    end.getTime() / 1000,
  )

  return startSecond < endSecond
}

function splitInterval(
  start: Date,
  end: Date,
): {
  left: [Date, Date]
  right: [Date, Date]
} {
  const startSecond = Math.floor(
    start.getTime() / 1000,
  )

  const endSecond = Math.floor(
    end.getTime() / 1000,
  )

  if (startSecond >= endSecond) {
    throw new Error(
      `Unable to split search interval: `
      + `${toSearchTimestamp(start)}`
      + `..${toSearchTimestamp(end)}`,
    )
  }

  const middleSecond = Math.floor(
    (startSecond + endSecond) / 2,
  )

  const middle = new Date(
    middleSecond * 1000,
  )

  const rightStart = new Date(
    (middleSecond + 1) * 1000,
  )

  return {
    left: [
      start,
      middle,
    ],
    right: [
      rightStart,
      end,
    ],
  }
}

async function fetchRemainingPages(
  client: GitHubClient,
  username: string,
  start: Date,
  end: Date,
  firstResponse: SearchResponse,
): Promise<PullRequestRecord[]> {
  if (firstResponse.data.incomplete_results) {
    throw new IncompleteSearchError(
      start,
      end,
    )
  }

  const totalCount
    = firstResponse.data.total_count

  if (totalCount === 0) {
    return []
  }

  const pages = Math.ceil(
    totalCount / PER_PAGE,
  )

  const items: SearchItem[] = [
    ...firstResponse.data.items,
  ]

  for (
    let page = 2;
    page <= pages;
    page += 1
  ) {
    const response = await searchPage(
      client,
      username,
      start,
      end,
      page,
    )

    if (response.data.incomplete_results) {
      throw new IncompleteSearchError(
        start,
        end,
      )
    }

    items.push(
      ...response.data.items,
    )
  }

  return items.map(
    toPullRequestRecord,
  )
}

async function collectInterval(
  client: GitHubClient,
  username: string,
  start: Date,
  end: Date,
): Promise<PullRequestRecord[]> {
  const firstResponse = await searchPage(
    client,
    username,
    start,
    end,
    1,
  )

  const needsSplit
    = firstResponse.data.incomplete_results
      || firstResponse.data.total_count
      > MAX_SEARCH_RESULTS

  if (needsSplit) {
    if (!canSplitInterval(start, end)) {
      throw new Error(
        `GitHub returned more than `
        + `${MAX_SEARCH_RESULTS} PRs within one second `
        + `for @${username}.`,
      )
    }

    const {
      left,
      right,
    } = splitInterval(
      start,
      end,
    )

    const leftItems = await collectInterval(
      client,
      username,
      left[0],
      left[1],
    )

    const rightItems = await collectInterval(
      client,
      username,
      right[0],
      right[1],
    )

    return [
      ...leftItems,
      ...rightItems,
    ]
  }

  try {
    return await fetchRemainingPages(
      client,
      username,
      start,
      end,
      firstResponse,
    )
  }
  catch (error) {
    if (
      error instanceof IncompleteSearchError
      && canSplitInterval(start, end)
    ) {
      const {
        left,
        right,
      } = splitInterval(
        start,
        end,
      )

      return [
        ...await collectInterval(
          client,
          username,
          left[0],
          left[1],
        ),

        ...await collectInterval(
          client,
          username,
          right[0],
          right[1],
        ),
      ]
    }

    throw error
  }
}

function deduplicatePullRequests(
  pullRequests: PullRequestRecord[],
): PullRequestRecord[] {
  const map = new Map<
    number,
    PullRequestRecord
  >()

  for (const pullRequest of pullRequests) {
    map.set(
      pullRequest.id,
      pullRequest,
    )
  }

  return [
    ...map.values(),
  ].sort(
    (a, b) =>
      a.createdAt.localeCompare(
        b.createdAt,
      ),
  )
}

function getRepositoryOwner(
  repository: string,
): string {
  const separatorIndex
    = repository.indexOf('/')

  if (separatorIndex <= 0) {
    throw new Error(
      `Invalid repository name: ${repository}`,
    )
  }

  return repository.slice(
    0,
    separatorIndex,
  )
}

export function filterExternalRepositoryPullRequests(
  pullRequests: PullRequestRecord[],
  username: string,
): PullRequestRecord[] {
  const normalizedUsername
    = username.toLowerCase()

  return pullRequests.filter(
    pullRequest =>
      getRepositoryOwner(
        pullRequest.repository,
      ).toLowerCase()
      !== normalizedUsername,
  )
}

export async function getUserPullRequests(
  client: GitHubClient,
  username: string,
): Promise<GitHubUserPullRequests> {
  const userResponse = await withGitHubRetry(
    () => client.rest.users.getByUsername({
      username,
    }),
    `Get GitHub user @${username}`,
  )

  const canonicalUsername
    = userResponse.data.login

  const accountCreatedAt
    = normalizeToSecond(
      new Date(
        userResponse.data.created_at,
      ),
    )

  const now = normalizeToSecond(
    new Date(),
  )

  const pullRequests = await collectInterval(
    client,
    canonicalUsername,
    accountCreatedAt,
    now,
  )

  return {
    username: canonicalUsername,
    pullRequests:
      filterExternalRepositoryPullRequests(
        deduplicatePullRequests(
          pullRequests,
        ),
        canonicalUsername,
      ),
  }
}
