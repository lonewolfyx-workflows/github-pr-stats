# GitHub PR Stats

Generate an SVG table and JSON data for repositories a GitHub user has
contributed pull requests to. Repositories owned by the requested user are
excluded from the results.

## Usage

The Action writes relative output paths into the calling repository's
`GITHUB_WORKSPACE`. Committing the generated SVG remains an explicit calling
workflow step so that repository writes never happen unexpectedly.

```yaml
name: Generate PR Stats

on:
  workflow_dispatch:
  push:
    branches: [master]
    paths-ignore:
      - github-pr-stats.svg

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Generate PR Stats
        id: pr-stats
        uses: lonewolfyx-workflows/github-pr-stats@main
        with:
          username: lonewolfyx
          token: ${{ secrets.GITHUB_TOKEN }}
          output: github-pr-stats.svg

      - name: Commit generated SVG
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -- github-pr-stats.svg
          if git diff --cached --quiet; then
            echo "No SVG changes to commit."
            exit 0
          fi
          git commit -m "chore: update PR stats"
          git push
```

If the calling repository uses `main` instead of `master`, update the trigger
branch accordingly. Branch protection rules must also allow the workflow token
to push, or the commit step needs to target a pull-request branch instead.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `username` | Yes | — | GitHub username whose external contributions are collected. |
| `token` | No | `${{ github.token }}` | Token used for GitHub API requests. |
| `output` | No | `github-pr-stats.svg` | SVG path relative to the calling repository. |
| `max-rows` | No | `0` | Maximum rendered repositories; `0` renders all rows. |

## Outputs

| Output | Description |
| --- | --- |
| `data` | External repository contribution statistics as JSON. |
| `svg-path` | Absolute path of the generated SVG on the runner. |
| `repository-count` | Number of external repositories. |
| `pr-count` | Number of pull requests across external repositories. |
