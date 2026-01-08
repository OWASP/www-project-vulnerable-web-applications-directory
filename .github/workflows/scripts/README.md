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

## Integration with Workflows

These scripts are automatically executed by the `validate.yml` workflow on pull requests that modify `_data/collection.json`. The results are:

1. Combined into a unified `artifact.txt` file (failures only)
2. Displayed in the GitHub Actions job summary with proper formatting (all results)
3. Posted as a comment on the pull request if any validation fails

Each validation step includes a clear PASS/FAIL indicator for easy identification of issues.
