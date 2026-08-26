import type {
  RepositoryPRStats,
} from '../types'

import type {
  GitHubClient,
} from './client'

import * as core from '@actions/core'

import {
  getErrorStatus,
  withGitHubRetry,
} from './retry'

const REPOSITORY_CONCURRENCY = 5

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (
    item: T,
    index: number,
  ) => Promise<R>,
): Promise<unknown[]> {
  if (items.length === 0) {
    return []
  }

  const result = Array.from({ length: items.length })

  let cursor = 0

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor

      cursor += 1

      if (index >= items.length) {
        return
      }

      const item = items[index]!

      result[index] = await mapper(
        item,
        index,
      )
    }
  }

  const workerCount = Math.min(
    concurrency,
    items.length,
  )

  await Promise.all(
    Array.from(
      {
        length: workerCount,
      },
      () => worker(),
    ),
  )

  return result
}

function parseRepositoryName(
  fullName: string,
): {
  owner: string
  repo: string
} {
  const slashIndex
    = fullName.indexOf('/')

  if (slashIndex <= 0) {
    throw new Error(
      `Invalid repository name: ${fullName}`,
    )
  }

  return {
    owner: fullName.slice(
      0,
      slashIndex,
    ),
    repo: fullName.slice(
      slashIndex + 1,
    ),
  }
}

export async function hydrateRepositoryStars(client: GitHubClient, stats: RepositoryPRStats[]): Promise<RepositoryPRStats[]> {
  // eslint-disable-next-line ts/ban-ts-comment
  // @ts-expect-error
  return mapWithConcurrency(
    stats,
    REPOSITORY_CONCURRENCY,

    async (item) => {
      const {
        owner,
        repo,
      } = parseRepositoryName(
        item.repo,
      )

      try {
        const response
          = await withGitHubRetry(
            () => client.rest.repos.get({
              owner,
              repo,
            }),
            `Get repository ${item.repo}`,
          )

        return {
          ...item,
          star:
                        response.data
                          .stargazers_count ?? 0,
        }
      }
      catch (error) {
        if (
          getErrorStatus(error)
          === 404
        ) {
          core.warning(
            `Repository ${item.repo} `
            + `is no longer accessible. `
            + `Star count will be 0.`,
          )

          return item
        }

        throw error
      }
    },
  )
}
