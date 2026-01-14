#!/usr/bin/env python3
"""
Update GitHub statistics in collection.json

This script:
1. Parses collection.json to find entries with GitHub badge fields
2. Queries the GitHub API for stargazers_count and latest commit
3. Updates the JSON with stars and last_contributed fields
4. Throttles requests to comply with GitHub rate limits
"""

import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, Optional, List, Any

try:
    import requests
except ImportError:
    print("Error: requests library is required. Install with: pip install requests")
    sys.exit(1)

# Configuration
COLLECTION_JSON_PATH = "_data/collection.json"
GITHUB_API_BASE = "https://api.github.com"
REQUEST_DELAY = 1  # Delay between requests in seconds (to stay under rate limits)
REQUEST_TIMEOUT = 10  # Timeout for API requests in seconds


def get_github_headers() -> Dict[str, str]:
    """
    Get headers for GitHub API requests.
    Uses GITHUB_TOKEN environment variable if available.

    Returns:
        Dictionary of headers
    """
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OWASP-VWAD-Stats-Updater'
    }

    token = os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'token {token}'
        print("Using authenticated GitHub API requests")
    else:
        print("Using unauthenticated GitHub API requests (lower rate limits)")

    return headers


def parse_github_badge(badge: str) -> Optional[tuple]:
    """
    Parse GitHub badge in owner/repo format.

    Args:
        badge: Badge string, expected format is "owner/repo"

    Returns:
        Tuple of (owner, repo) or None if invalid
    """
    if not badge or '/' not in badge:
        return None

    parts = badge.split('/')
    if len(parts) != 2:
        return None

    owner, repo = parts[0].strip(), parts[1].strip()
    if not owner or not repo:
        return None

    return (owner, repo)


def fetch_github_stats(owner: str, repo: str) -> Optional[Dict[str, Any]]:
    """
    Fetch GitHub repository statistics from the API.

    Args:
        owner: Repository owner
        repo: Repository name

    Returns:
        Dictionary with 'stars' and 'last_contributed' or None on error
    """
    headers = get_github_headers()

    try:
        # Fetch repository information
        repo_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
        print(f"  Fetching stats for {owner}/{repo}...")

        response = requests.get(repo_url, headers=headers, timeout=REQUEST_TIMEOUT)

        if response.status_code == 404:
            print(f"  Warning: Repository {owner}/{repo} not found (404)")
            return None
        elif response.status_code == 403:
            print(f"  Warning: Rate limit exceeded or access forbidden (403)")
            return None
        elif response.status_code != 200:
            print(f"  Warning: Failed to fetch {owner}/{repo} (status {response.status_code})")
            return None

        repo_data = response.json()
        stars = repo_data.get('stargazers_count', 0)

        # Fetch latest commit to get last contribution date
        # Use commits endpoint with per_page=1 to get just the most recent
        commits_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits"
        params = {'per_page': 1}

        time.sleep(REQUEST_DELAY)  # Rate limiting
        commits_response = requests.get(commits_url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)

        last_contributed = None
        if commits_response.status_code == 200:
            commits_data = commits_response.json()
            if commits_data and len(commits_data) > 0:
                # Get commit date from the most recent commit
                commit = commits_data[0]
                commit_info = commit.get('commit', {})
                committer_info = commit_info.get('committer', {})
                last_contributed = committer_info.get('date')

        result = {
            'stars': stars,
            'last_contributed': last_contributed
        }

        print(f"  ✓ {owner}/{repo}: {stars} stars, last commit: {last_contributed}")
        return result

    except requests.exceptions.Timeout:
        print(f"  Warning: Request timeout for {owner}/{repo}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"  Warning: Request error for {owner}/{repo}: {e}")
        return None
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        print(f"  Warning: Error parsing response for {owner}/{repo}: {e}")
        return None


def update_collection_stats(collection_path: str) -> bool:
    """
    Update collection.json with GitHub statistics.

    Args:
        collection_path: Path to collection.json file

    Returns:
        True if successful, False otherwise
    """
    # Read the collection.json file
    try:
        with open(collection_path, 'r', encoding='utf-8') as f:
            collection = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {collection_path}")
        return False
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in {collection_path}: {e}")
        return False

    if not isinstance(collection, list):
        print(f"Error: Expected array in {collection_path}")
        return False

    print(f"Processing {len(collection)} entries...")

    updated_count = 0
    skipped_count = 0
    error_count = 0

    # Process each entry
    for i, entry in enumerate(collection):
        if not isinstance(entry, dict):
            continue

        # Check if entry has a badge field (GitHub identifier)
        badge = entry.get('badge')
        if not badge:
            # No badge, skip this entry (non-GitHub project)
            continue

        # Parse the badge to get owner/repo
        parsed = parse_github_badge(badge)
        if not parsed:
            print(f"  Warning: Invalid badge format '{badge}' in entry {i}: {entry.get('name', 'Unknown')}")
            skipped_count += 1
            continue

        owner, repo = parsed

        # Fetch GitHub stats
        stats = fetch_github_stats(owner, repo)

        if stats:
            # Update the entry with new fields
            entry['stars'] = stats['stars']
            if stats['last_contributed']:
                entry['last_contributed'] = stats['last_contributed']
            updated_count += 1
        else:
            error_count += 1

        # Add delay between requests
        time.sleep(REQUEST_DELAY)

    output_summary(updated_count, skipped_count, error_count)

    # Write updated collection back to file
    try:
        with open(collection_path, 'w', encoding='utf-8') as f:
            json.dump(collection, f, indent='\t', ensure_ascii=False)
            f.write('\n')  # Add trailing newline
        print(f"\n✓ Successfully updated {collection_path}")
        return True
    except IOError as e:
        print(f"Error: Failed to write {collection_path}: {e}")
        return False

def output_summary(updated_count: int, skipped_count: int, error_count: int)
    summary =  f"""\nSummary:
      Updated: {updated_count}
      Skipped: {skipped_count}
      Errors: {error_count}"""

    print(summary)
    # Get the path to the summary file from the environment variable
    summary_file_path = os.environ.get('GITHUB_STEP_SUMMARY')

    if summary_file_path:
        with open(summary_file_path, 'a') as summary_file:
            summary_file.write(summary)
    else:
        print("GITHUB_STEP_SUMMARY environment variable not found.")

def main():
    """Main entry point."""
    print("=" * 60)
    print("GitHub Statistics Update Script")
    print("=" * 60)
    print()

    success = update_collection_stats(COLLECTION_JSON_PATH)

    if success:
        print("\n✓ Update completed successfully")
        sys.exit(0)
    else:
        print("\n✗ Update failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
