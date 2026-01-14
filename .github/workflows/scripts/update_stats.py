#!/usr/bin/env python3
"""
Update GitHub statistics in collection.json

This script:
1. Parses collection.json to find entries with GitHub badge fields
2. Queries the GitHub API for stargazers_count and latest commit
3. Updates the JSON with stars and last_contributed fields
4. Implements dynamic rate limiting with exponential backoff
5. Uses local caching to minimize API calls
6. Supports both REST and GraphQL APIs

Features:
- Dynamic rate limit handling with automatic retry
- Local caching of repository statistics (etag-based)
- Exponential backoff for rate limit errors
- Enhanced error logging with full response headers
- Configurable retry limits and delays

Environment Variables:
- GITHUB_TOKEN: GitHub personal access token (recommended for higher rate limits)
- CACHE_FILE: Path to cache file (default: .github_stats_cache.json)
- MAX_RETRIES: Maximum number of retry attempts (default: 3)
- INITIAL_DELAY: Initial delay between requests in seconds (default: 1)
- USE_GRAPHQL: Use GraphQL API for batch queries (default: false)
- DEBUG_LOGGING: Enable detailed debug logging (default: false)
"""

import json
import time
import sys
import os
import hashlib
from datetime import datetime
from typing import Dict, Optional, List, Any, Tuple

try:
    import requests
except ImportError:
    print("Error: requests library is required. Install with: pip install requests")
    sys.exit(1)

# Configuration
COLLECTION_JSON_PATH = "_data/collection.json"
GITHUB_API_BASE = "https://api.github.com"
GITHUB_GRAPHQL_API = "https://api.github.com/graphql"
REQUEST_TIMEOUT = 10  # Timeout for API requests in seconds
MAX_RETRIES = int(os.environ.get('MAX_RETRIES', '3'))
INITIAL_DELAY = float(os.environ.get('INITIAL_DELAY', '1'))
CACHE_FILE = os.environ.get('CACHE_FILE', '.github_stats_cache.json')
USE_GRAPHQL = os.environ.get('USE_GRAPHQL', 'false').lower() == 'true'
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


def get_github_headers(for_graphql: bool = False) -> Dict[str, str]:
    """
    Get headers for GitHub API requests.
    Uses GITHUB_TOKEN environment variable if available.

    Args:
        for_graphql: Whether headers are for GraphQL API

    Returns:
        Dictionary of headers
    """
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'OWASP-VWAD-Stats-Updater'
    }
    
    if for_graphql:
        headers['Accept'] = 'application/json'

    token = os.environ.get('GITHUB_TOKEN')
    if token:
        headers['Authorization'] = f'token {token}'
        print("Using authenticated GitHub API requests")
    else:
        print("Using unauthenticated GitHub API requests (lower rate limits)")

    return headers


def handle_rate_limit(response: requests.Response, retry_count: int) -> Tuple[bool, float]:
    """
    Handle rate limit responses from GitHub API.
    
    Args:
        response: Response object from requests
        retry_count: Current retry attempt number
        
    Returns:
        Tuple of (should_retry, wait_time)
    """
    # Log response headers for debugging
    if DEBUG_LOGGING:
        debug_log(f"Response status: {response.status_code}")
        debug_log(f"Response headers: {dict(response.headers)}")
    
    # Check for rate limit via status code and headers
    if response.status_code == 403:
        rate_limit_remaining = response.headers.get('X-RateLimit-Remaining')
        rate_limit_reset = response.headers.get('X-RateLimit-Reset')
        
        # Check if it's actually a rate limit error
        if rate_limit_remaining is not None and int(rate_limit_remaining) == 0:
            # Calculate wait time based on reset time
            if rate_limit_reset:
                reset_time = int(rate_limit_reset)
                current_time = int(time.time())
                wait_time = max(reset_time - current_time, 0) + 5  # Add 5 second buffer
            else:
                # Fallback to exponential backoff
                wait_time = min(2 ** retry_count, 300)  # Cap at 5 minutes
            
            print(f"  Rate limit exceeded. Waiting {wait_time} seconds before retry...")
            return True, wait_time
    
    # Check for secondary rate limit (status 429 or specific 403)
    if response.status_code == 429 or (response.status_code == 403 and 'Retry-After' in response.headers):
        retry_after = response.headers.get('Retry-After', response.headers.get('retry-after'))
        if retry_after:
            try:
                wait_time = int(retry_after)
            except ValueError:
                # Retry-After might be a HTTP date, use exponential backoff
                debug_log(f"Invalid Retry-After header value: {retry_after}")
                wait_time = min(2 ** retry_count, 300)
        else:
            wait_time = min(2 ** retry_count, 300)
        
        print(f"  Secondary rate limit hit. Waiting {wait_time} seconds before retry...")
        return True, wait_time
    
    return False, 0


