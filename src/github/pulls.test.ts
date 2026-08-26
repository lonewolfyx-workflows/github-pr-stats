import type { PullRequestRecord } from '../types'

import assert from 'node:assert/strict'
import { describe, it } from 'vitest'

import { filterExternalRepositoryPullRequests } from './pulls'

function createPullRequest(
  id: number,
  repository: string,
): PullRequestRecord {
  return {
    id,
    repository,
    number: id,
    createdAt: '2026-01-01T00:00:00Z',
    url: `https://github.com/${repository}/pull/${id}`,
  }
}

describe('filterExternalRepositoryPullRequests', () => {
  it('keeps only repositories not owned by the requested user', () => {
    const pullRequests = [
      createPullRequest(1, 'lonewolfyx/own-repository'),
      createPullRequest(2, 'antfu/external-repository'),
      createPullRequest(3, 'vuejs/core'),
    ]

    const result
      = filterExternalRepositoryPullRequests(
        pullRequests,
        'lonewolfyx',
      )

    assert.deepEqual(
      result.map(item => item.repository),
      [
        'antfu/external-repository',
        'vuejs/core',
      ],
    )
  })

  it('compares GitHub owners case-insensitively', () => {
    const pullRequests = [
      createPullRequest(1, 'LoneWolfYX/own-repository'),
      createPullRequest(2, 'OtherOwner/external-repository'),
    ]

    const result
      = filterExternalRepositoryPullRequests(
        pullRequests,
        'lonewolfyx',
      )

    assert.deepEqual(
      result.map(item => item.repository),
      ['OtherOwner/external-repository'],
    )
  })

  it('rejects malformed repository names', () => {
    assert.throws(
      () => filterExternalRepositoryPullRequests(
        [createPullRequest(1, 'invalid-repository')],
        'lonewolfyx',
      ),
      /Invalid repository name/,
    )
  })
})
