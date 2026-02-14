#!/usr/bin/env python3
"""
Update GitHub statistics in collection.json

This script:
1. Parses collection.json to find entries with GitHub badge fields
2. Queries the GitHub GraphQL API for stargazers_count and latest commit
3. Updates the JSON with stars and last_contributed fields
4. Implements dynamic rate limiting with exponential backoff
5. Uses local caching to minimize API calls
6. Detects archived repositories: updates _data/archived_repos.json (url, name, date, notes) as
   the persistent list of repos we're tracking for cleanup. Entries already in the list are
   not re-added and don't get a new issue (retired); notes can record e.g. "keeping". New
   entries are written to archived_repos.json for the workflow to create an issue. The
   workflow commits _data/archived_repos.json when it changes.

Features:
- Dynamic rate limit handling with automatic retry
- Local caching of repository statistics
- Exponential backoff for rate limit errors
- Enhanced error logging with full response headers
- Configurable retry limits and delays
- GraphQL batch queries for efficient processing

Environment Variables:
- GITHUB_TOKEN: GitHub personal access token (recommended for higher rate limits)
- CACHE_FILE: Path to cache file (default: .github_stats_cache.json)
- MAX_RETRIES: Maximum number of retry attempts (default: 3)
- INITIAL_DELAY: Initial delay between requests in seconds (default: 1)
- DEBUG_LOGGING: Enable detailed debug logging (default: false)
"""

import json
import time
import sys
import os
from datetime import datetime
from typing import Dict, Optional, List, Any, Tuple

try:
    import requests
except ImportError:
    print("Error: requests library is required. Install with: pip install requests")
    sys.exit(1)

# Configuration
COLLECTION_JSON_PATH = "_data/collection.json"
ARCHIVED_REPOS_LIST_PATH = "_data/archived_repos.json"  # Persistent list (committed); retired/keeping lookup
GITHUB_GRAPHQL_API = "https://api.github.com/graphql"
REQUEST_TIMEOUT = 10  # Timeout for API requests in seconds
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', '3'))
INITIAL_DELAY = float(os.environ.get('INITIAL_DELAY', '1'))
CACHE_FILE = os.environ.get('CACHE_FILE', '.github_stats_cache.json')
DEBUG_LOGGING = os.environ.get('DEBUG_LOGGING', 'false').lower() == 'true'


def debug_log(message: str):
    """Print debug message if debug logging is enabled."""
    if DEBUG_LOGGING:
        print(f"[DEBUG] {message}")


def load_cache() -> Dict[str, Dict[str, Any]]:
    """
    Load cache from file.
    
    Returns:
        Dictionary mapping repo identifiers to cached data
    """
    if not os.path.exists(CACHE_FILE):
        debug_log(f"Cache file {CACHE_FILE} does not exist, starting with empty cache")
        return {}
    
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            cache = json.load(f)
            debug_log(f"Loaded cache with {len(cache)} entries")
            return cache
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Failed to load cache file: {e}")
        return {}


def save_cache(cache: Dict[str, Dict[str, Any]]):
    """
    Save cache to file.
    
    Args:
        cache: Dictionary of cached data
    """
    try:
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache, f, indent=2)
            debug_log(f"Saved cache with {len(cache)} entries")
    except IOError as e:
        print(f"Warning: Failed to save cache file: {e}")


def _normalize_url(url: str) -> str:
    """Normalize URL for comparison (lowercase, stripped)."""
    return (url or "").strip().lower()


