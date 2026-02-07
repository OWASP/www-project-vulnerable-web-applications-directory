#!/usr/bin/env python3
import os
import json
from datetime import datetime
from github import Github

def main():
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        print("Error: No token")
        return 1
    
    print("Starting scout...")
    gh = Github(token)
    found = []
    
    # Search for vulnerable apps
    queries = ["intentionally vulnerable", "deliberately vulnerable web"]
    for query in queries:
        print(f"Searching: {query}")
        try:
            results = gh.search_repositories(query=f"{query} stars:>=10", sort='stars', order='desc')
            for repo in list(results)[:3]:
                if not repo.archived and repo.stargazers_count >= 10:
                    found.append({
                        'name': repo.name,
                        'url': repo.html_url,
                        'stars': repo.stargazers_count,
                        'description': repo.description or 'No description',
                        'language': repo.language or 'Unknown'
                    })
                    print(f"  Found: {repo.name}")
        except Exception as e:
            print(f"Error: {e}")
    
    # Save results
    date = datetime.now().strftime('%Y-%m-%d')
    with open('scout-results.json', 'w') as f:
        json.dump({'scan_date': date, 'total_found': len(found), 'repositories': found}, f, indent=2)
    
    # Create issue body
    body = f"## Scout Report - {date}\n\nFound {len(found)} repositories:\n\n"
    for i, r in enumerate(found, 1):
        body += f"{i}. **{r['name']}** - {r['stars']} stars\n"
        body += f"   {r['url']}\n"
        body += f"   {r['description']}\n\n"
    
    with open('scout-issue-body.md', 'w') as f:
        f.write(body)
    
    print(f"Done! Found {len(found)} repos")
    return 0

if __name__ == '__main__':
    exit(main())