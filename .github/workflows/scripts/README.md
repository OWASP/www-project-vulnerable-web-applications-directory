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

**Usage:**
```bash
python3 check_editorconfig.py <json_file>
```

**Exit codes:**
- `0`: File adheres to all `.editorconfig` rules
- `1`: File violates one or more rules or an error occurred

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
- **Intelligent caching**: Uses ETag-based caching to skip API calls for unchanged repositories
- **Retry mechanism**: Automatically retries failed requests with configurable retry limits
- **GraphQL support**: Optional GraphQL API for batch queries (faster for large datasets)
- **Debug logging**: Comprehensive logging with response headers for troubleshooting
- **Graceful degradation**: Falls back to cached data when API limits are exceeded

**Environment Variables:**
- `GITHUB_TOKEN`: GitHub personal access token (recommended for higher rate limits). Without this, the script uses unauthenticated requests with lower limits (60 requests/hour vs 5000 requests/hour).
- `CACHE_FILE`: Path to cache file (default: `.github_stats_cache.json`)
- `MAX_RETRIES`: Maximum number of retry attempts (default: `3`)
- `INITIAL_DELAY`: Initial delay between requests in seconds (default: `1`)
- `USE_GRAPHQL`: Use GraphQL API for batch queries (default: `false`). Set to `true` to enable batch fetching for improved performance.
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

With GraphQL API for faster updates:
```bash
USE_GRAPHQL=true python3 update_stats.py
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

The script uses ETag-based HTTP caching:

1. **ETag storage**: Stores ETag from each API response in the cache file
2. **Conditional requests**: Sends `If-None-Match` header with cached ETag
3. **304 Not Modified**: GitHub returns 304 if content unchanged, saving rate limit quota
4. **Cache file**: JSON file mapping `owner/repo` to stats and ETags (excluded from git via `.gitignore`)
5. **Fallback**: Uses cached data when API calls fail or rate limits are exceeded

## Integration with Workflows

These scripts are automatically executed by GitHub Actions workflows:

- `validate.yml`: Runs validation scripts on PRs that modify `_data/collection.json`
- `update-stats.yml`: Runs `update_stats.py` weekly to keep statistics current

The validation results are:

1. Combined into a unified `artifact.txt` file (failures only)
2. Displayed in the GitHub Actions job summary with proper formatting (all results)
3. Posted as a comment on the pull request if any validation fails

Each validation step includes a clear PASS/FAIL indicator for easy identification of issues.
