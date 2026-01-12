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
import logging
from datetime import datetime
from typing import Dict, Optional, List, Any

# Configure logging with standard format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

try:
    import requests
except ImportError:
    logging.error("requests library is required. Install with: pip install requests")
    print("Error: requests library is required. Install with: pip install requests")
    sys.exit(1)

# Configuration
COLLECTION_JSON_PATH = "_data/collection.json"
GITHUB_API_BASE = "https://api.github.com"
REQUEST_DELAY = 1.2  # Delay between requests in seconds (to stay under rate limits)
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
        logging.info("Using authenticated GitHub API requests")
        print("Using authenticated GitHub API requests")
    else:
        logging.warning("GITHUB_TOKEN not found, using unauthenticated requests (lower rate limits)")
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
        logging.debug(f"Fetching stats for {owner}/{repo}")
        print(f"  Fetching stats for {owner}/{repo}...")
        
        response = requests.get(repo_url, headers=headers, timeout=REQUEST_TIMEOUT)
        
        if response.status_code == 404:
            logging.warning(f"Repository {owner}/{repo} not found (404)")
            print(f"  Warning: Repository {owner}/{repo} not found (404)")
            return None
        elif response.status_code == 403:
            logging.warning(f"Rate limit exceeded or access forbidden for {owner}/{repo} (403)")
            print(f"  Warning: Rate limit exceeded or access forbidden (403)")
            return None
        elif response.status_code != 200:
            logging.warning(f"Failed to fetch {owner}/{repo} (status {response.status_code})")
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
        else:
            logging.warning(f"Could not fetch commits for {owner}/{repo} (status {commits_response.status_code})")
        
        result = {
            'stars': stars,
            'last_contributed': last_contributed
        }
        
        logging.info(f"Successfully fetched stats for {owner}/{repo}: {stars} stars")
        print(f"  ✓ {owner}/{repo}: {stars} stars, last commit: {last_contributed}")
        return result
        
    except requests.exceptions.Timeout:
        logging.error(f"Request timeout for {owner}/{repo}")
        print(f"  Warning: Request timeout for {owner}/{repo}")
        return None
    except requests.exceptions.RequestException as e:
        logging.error(f"Request error for {owner}/{repo}: {e}")
        print(f"  Warning: Request error for {owner}/{repo}: {e}")
        return None
    except (KeyError, ValueError, json.JSONDecodeError) as e:
        logging.error(f"Error parsing response for {owner}/{repo}: {e}")
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
    logging.info(f"Starting statistics update for {collection_path}")
    
    # Read the collection.json file
    try:
        logging.debug(f"Reading {collection_path}")
        with open(collection_path, 'r', encoding='utf-8') as f:
            collection = json.load(f)
    except FileNotFoundError:
        logging.error(f"File not found: {collection_path}")
        print(f"Error: File not found: {collection_path}")
        return False
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON in {collection_path}: {e}")
        print(f"Error: Invalid JSON in {collection_path}: {e}")
        return False
    
    if not isinstance(collection, list):
        logging.error(f"Expected array in {collection_path}")
        print(f"Error: Expected array in {collection_path}")
        return False
    
    logging.info(f"Processing {len(collection)} entries...")
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
            logging.warning(f"Invalid badge format '{badge}' in entry {i}: {entry.get('name', 'Unknown')}")
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
    
    logging.info(f"Summary - Updated: {updated_count}, Skipped: {skipped_count}, Errors: {error_count}")
    print(f"\nSummary:")
    print(f"  Updated: {updated_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Errors: {error_count}")
    
    # Write updated collection back to file
    try:
        logging.debug(f"Writing updated data to {collection_path}")
        with open(collection_path, 'w', encoding='utf-8') as f:
            json.dump(collection, f, indent='\t', ensure_ascii=False)
            f.write('\n')  # Add trailing newline
        logging.info(f"Successfully updated {collection_path}")
        print(f"\n✓ Successfully updated {collection_path}")
        return True
    except IOError as e:
        logging.error(f"Failed to write {collection_path}: {e}")
        print(f"Error: Failed to write {collection_path}: {e}")
        return False


def main():
    """Main entry point."""
    print("=" * 60)
    print("GitHub Statistics Update Script")
    print("=" * 60)
    print()
    
    logging.info("GitHub Statistics Update Script started")
    
    success = update_collection_stats(COLLECTION_JSON_PATH)
    
    if success:
        logging.info("Update completed successfully")
        print("\n✓ Update completed successfully")
        sys.exit(0)
    else:
        logging.error("Update failed")
        print("\n✗ Update failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
