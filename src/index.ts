import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import * as core from '@actions/core'
import { resolveConfig } from './config'
import { createGitHubClient } from './github/client'
import { getUserPullRequests } from './github/pulls'
import { hydrateRepositoryStars } from './github/repositories'
import { aggregatePullRequests, sortRepositoryStats } from './stats/aggregate'
import { renderSvg } from './svg/render'

async function runGroup<T>(title: string, task: () => Promise<T>): Promise<T> {
  core.startGroup(title)

  try {
    return await task()
  }
  finally {
    core.endGroup()
  }
}

function resolveOutputPath(output: string): string {
  if (path.isAbsolute(output)) {
    return output
  }

  const workspace
    = process.env.GITHUB_WORKSPACE
      || process.cwd()

  return path.resolve(
    workspace,
    output,
  )
}

async function run(): Promise<void> {
  const config = resolveConfig()

  core.setSecret(
    config.token,
  )

  const client = createGitHubClient(
    config.token,
  )

  const {
    username,
    pullRequests,
  } = await runGroup(
    `Collect pull requests for @${config.username}`,

    () => getUserPullRequests(
      client,
      config.username,
    ),
  )

  core.info(`Found ${pullRequests.length} pull requests.`)

  let stats = aggregatePullRequests(pullRequests)

  core.info(`Found contributions across ${stats.length} repositories.`)

  stats = await runGroup('Fetch repository metadata', () => hydrateRepositoryStars(client, stats))

  sortRepositoryStats(stats)

  const svg = renderSvg({ username, stats, maxRows: config.maxRows })

  const outputPath = resolveOutputPath(config.output)

  await mkdir(path.dirname(outputPath), { recursive: true })

  await writeFile(outputPath, svg, 'utf8')

  const totalPullRequests = stats.reduce((total, repository) => total + repository.pr_count, 0)

  core.setOutput('data', JSON.stringify(stats))

  core.setOutput('svg-path', outputPath)

  core.setOutput('repository-count', stats.length)

  core.setOutput('pr-count', totalPullRequests)

  core.info(`SVG generated: ${outputPath}`)

  core.info(`Repositories: ${stats.length}`)

  core.info(`Pull requests: ${totalPullRequests}`)
}

run().catch(
  (error: unknown) => {
    if (error instanceof Error) {
      core.setFailed(error.message)
      return
    }

    core.setFailed(String(error))
  },
)
