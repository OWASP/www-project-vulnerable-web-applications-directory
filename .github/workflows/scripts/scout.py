#!/usr/bin/env python3
import os
import json
import re
from datetime import datetime
from urllib.parse import urlparse
from github import Github

def extract_github_repo(url):
    """Extract normalized owner/repo from a GitHub URL.
    
    Handles URLs with fragments, query strings, and .git suffixes.
    Returns None if the URL is not a valid GitHub repo URL.
    """
    if not url or 'github.com' not in url:
        return None
    
    try:
        parsed = urlparse(url)
        if parsed.netloc != 'github.com':
            return None
        
        # Get path and split into segments
        path = parsed.path.strip('/')
        if not path:
            return None
        
        # Remove .git suffix if present
        if path.endswith('.git'):
            path = path[:-4]
        
        # Split path and get first two segments (owner/repo)
        segments = path.split('/')
        if len(segments) >= 2:
            return f"{segments[0]}/{segments[1]}".lower()
        
        return None
    except Exception:
        return None

def load_existing_repos():
    """Load existing GitHub repos from collection.json to avoid duplicates"""
    existing = set()
    try:
        if os.path.exists('_data/collection.json'):
            with open('_data/collection.json', 'r') as f:
                data = json.load(f)
                for item in data:
                    # Check main URL
                    url = item.get('url', '')
                    repo = extract_github_repo(url)
                    if repo:
                        existing.add(repo)
                    
                    # Check references array for GitHub URLs
                    if 'references' in item and isinstance(item['references'], list):
                        for ref in item['references']:
                            if isinstance(ref, dict) and 'url' in ref:
                                ref_url = ref['url']
                                repo = extract_github_repo(ref_url)
                                if repo:
                                    existing.add(repo)
    except Exception as e:
        print(f"Warning: Could not load collection.json: {e}")
    return existing

def main():
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        print("Error: No token")
        return 1
    
    print("Starting scout...")
    
    # Load existing repos to prevent duplicates
    existing = load_existing_repos()
    print(f"Loaded {len(existing)} existing repositories from collection")
    
    gh = Github(token)
    found = []
    skipped = 0
    
    # Search for vulnerable apps
    queries = ["intentionally vulnerable", "deliberately vulnerable web"]
    for query in queries:
        print(f"Searching: {query}")
        try:
            # Build query with filters: stars, fork, archived
            search_query = f"{query} stars:>=10 fork:false archived:false"
            results = gh.search_repositories(query=search_query, sort='stars', order='desc')
            
            for repo in list(results)[:5]:
                # Skip if already in collection
                if repo.full_name.lower() in existing:
                    print(f"  Skipping {repo.name} (already in collection)")
                    skipped += 1
                    continue
                
                found.append({
                    'name': repo.name,
                    'url': repo.html_url,
                    'stars': repo.stargazers_count,
                    'description': repo.description or 'No description',
                    'language': repo.language or 'Unknown',
                    'full_name': repo.full_name
                })
                print(f"  Found: {repo.name} ({repo.stargazers_count} stars)")
        except Exception as e:
            print(f"Error searching '{query}': {e}")
    
    # Check if we found any new repositories
    if len(found) == 0:
        print(f"Done!")
        print(f"  New repos found: {len(found)}")
        print(f"  Duplicates skipped: {skipped}")
        print(f"  Existing in collection: {len(existing)}")
        print("  No issue will be created (no new apps found)")
        return 0
    
    # Save results only if we have new repositories
    date = datetime.now().strftime('%Y-%m-%d')
    with open('scout-results.json', 'w') as f:
        json.dump({
            'scan_date': date,
            'total_found': len(found),
            'total_skipped': skipped,
            'existing_in_collection': len(existing),
            'repositories': found
        }, f, indent=2)
    
    # Create issue body
    body = f"## 🔍 Scout Report - {date}\n\n"
    body += f"**Summary:**\n"
    body += f"- New repositories found: {len(found)}\n"
    body += f"- Already in collection (skipped): {skipped}\n"
    body += f"- Total existing in collection: {len(existing)}\n\n"
    body += "---\n\n"
    
    body += "### 🆕 New Repositories\n\n"
    for i, r in enumerate(found, 1):
        body += f"#### {i}. [{r['name']}]({r['url']})\n\n"
        body += f"- **Repository:** `{r['full_name']}`\n"
        body += f"- **Stars:** ⭐ {r['stars']}\n"
        body += f"- **Language:** {r['language']}\n"
        body += f"- **Description:** {r['description']}\n\n"
        body += "<details>\n"
        body += "<summary>📋 Suggested collection.json entry</summary>\n\n"
        body += "```json\n"
        body += json.dumps({
            "url": r['url'],
            "name": r['name'],
            "description": r['description'],
            "language": r['language'],
            "technologies": [],
            "collection": ["offline"]
        }, indent=2)
        body += "\n```\n\n"
        body += "</details>\n\n"
        body += "---\n\n"
    
    body += "\n*🤖 This issue was created automatically by the Repository Scout GitHub Action*\n"
    
    with open('scout-issue-body.md', 'w') as f:
        f.write(body)
    
    print(f"\nDone!")
    print(f"  New repos found: {len(found)}")
    print(f"  Duplicates skipped: {skipped}")
    print(f"  Existing in collection: {len(existing)}")
    return 0

if __name__ == '__main__':
    exit(main())
