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
- Structured logging with timestamps and log levels for debugging

### check_ordering.py

Validates that entries in `collection.json` are ordered alphabetically by the `name` field (case-insensitive).

**Usage:**
```bash
python3 check_ordering.py <json_file>
```

**Exit codes:**
- `0`: All entries are properly ordered
- `1`: Entries are not ordered alphabetically or an error occurred

**Features:**
- Case-insensitive alphabetical ordering validation
- Detailed mismatch reporting showing expected positions
- Structured logging for tracking validation progress

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

**Features:**
- Comprehensive format validation
- Line-by-line error reporting for whitespace and indentation issues
- Structured logging for debugging

### update_stats.py

Updates GitHub statistics in `collection.json` by querying the GitHub API for star counts and latest commit dates.

**Usage:**
```bash
python3 update_stats.py
```

**Exit codes:**
- `0`: Update completed successfully
- `1`: Update failed

**Features:**
- Automated GitHub API querying with rate limiting
- Support for authenticated requests via `GITHUB_TOKEN` environment variable
- Comprehensive error handling for network and API failures
- Detailed progress reporting and statistics summary
- Structured logging for audit trail and debugging

## Logging Standards

All scripts follow consistent logging standards:

- **Timestamps:** All log entries include ISO 8601 formatted timestamps
- **Log levels:** INFO, WARNING, ERROR, and DEBUG levels for appropriate message severity
- **Structured format:** `YYYY-MM-DD HH:MM:SS [LEVEL] message`
- **Dual output:** Scripts log to stderr for debugging while maintaining clean stdout for workflow integration
- **Error context:** Exceptions include full stack traces in DEBUG mode for troubleshooting

## Integration with Workflows

These scripts are automatically executed by the GitHub Actions workflows:

### `validate.yml` Workflow
Runs on pull requests that modify `_data/collection.json`. The results are:

1. Combined into a unified `artifact.txt` file (failures only)
2. Displayed in the GitHub Actions job summary with proper formatting (all results)
3. Posted as a comment on the pull request if any validation fails
4. Include actionable "How to fix" guidance for each type of failure

Each validation step includes a clear PASS/FAIL indicator for easy identification of issues.

### `update-stats.yml` Workflow
Runs weekly (or on manual trigger) to update GitHub statistics:

1. Fetches latest star counts and commit dates from GitHub API
2. Updates `_data/collection.json` with new statistics
3. Commits and pushes changes if updates are detected
4. Provides detailed summary of updates, skips, and errors

### `rebuild.yml` Workflow
Triggers GitHub Pages rebuild with improved logging:

1. Makes authenticated API call to trigger rebuild
2. Validates response and reports success/failure
3. Provides detailed summary in workflow output
