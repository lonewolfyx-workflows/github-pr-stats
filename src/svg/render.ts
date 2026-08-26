import type {
  RepositoryPRStats,
} from '../types'

export interface RenderSvgOptions {
  username: string
  stats: RepositoryPRStats[]
  maxRows: number
}

const WIDTH = 960

const TITLE_HEIGHT = 72
const HEADER_HEIGHT = 42
const ROW_HEIGHT = 44
const FOOTER_HEIGHT = 18

function escapeXml(
  value: string,
): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}

function truncate(
  value: string,
  maxLength: number,
): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(
    0,
    maxLength - 1,
  )}…`
}

function formatDate(
  timestamp: string,
): string {
  return timestamp.slice(0, 10)
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    'en-US',
  ).format(value)
}

function formatStars(
  value: number,
): string {
  if (value >= 1_000_000) {
    return `${
      (value / 1_000_000)
        .toFixed(1)
        .replace(/\.0$/, '')
    }m`
  }

  if (value >= 1_000) {
    return `${
      (value / 1_000)
        .toFixed(1)
        .replace(/\.0$/, '')
    }k`
  }

  return String(value)
}

export function renderSvg({
  username,
  stats,
  maxRows,
}: RenderSvgOptions): string {
  const visibleStats
    = maxRows > 0
      ? stats.slice(0, maxRows)
      : stats

  const totalPRs = stats.reduce(
    (total, item) =>
      total + item.pr_count,
    0,
  )

  const height
    = TITLE_HEIGHT
      + HEADER_HEIGHT
      + visibleStats.length
      * ROW_HEIGHT
      + FOOTER_HEIGHT

  const rows = visibleStats
    .map(
      (
        item,
        index,
      ) => {
        const y
          = TITLE_HEIGHT
            + HEADER_HEIGHT
            + index * ROW_HEIGHT

        const centerY
          = y + ROW_HEIGHT / 2

        const rowClass
          = index % 2 === 0
            ? 'row'
            : 'row row-alt'

        const repository
          = escapeXml(
            truncate(
              item.repo,
              42,
            ),
          )

        const repositoryUrl
          = escapeXml(
            `https://github.com/${item.repo}`,
          )

        return `
          <g class="${rowClass}">
            <rect
              x="0"
              y="${y}"
              width="${WIDTH}"
              height="${ROW_HEIGHT}"
              class="row-background"
            />

            <line
              x1="0"
              y1="${y + ROW_HEIGHT}"
              x2="${WIDTH}"
              y2="${y + ROW_HEIGHT}"
              class="border"
            />

            <a
              href="${repositoryUrl}"
              target="_blank"
            >
              <text
                x="24"
                y="${centerY}"
                class="repository"
              >${repository}</text>
            </a>

            <text
              x="420"
              y="${centerY}"
              class="cell number"
            >${formatNumber(item.pr_count)}</text>

            <text
              x="540"
              y="${centerY}"
              class="cell"
            >${formatDate(item.first_pr)}</text>

            <text
              x="690"
              y="${centerY}"
              class="cell"
            >${formatDate(item.latest_pr_time)}</text>

            <text
              x="850"
              y="${centerY}"
              class="cell number"
            >${formatStars(item.star)}</text>
          </g>
        `
      },
    )
    .join('')

  const truncatedNotice
    = visibleStats.length < stats.length
      ? ` · showing ${visibleStats.length} of ${stats.length}`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${WIDTH}"
  height="${height}"
  viewBox="0 0 ${WIDTH} ${height}"
  role="img"
  aria-labelledby="title desc"
>
  <title id="title">
    Repositories contributed to by @${escapeXml(username)}
  </title>

  <desc id="desc">
    Pull request statistics for repositories not owned by the user.
  </desc>

  <style>
    svg {
      font-family:
        -apple-system,
        BlinkMacSystemFont,
        "Segoe UI",
        Helvetica,
        Arial,
        sans-serif;
    }

    .background {
      fill: #ffffff;
    }

    .title {
      fill: #1f2328;
      font-size: 18px;
      font-weight: 600;
      dominant-baseline: middle;
    }

    .summary {
      fill: #656d76;
      font-size: 12px;
      dominant-baseline: middle;
    }

    .header-background {
      fill: #f6f8fa;
    }

    .header {
      fill: #656d76;
      font-size: 12px;
      font-weight: 600;
      dominant-baseline: middle;
    }

    .row-background {
      fill: #ffffff;
    }

    .row-alt .row-background {
      fill: #fbfcfd;
    }

    .cell {
      fill: #1f2328;
      font-size: 13px;
      dominant-baseline: middle;
    }

    .number {
      font-variant-numeric: tabular-nums;
    }

    .repository {
      fill: #0969da;
      font-size: 13px;
      font-weight: 500;
      dominant-baseline: middle;
    }

    .border {
      stroke: #d8dee4;
      stroke-width: 1;
    }

    @media (prefers-color-scheme: dark) {
      .background {
        fill: #0d1117;
      }

      .title,
      .cell {
        fill: #e6edf3;
      }

      .summary,
      .header {
        fill: #8d96a0;
      }

      .header-background {
        fill: #161b22;
      }

      .row-background {
        fill: #0d1117;
      }

      .row-alt .row-background {
        fill: #10151c;
      }

      .repository {
        fill: #4493f8;
      }

      .border {
        stroke: #30363d;
      }
    }
  </style>

  <rect
    x="0"
    y="0"
    width="${WIDTH}"
    height="${height}"
    rx="8"
    class="background"
  />

  <text
    x="24"
    y="28"
    class="title"
  >@${escapeXml(username)} · Repositories Contributed</text>

  <text
    x="24"
    y="52"
    class="summary"
  >${formatNumber(totalPRs)} PRs · ${formatNumber(stats.length)} repositories${escapeXml(truncatedNotice)}</text>

  <rect
    x="0"
    y="${TITLE_HEIGHT}"
    width="${WIDTH}"
    height="${HEADER_HEIGHT}"
    class="header-background"
  />

  <line
    x1="0"
    y1="${TITLE_HEIGHT + HEADER_HEIGHT}"
    x2="${WIDTH}"
    y2="${TITLE_HEIGHT + HEADER_HEIGHT}"
    class="border"
  />

  <text
    x="24"
    y="${TITLE_HEIGHT + HEADER_HEIGHT / 2}"
    class="header"
  >Repository</text>

  <text
    x="420"
    y="${TITLE_HEIGHT + HEADER_HEIGHT / 2}"
    class="header"
  >PR Count</text>

  <text
    x="540"
    y="${TITLE_HEIGHT + HEADER_HEIGHT / 2}"
    class="header"
  >First PR</text>

  <text
    x="690"
    y="${TITLE_HEIGHT + HEADER_HEIGHT / 2}"
    class="header"
  >Latest PR</text>

  <text
    x="850"
    y="${TITLE_HEIGHT + HEADER_HEIGHT / 2}"
    class="header"
  >Stars</text>

  ${rows}
</svg>
`
}