def make_api_request_with_retry(url: str, headers: Dict[str, str], 
                                  params: Optional[Dict[str, Any]] = None,
                                  data: Optional[Dict[str, Any]] = None,
                                  method: str = 'GET',
                                  max_retries: int = MAX_RETRIES) -> Optional[requests.Response]:
    """
    Make an API request with automatic retry and rate limit handling.
    
    Args:
        url: URL to request
        headers: Request headers
        params: Query parameters
        data: Request body data (for POST requests)
        method: HTTP method (GET or POST)
        max_retries: Maximum number of retry attempts
        
    Returns:
        Response object or None if all retries failed
    """
    for retry_count in range(max_retries + 1):
        try:
            if retry_count > 0:
                debug_log(f"Retry attempt {retry_count}/{max_retries} for {url}")
            
            if method.upper() == 'POST':
                response = requests.post(url, headers=headers, json=data, timeout=REQUEST_TIMEOUT)
            else:
                response = requests.get(url, headers=headers, params=params, timeout=REQUEST_TIMEOUT)
            
            # Check for rate limit
            should_retry, wait_time = handle_rate_limit(response, retry_count)
            
            if should_retry and retry_count < max_retries:
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


def fetch_github_stats(owner: str, repo: str, cache: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Fetch GitHub repository statistics from the API.

    Args:
        owner: Repository owner
        repo: Repository name
        cache: Cache dictionary for storing/retrieving cached data

    Returns:
        Dictionary with 'stars' and 'last_contributed' or None on error
    """
    headers = get_github_headers()
    repo_key = f"{owner}/{repo}"
    
    # Check cache for etag
    cached_data = cache.get(repo_key, {})
    etag = cached_data.get('etag')
    
    if etag:
        headers['If-None-Match'] = etag
        debug_log(f"Using cached etag for {repo_key}: {etag}")

    try:
        # Fetch repository information
        repo_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}"
        print(f"  Fetching stats for {owner}/{repo}...")

        response = make_api_request_with_retry(repo_url, headers)
        
        if response is None:
            print(f"  Warning: Failed to fetch {owner}/{repo} after retries")
            # Return cached data if available
            if 'stars' in cached_data:
                print(f"  Using cached data for {owner}/{repo}")
                return {'stars': cached_data['stars'], 'last_contributed': cached_data.get('last_contributed')}
            return None

        # Handle 304 Not Modified - use cached data
        if response.status_code == 304:
            print(f"  ✓ {owner}/{repo}: Using cached data (not modified)")
            return {'stars': cached_data['stars'], 'last_contributed': cached_data.get('last_contributed')}

        if response.status_code == 404:
            print(f"  Warning: Repository {owner}/{repo} not found (404)")
            return None
        elif response.status_code == 403:
            print(f"  Warning: Rate limit exceeded or access forbidden (403) for {owner}/{repo}")
            debug_log(f"Response headers: {dict(response.headers)}")
            # Return cached data if available
            if 'stars' in cached_data:
                print(f"  Using cached data for {owner}/{repo}")
                return {'stars': cached_data['stars'], 'last_contributed': cached_data.get('last_contributed')}
            return None
        elif response.status_code != 200:
            print(f"  Warning: Failed to fetch {owner}/{repo} (status {response.status_code})")
            debug_log(f"Response body: {response.text[:500]}")
            # Return cached data if available
            if 'stars' in cached_data:
                print(f"  Using cached data for {owner}/{repo}")
                return {'stars': cached_data['stars'], 'last_contributed': cached_data.get('last_contributed')}
            return None

        repo_data = response.json()
        stars = repo_data.get('stargazers_count', 0)
        
        # Store new etag
        new_etag = response.headers.get('ETag')

        # Fetch latest commit to get last contribution date
        # Use commits endpoint with per_page=1 to get just the most recent
        commits_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits"
        params = {'per_page': 1}

        # Add a small delay between requests to the same repo
        time.sleep(INITIAL_DELAY)
        
        commits_response = make_api_request_with_retry(commits_url, headers, params)

        last_contributed = None
        if commits_response and commits_response.status_code == 200:
            commits_data = commits_response.json()
            if commits_data and len(commits_data) > 0:
                # Get commit date from the most recent commit
                commit = commits_data[0]
                commit_info = commit.get('commit', {})
                committer_info = commit_info.get('committer', {})
                last_contributed = committer_info.get('date')
        elif commits_response and commits_response.status_code != 200:
            debug_log(f"Failed to fetch commits for {owner}/{repo}: status {commits_response.status_code}")

        result = {
            'stars': stars,
            'last_contributed': last_contributed
        }
        
        # Update cache
        cache[repo_key] = {
            'stars': stars,
            'last_contributed': last_contributed,
            'etag': new_etag,
            'updated_at': datetime.utcnow().isoformat()
        }

        print(f"  ✓ {owner}/{repo}: {stars} stars, last commit: {last_contributed}")
        return result

    except (KeyError, ValueError, json.JSONDecodeError) as e:
        print(f"  Warning: Error parsing response for {owner}/{repo}: {e}")
        debug_log(f"Exception details: {str(e)}")
        # Return cached data if available
        if 'stars' in cached_data:
            print(f"  Using cached data for {owner}/{repo}")
            return {'stars': cached_data['stars'], 'last_contributed': cached_data.get('last_contributed')}
        return None


def fetch_github_stats_graphql(repos: List[Tuple[str, str]], cache: Dict[str, Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """
    Fetch GitHub repository statistics using GraphQL API (batch query).
    
    Args:
        repos: List of (owner, repo) tuples
        cache: Cache dictionary for storing/retrieving cached data
        
    Returns:
        Dictionary mapping repo_key to stats
    """
    if not repos:
        return {}
    
    headers = get_github_headers(for_graphql=True)
    
    # Build GraphQL query for batch fetching (max 100 repos at a time)
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
            response = make_api_request_with_retry(
                GITHUB_GRAPHQL_API,
                headers,
                data={'query': query, 'variables': variables},
                method='POST'
            )
            
            if response is None or response.status_code != 200:
                print(f"  Warning: GraphQL batch query failed, falling back to REST API")
                # Fall back to individual REST API calls
                for owner, repo in batch:
                    repo_key = f"{owner}/{repo}"
                    stats = fetch_github_stats(owner, repo, cache)
                    if stats:
                        results[repo_key] = stats
                continue
            
            data = response.json()
            
            # Parse results
            for idx, (owner, repo) in enumerate(batch):
                alias = f"repo{idx}"
                repo_key = f"{owner}/{repo}"
                
                repo_data = data.get('data', {}).get(alias)
                if repo_data:
                    stars = repo_data.get('stargazerCount', 0)
                    last_contributed = None
                    
                    default_branch = repo_data.get('defaultBranchRef')
                    if default_branch and default_branch.get('target'):
                        last_contributed = default_branch['target'].get('committedDate')
                    
                    results[repo_key] = {
                        'stars': stars,
                        'last_contributed': last_contributed
                    }
                    
                    # Update cache
                    cache[repo_key] = {
                        'stars': stars,
                        'last_contributed': last_contributed,
                        'updated_at': datetime.utcnow().isoformat()
                    }
                    
                    print(f"  ✓ {owner}/{repo}: {stars} stars, last commit: {last_contributed}")
                else:
                    print(f"  Warning: No data for {owner}/{repo} in GraphQL response")
            
            # Rate limiting between batches
            time.sleep(INITIAL_DELAY)
            
        except Exception as e:
            print(f"  Warning: GraphQL batch query error: {e}")
            debug_log(f"Exception details: {str(e)}")
            # Fall back to individual REST API calls
            for owner, repo in batch:
                repo_key = f"{owner}/{repo}"
                stats = fetch_github_stats(owner, repo, cache)
                if stats:
                    results[repo_key] = stats
    
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
    
    # Collect all repos to process
    repos_to_fetch = []
    repo_to_entry_map = {}

    updated_count = 0
    skipped_count = 0
    error_count = 0

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
    
    # Use GraphQL for batch fetching if enabled
    if USE_GRAPHQL and len(repos_to_fetch) > 0:
        print("Using GraphQL API for batch queries...")
        stats_results = fetch_github_stats_graphql(repos_to_fetch, cache)
        
        # Update entries with results
        for repo_key, stats in stats_results.items():
            entry = repo_to_entry_map.get(repo_key)
            if entry and stats:
                entry['stars'] = stats['stars']
                if stats['last_contributed']:
                    entry['last_contributed'] = stats['last_contributed']
                updated_count += 1
    else:
        # Use REST API for individual fetching
        print("Using REST API for individual queries...")
        for owner, repo in repos_to_fetch:
            repo_key = f"{owner}/{repo}"
            
            # Fetch GitHub stats
            stats = fetch_github_stats(owner, repo, cache)

            if stats:
                # Update the entry with new fields
                entry = repo_to_entry_map[repo_key]
                entry['stars'] = stats['stars']
                if stats['last_contributed']:
                    entry['last_contributed'] = stats['last_contributed']
                updated_count += 1
            else:
                error_count += 1

            # Add delay between requests to avoid hitting rate limits
            time.sleep(INITIAL_DELAY)
    
    # Save cache
    save_cache(cache)

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

def output_summary(updated_count: int, skipped_count: int, error_count: int):
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