def load_archived_repos_list() -> Tuple[List[Dict[str, Any]], set]:
    """
    Load the persistent archived-repos list from _data/archived_repos.json if it exists.
    This is the list of repos we're tracking for cleanup (or have retired). If a repo is
    already in the list we don't create another issue. Entries can have notes (e.g. "keeping").

    Returns:
        Tuple of (list of entry dicts with url, name, date, notes), set of normalized URLs
    """
    if not os.path.exists(ARCHIVED_REPOS_LIST_PATH):
        debug_log(f"Archived repos list {ARCHIVED_REPOS_LIST_PATH} does not exist")
        return [], set()
    try:
        with open(ARCHIVED_REPOS_LIST_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Failed to load {ARCHIVED_REPOS_LIST_PATH}: {e}")
        return [], set()
    if not isinstance(data, list):
        print(f"Warning: {ARCHIVED_REPOS_LIST_PATH} should be a JSON array of objects")
        return [], set()
    entries = []
    seen = set()
    for item in data:
        if not isinstance(item, dict) or not item.get('url'):
            continue
        url = (item.get('url') or '').strip()
        entries.append({
            "url": url,
            "name": item.get("name", url),
            "date": item.get("date", ""),
            "notes": item.get("notes", ""),
        })
        seen.add(_normalize_url(url))
    debug_log(f"Loaded archived repos list with {len(entries)} entries")
    return entries, seen


def save_archived_repos_list(existing_entries: List[Dict[str, Any]], new_entries: List[Dict[str, Any]]):
    """
    Merge new entries into the persistent list (by url) and write to _data/archived_repos.json.
    Existing entries are kept as-is (preserves notes). New URLs are appended with date and notes "".
    """
    seen = {_normalize_url(e["url"]) for e in existing_entries}
    merged = list(existing_entries)
    for entry in new_entries:
        url = entry.get("url", "").strip()
        if url and _normalize_url(url) not in seen:
            merged.append({
                "url": url,
                "name": entry.get("name", url),
                "date": entry.get("date", ""),
                "notes": entry.get("notes", ""),
            })
            seen.add(_normalize_url(url))
    try:
        with open(ARCHIVED_REPOS_LIST_PATH, 'w', encoding='utf-8') as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
            f.write('\n')
        debug_log(f"Saved archived repos list with {len(merged)} entries")
    except IOError as e:
        print(f"Warning: Failed to write {ARCHIVED_REPOS_LIST_PATH}: {e}")


def get_github_headers() -> Dict[str, str]:
    """
    Get headers for GitHub GraphQL API requests.
    Uses GITHUB_TOKEN environment variable if available.

    Returns:
        Dictionary of headers
    """
    headers = {
        'Accept': 'application/json',
        'User-Agent': 'OWASP-VWAD-Stats-Updater'
    }

    token = os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'token {token}'
        print("Using authenticated GitHub API requests")
    else:
        print("Using unauthenticated GitHub API requests (lower rate limits)")

    return headers


def make_graphql_request_with_retry(query: str, variables: Dict[str, Any], 
                                     headers: Dict[str, str],
                                     max_retries: int = MAX_RETRIES) -> Optional[requests.Response]:
    """
    Make a GraphQL API request with automatic retry and rate limit handling.
    
    Args:
        query: GraphQL query string
        variables: Query variables
        headers: Request headers
        max_retries: Maximum number of retry attempts
        
    Returns:
        Response object or None if all retries failed
    """
    for retry_count in range(max_retries + 1):
        try:
            if retry_count > 0:
                debug_log(f"Retry attempt {retry_count}/{max_retries} for GraphQL query")
            
            response = requests.post(
                GITHUB_GRAPHQL_API,
                headers=headers,
                json={'query': query, 'variables': variables},
                timeout=REQUEST_TIMEOUT
            )
            
            # Log response headers for debugging
            if DEBUG_LOGGING:
                debug_log(f"Response status: {response.status_code}")
                debug_log(f"Response headers: {dict(response.headers)}")
            
            # Check for rate limit (403 or 429)
            if response.status_code in [403, 429]:
                rate_limit_remaining = response.headers.get('X-RateLimit-Remaining')
                rate_limit_reset = response.headers.get('X-RateLimit-Reset')
                retry_after = response.headers.get('Retry-After')
                
                # Calculate wait time
                wait_time = None
                try:
                    if rate_limit_remaining is not None and int(rate_limit_remaining) == 0 and rate_limit_reset:
                        # Primary rate limit
                        reset_time = int(rate_limit_reset)
                        current_time = int(time.time())
                        wait_time = max(reset_time - current_time, 0) + 5  # Add 5 second buffer
                        print(f"  Rate limit exceeded. Waiting {wait_time} seconds before retry...")
                    elif retry_after:
                        # Secondary rate limit with Retry-After header
                        try:
                            wait_time = int(retry_after)
                        except ValueError:
                            wait_time = min(2 ** retry_count, 300)
                        print(f"  Secondary rate limit hit. Waiting {wait_time} seconds before retry...")
                    else:
                        # Exponential backoff
                        wait_time = min(2 ** retry_count, 300)
                        print(f"  Rate limit hit. Waiting {wait_time} seconds before retry...")
                except ValueError:
                    # Handle invalid header values
                    wait_time = min(2 ** retry_count, 300)
                    print(f"  Rate limit hit. Waiting {wait_time} seconds before retry...")
                
                if retry_count < max_retries:
                    time.sleep(wait_time)
                    continue
            
            # Return response even if it's an error (caller will handle)
            return response
            
        except requests.exceptions.Timeout:
            if retry_count < max_retries:
                wait_time = min(2 ** retry_count, 60)
                print(f"  Request timeout. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            else:
                print(f"  Request timeout after {max_retries} retries")
                return None
                
        except requests.exceptions.RequestException as e:
            if retry_count < max_retries:
                wait_time = min(2 ** retry_count, 60)
                print(f"  Request error: {e}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
                continue
            else:
                print(f"  Request failed after {max_retries} retries: {e}")
                return None
    
    return None


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


def fetch_github_stats_graphql(repos: List[Tuple[str, str]], cache: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Fetch GitHub repository statistics using GraphQL API (batch query).
    
    Args:
        repos: List of (owner, repo) tuples
        cache: Cache dictionary for storing/retrieving cached data
        
    Returns:
        Dictionary mapping repo_key to stats (including 'data_changed' flag)
    """
    if not repos:
        return {}
    
    headers = get_github_headers()
    
    # Build GraphQL query for batch fetching
    batch_size = 50  # Conservative batch size to avoid query complexity issues
    results = {}
    
    for i in range(0, len(repos), batch_size):
        batch = repos[i:i + batch_size]
        
        # Build parameterized query to prevent injection
        query_parts = []
        variables = {}
        for idx, (owner, repo) in enumerate(batch):
            alias = f"repo{idx}"
            owner_var = f"owner{idx}"
            repo_var = f"repo{idx}"
            variables[owner_var] = owner
            variables[repo_var] = repo
            query_parts.append(f'''
                {alias}: repository(owner: ${owner_var}, name: ${repo_var}) {{
                    stargazerCount
                    isArchived
                    defaultBranchRef {{
                        target {{
                            ... on Commit {{
                                committedDate
                            }}
                        }}
                    }}
                }}
            ''')
        
        # Build variable declarations
        var_declarations = []
        for idx in range(len(batch)):
            var_declarations.append(f"$owner{idx}: String!, $repo{idx}: String!")
        
        query = f'''
            query({", ".join(var_declarations)}) {{
                {" ".join(query_parts)}
            }}
        '''
        
        debug_log(f"GraphQL batch query for {len(batch)} repos")
        
        try:
            response = make_graphql_request_with_retry(query, variables, headers)
            
            status_code = getattr(response, 'status_code', None)
            if response is None or status_code != 200:
                print(f"  Warning: GraphQL batch query failed (status: {status_code if status_code else 'None'})")
                # Use cached data if available for repositories in this batch
                for owner, repo in batch:
                    repo_key = f"{owner}/{repo}"
                    cached_data = cache.get(repo_key, {})
                    if 'stars' in cached_data:
                        print(f"  Using cached data for {owner}/{repo}")
                        results[repo_key] = {
                            'stars': cached_data['stars'],
                            'last_contributed': cached_data.get('last_contributed'),
                            'data_changed': False
                        }
                    else:
                        print(f"  Warning: No cached data available for {owner}/{repo}")
                continue
            
            data = response.json()
            
            # Check for GraphQL errors
            if 'errors' in data:
                print(f"  Warning: GraphQL errors in response: {data['errors']}")
                # Still try to process any partial data we got
            
            # Parse results
            for idx, (owner, repo) in enumerate(batch):
                alias = f"repo{idx}"
                repo_key = f"{owner}/{repo}"
                
                repo_data = data.get('data', {}).get(alias)
                if repo_data:
                    stars = repo_data.get('stargazerCount', 0)
                    is_archived = repo_data.get('isArchived', False)
                    last_contributed = None
                    
                    default_branch = repo_data.get('defaultBranchRef')
                    if default_branch and default_branch.get('target'):
                        last_contributed = default_branch['target'].get('committedDate')
                    
                    # Check if data actually changed compared to cached data
                    cached_data = cache.get(repo_key, {})
                    data_changed = True
                    archived_indicator = " [ARCHIVED]" if is_archived else ""
                    if 'stars' in cached_data:
                        old_stars = cached_data.get('stars')
                        old_last_contributed = cached_data.get('last_contributed')
                        if old_stars == stars and old_last_contributed == last_contributed:
                            data_changed = False
                            print(f"  ✓ {owner}/{repo}{archived_indicator}: No changes ({stars} stars, last commit: {last_contributed})")
                        else:
                            print(f"  ✓ {owner}/{repo}{archived_indicator}: Updated - {stars} stars (was {old_stars}), last commit: {last_contributed}")
                    else:
                        print(f"  ✓ {owner}/{repo}{archived_indicator}: New entry - {stars} stars, last commit: {last_contributed}")
                    
                    results[repo_key] = {
                        'stars': stars,
                        'last_contributed': last_contributed,
                        'data_changed': data_changed,
                        'is_archived': is_archived
                    }
                    
                    # Update cache (without etag or archived fields)
                    cache[repo_key] = {
                        'stars': stars,
                        'last_contributed': last_contributed,
                        'updated_at': datetime.utcnow().isoformat()
                    }
                else:
                    print(f"  Warning: No data for {owner}/{repo} in GraphQL response")
                    # Try to use cached data
                    cached_data = cache.get(repo_key, {})
                    if 'stars' in cached_data:
                        print(f"  Using cached data for {owner}/{repo}")
                        results[repo_key] = {
                            'stars': cached_data['stars'],
                            'last_contributed': cached_data.get('last_contributed'),
                            'data_changed': False
                        }
            
            # Rate limiting between batches
            time.sleep(INITIAL_DELAY)
            
        except Exception as e:
            print(f"  Warning: GraphQL batch query error: {e}")
            debug_log(f"Exception details: {str(e)}")
            # Use cached data if available for repositories in this batch
            for owner, repo in batch:
                repo_key = f"{owner}/{repo}"
                cached_data = cache.get(repo_key, {})
                if 'stars' in cached_data:
                    print(f"  Using cached data for {owner}/{repo}")
                    results[repo_key] = {
                        'stars': cached_data['stars'],
                        'last_contributed': cached_data.get('last_contributed'),
                        'data_changed': False
                    }
                else:
                    print(f"  Warning: No cached data available for {owner}/{repo}")
    
    return results


def update_collection_stats(collection_path: str) -> bool:
    """
    Update collection.json with GitHub statistics.

    Args:
        collection_path: Path to collection.json file

    Returns:
        True if successful, False otherwise
    """
    # Load cache
    cache = load_cache()
    
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

    # Load persistent list of archived repos we're tracking (retired/keeping); avoid re-adding and duplicate issues
    archived_list_entries, archived_list_urls = load_archived_repos_list()

    # Collect all repos to process
    repos_to_fetch = []
    repo_to_entry_map = {}

    processed_count = 0
    updated_count = 0
    unchanged_count = 0
    skipped_count = 0
    error_count = 0
    archived_count = 0
    archived_repos = []  # List of {"url": full URL, "name": "...", "date": "YYYY-MM-DD", "notes": ""}
    run_date = datetime.utcnow().strftime("%Y-%m-%d")

    # Process each entry to collect repos
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
        repo_key = f"{owner}/{repo}"
        repos_to_fetch.append((owner, repo))
        repo_to_entry_map[repo_key] = entry

    print(f"Found {len(repos_to_fetch)} repositories to update")
    
    # Use GraphQL for batch fetching
    if len(repos_to_fetch) > 0:
        print("Using GraphQL API for batch queries...")
        stats_results = fetch_github_stats_graphql(repos_to_fetch, cache)
        
        # Update entries with results
        for repo_key, stats in stats_results.items():
            entry = repo_to_entry_map.get(repo_key)
            if entry and stats:
                # Track archived repos (full URL, name, date, notes); skip if already in list (retired)
                if stats.get('is_archived', False):
                    archived_count += 1
                    repo_url = f"https://github.com/{repo_key}"
                    if _normalize_url(repo_url) not in archived_list_urls:
                        archived_repos.append({
                            "url": repo_url,
                            "name": entry.get("name", repo_key),
                            "date": run_date,
                            "notes": "",
                        })
                    else:
                        debug_log(f"  {repo_key} already in archived list, skipping for issue")
                
                # Check if data in collection.json is actually changing
                old_stars = entry.get('stars')
                old_last_contributed = entry.get('last_contributed')
                new_stars = stats['stars']
                new_last_contributed = stats.get('last_contributed')
                
                # Determine if data will actually change in collection.json
                stars_changed = (old_stars != new_stars)
                # Only consider last_contributed changed if we have a new value and it differs
                # Note: If new_last_contributed is None, we don't update the field, so it's not a change
                last_contributed_changed = (new_last_contributed is not None and old_last_contributed != new_last_contributed)
                data_changed = stars_changed or last_contributed_changed
                
                # Update collection.json with stars and last_contributed only (NOT archived status)
                entry['stars'] = new_stars
                if new_last_contributed:
                    entry['last_contributed'] = new_last_contributed
                processed_count += 1
                if data_changed:
                    updated_count += 1
                else:
                    unchanged_count += 1
    
    # Save cache
    save_cache(cache)

    # Update persistent archived-repos list (merge in new entries) and write to repo
    save_archived_repos_list(archived_list_entries, archived_repos)

    # Write archived repos artifact for workflow issue creation (new entries only; empty when none)
    write_archived_repos_artifact(archived_repos)

    output_summary(processed_count, updated_count, unchanged_count, skipped_count, error_count, archived_count, archived_repos)

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

ARCHIVED_REPOS_JSON = "archived_repos.json"
ARCHIVED_REPOS_ISSUE_BODY = "archived-repos-issue-body.md"


def write_archived_repos_artifact(archived_repos: List[Dict[str, Any]]):
    """
    Write archived repos to a JSON file and markdown issue body for the workflow.
    Each entry has: url (full GitHub URL), name, date (YYYY-MM-DD), notes (string).
    Called every run; when archived_repos is empty the workflow will not create an issue.
    """
    run_date = datetime.utcnow().strftime("%Y-%m-%d")
    artifact = {
        "archived_repos": archived_repos,
        "run_date": run_date,
    }
    try:
        with open(ARCHIVED_REPOS_JSON, "w", encoding="utf-8") as f:
            json.dump(artifact, f, indent=2)
    except IOError as e:
        print(f"Warning: Failed to write {ARCHIVED_REPOS_JSON}: {e}")
        return

    if not archived_repos:
        return

    # Build issue body markdown (only when there are entries to report)
    body_lines = [
        "The following repositories in the directory are **archived** on GitHub:",
        "",
        "| Repository | Name |",
        "|------------|------|",
    ]
    for item in archived_repos:
        url = item.get("url", "")
        name = item.get("name", url)
        body_lines.append(f"| {url} | {name} |")
    body_lines.extend([
        "",
        "Consider updating the directory entry or removing it if the project is no longer maintained.",
        "",
        "*🤖 This issue was created automatically by the Update GitHub Statistics workflow.*",
    ])

    try:
        with open(ARCHIVED_REPOS_ISSUE_BODY, "w", encoding="utf-8") as f:
            f.write("\n".join(body_lines))
    except IOError as e:
        print(f"Warning: Failed to write {ARCHIVED_REPOS_ISSUE_BODY}: {e}")


def output_summary(processed_count: int, updated_count: int, unchanged_count: int, skipped_count: int, error_count: int, archived_count: int, archived_repos: List[Any]):
    summary =  f"""\nSummary:
Processed: {processed_count}
- Updated (changes detected): {updated_count}
- Unchanged (no changes): {unchanged_count}
- Archived repositories: {archived_count}"""
    
    if archived_repos:
        for item in archived_repos:
            summary += f"\n    {item.get('url', item.get('repo', item)) if isinstance(item, dict) else item}"
    
    summary += f"""
- Skipped: {skipped_count}
- Errors: {error_count}"""

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
