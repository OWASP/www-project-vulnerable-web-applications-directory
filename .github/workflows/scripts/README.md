# Validation Scripts

This directory contains validation scripts used by the GitHub Actions workflows to ensure data quality in `_data/collection.json`.

## Scripts

### check_schema.py

Validates that `collection.json` conforms to the JSON schema defined in `schema.json`. Uses Python's `jsonschema` library for comprehensive validation with user-friendly error messages.

**Usage:**
```bash
python3 check_schema.py <schema_file> <json_file>
```

**Exit codes:**
- `0`: All entries conform to the schema
- `1`: Schema validation failed or an error occurred

**Features:**
- Entry-by-entry error reporting
- Clear field path identification
- Human-readable error messages
- Shows expected values for constraints (enums, minimums, required fields, etc.)

### check_ordering.py

Validates that entries in `collection.json` are ordered alphabetically by the `name` field (case-insensitive).

**Usage:**
```bash
python3 check_ordering.py <json_file>
```

**Exit codes:**
- `0`: All entries are properly ordered
- `1`: Entries are not ordered alphabetically or an error occurred

### check_editorconfig.py

Validates that `collection.json` adheres to the `.editorconfig` rules for JSON files:
- `indent_style = tab`
- `indent_size = 1`
- `charset = utf-8`
- `end_of_line = lf`
- `insert_final_newline = true`
- `trim_trailing_whitespace = true`

Additionally validates that special characters (e.g., ç, ê) are stored as-is rather than as Unicode escape sequences (e.g., `\u00e7`, `\u00ea`), which requires using `ensure_ascii=False` in `json.dump()`.

**Usage:**
```bash
python3 check_editorconfig.py <json_file>
```

**Exit codes:**
- `0`: File adheres to all `.editorconfig` rules
- `1`: File violates one or more rules or an error occurred

### check_links.py

Validates that all app URLs and reference URLs in `collection.json` are accessible and not broken. Checks HTTP status codes and detects redirects.

**Usage:**
```bash
python3 check_links.py
```

**Exit codes:**
- `0`: All URLs are accessible
- `1`: One or more URLs failed validation or an error occurred

**Features:**
- **Duplicate detection**: Skips checking the same URL multiple times
- **Redirect tracking**: Identifies URLs that redirect and logs the final destination
- **Comprehensive error reporting**: Reports both connection errors and HTTP error status codes (4xx, 5xx)
- **Context information**: Shows which entry and field (App URL or Reference URL) each URL belongs to
- **JSON output**: Saves failed links and redirects to `failed_links.json` for artifact upload
- **Workflow summary**: Outputs formatted results to `GITHUB_STEP_SUMMARY` for easy viewing in GitHub Actions

**Environment Variables:**
- `DATA_FILE`: Path to collection JSON file (default: `_data/collection.json`)

### update_contributors.py

Updates the Jekyll front matter `contributors` field in a markdown file by fetching contributor data from GitHub repositories. Aggregates contributions from multiple repositories and sorts by contribution count.

**Usage:**
```bash
python3 update_contributors.py <markdown_file>
```

**Exit codes:**
- `0`: Update completed successfully
- `1`: Update failed or an error occurred

**Features:**
- **Multi-repository aggregation**: Fetches contributors from both legacy (OWASP-VWAD) and current repository
- **Exclusion list**: Filters out bots and project authors to show only community contributors
- **Smart sorting**: Sorts by contribution count (descending), then alphabetically by username
- **Front matter preservation**: Updates only the `contributors` field while preserving all other YAML front matter
- **Change detection**: Only updates the file if contributors have actually changed

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub personal access token (optional, but recommended for higher rate limits)

**Excluded accounts:**
- Bots: `vwadbot`, `dependabot[bot]`, `owasp-nest[bot]`, `github-actions[bot]`, `Copilot`, `OWASPFoundation`
- Authors: `kingthorin`, `psiinon`, `raulsiles`

### update_stats.py

Updates GitHub statistics (stars and last contribution date) in `collection.json` for all entries with a `badge` field.

**Usage:**
```bash
python3 update_stats.py
```

**Exit codes:**
- `0`: Update completed successfully
- `1`: Update failed or an error occurred

**Features:**
- **Dynamic rate limit handling**: Automatically detects and handles GitHub API rate limits with exponential backoff
- **Intelligent caching**: Uses local caching to minimize API calls
- **Retry mechanism**: Automatically retries failed requests with configurable retry limits
- **GraphQL batch queries**: Uses GraphQL API for efficient batch processing (faster for large datasets)
- **Debug logging**: Comprehensive logging with response headers for troubleshooting
- **Graceful degradation**: Falls back to cached data when API limits are exceeded

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub personal access token (recommended for higher rate limits). Without this, the script uses unauthenticated requests with lower limits (60 requests/hour vs 5000 requests/hour).
- `CACHE_FILE`: Path to cache file (default: `.github_stats_cache.json`)
- `MAX_RETRIES`: Maximum number of retry attempts (default: `3`)
- `INITIAL_DELAY`: Initial delay between requests in seconds (default: `1`)
- `DEBUG_LOGGING`: Enable detailed debug logging (default: `false`). Set to `true` to see full response headers and diagnostic information.

**Examples:**

Basic usage (uses defaults):
```bash
python3 update_stats.py
```

With debug logging:
```bash
DEBUG_LOGGING=true python3 update_stats.py
```

With custom retry settings:
```bash
MAX_RETRIES=5 INITIAL_DELAY=2 python3 update_stats.py
```

**Rate Limit Handling:**

The script implements sophisticated rate limit handling:

1. **Detection**: Monitors `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
2. **Primary rate limit (403)**: When `X-RateLimit-Remaining` reaches 0, waits until the reset time
3. **Secondary rate limit (429)**: Honors `Retry-After` header or uses exponential backoff
4. **Exponential backoff**: For transient errors, uses `wait_time = min(2^retry_count, 300)` seconds
5. **Graceful fallback**: Returns cached data when rate limits prevent fresh fetches

**Caching:**

The script uses local caching to minimize API calls:

1. **Cache storage**: Stores repository statistics in a local cache file
2. **Cache file**: JSON file mapping `owner/repo` to stats (excluded from git via `.gitignore`)
3. **Fallback**: Uses cached data when API calls fail or rate limits are exceeded

## Integration with Workflows

These scripts are automatically executed by GitHub Actions workflows:

- `validate.yml`: Runs validation scripts (`check_schema.py`, `check_ordering.py`, `check_editorconfig.py`) on PRs that modify `_data/collection.json`
- `update-stats.yml`: Runs `update_stats.py` weekly to keep GitHub statistics current
- `link-checker.yml`: Runs `check_links.py` on manual trigger to validate all app and reference URLs
- `update-contributors.yml`: Runs `update_contributors.py` weekly to update the contributors list in `index.md`

The validation results from `validate.yml` are:

1. Combined into a unified `artifact.txt` file (failures only)
2. Displayed in the GitHub Actions job summary with proper formatting (all results)
3. Posted as a comment on the pull request if any validation fails

Each validation step includes a clear PASS/FAIL indicator for easy identification of issues.
