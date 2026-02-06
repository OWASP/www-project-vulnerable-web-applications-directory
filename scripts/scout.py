#!/usr/bin/env python3
"""Repository Scout for OWASP VWAD"""

import os
import json
import re
from datetime import datetime
from github import Github

class VulnerableAppScout:
    SEARCH_QUERIES = [
        "intentionally vulnerable",
        "deliberately vulnerable web",
        "security training application",
        "practice hacking web",
        "vulnerable by design",
    ]
    
    MIN_STARS = 10
    MAX_AGE_MONTHS = 24
    
    def __init__(self, github_token, collection_file='_data/collection.json'):
        self.gh = Github(github_token)
        self.collection_file = collection_file
        self.existing_repos = self._load_existing_repos()
        self.discovered_repos = []
        
    def _load_existing_repos(self):
        existing = set()
        try:
            if os.path.exists(self.collection_file):
                with open(self.collection_file, 'r') as f:
                    collection = json.load(f)
                    for item in collection:
                        url = item.get('url', '')
                        if 'github.com' in url:
                            match = re.search(r'github\.com/([^/]+/[^/\s]+)', url)
                            if match:
                                existing.add(match.group(1).lower())
        except Exception as e:
            print(f"Warning: Could not load collection: {e}")
        return existing
    
    def _calculate_quality_score(self, repo):
        score = 0
        try:
            repo.get_contents("Dockerfile")
            score += 15
        except:
            pass
        try:
            repo.get_readme()
            score += 10
        except:
            pass
        months_old = (datetime.now() - repo.updated_at).days / 30
        if months_old < 6:
            score += 20
        elif months_old < 12:
            score += 10
        if repo.stargazers_count >= 100:
            score += 25
        elif repo.stargazers_count >= 50:
            score += 20
        elif repo.stargazers_count >= 25:
            score += 12
        else:
            score += 7
        if repo.description:
            score += 10
        if repo.get_topics():
            score += 10
        if repo.license:
            score += 5
        if 0 < repo.open_issues_count < 50:
            score += 5
        return min(score, 100)
    
    def _is_valid_repo(self, repo):
        try:
            if repo.full_name.lower() in self.existing_repos:
                return False
            if repo.stargazers_count < self.MIN_STARS:
                return False
            months_old = (datetime.now() - repo.updated_at).days / 30
            if months_old > self.MAX_AGE_MONTHS:
                return False
            if repo.archived:
                return False
            try:
                repo.get_readme()
            except:
                return False
            return True
        except:
            return False
    
    def search_repositories(self):
        print("Starting repository scout...")
        print(f"Existing repos: {len(self.existing_repos)}")
        found = set()
        for query in self.SEARCH_QUERIES:
            print(f"Searching: {query}")
            try:
                results = self.gh.search_repositories(
                    query=f"{query} stars:>={self.MIN_STARS}",
                    sort='stars',
                    order='desc'
                )
                count = 0
                for repo in results:
                    if count >= 5:
                        break
                    if repo.full_name.lower() in found:
                        continue
                    if self._is_valid_repo(repo):
                        found.add(repo.full_name.lower())
                        score = self._calculate_quality_score(repo)
                        has_docker = False
                        try:
                            repo.get_contents("Dockerfile")
                            has_docker = True
                        except:
                            pass
                        info = {
                            'repository': repo.full_name,
                            'url': repo.html_url,
                            'name': repo.name,
                            'description': repo.description or 'No description',
                            'stars': repo.stargazers_count,
                            'language': repo.language or 'Unknown',
                            'last_updated': repo.updated_at.strftime('%Y-%m-%d'),
                            'has_docker': has_docker,
                            'quality_score': score,
                            'json_entry': {
                                'url': repo.html_url,
                                'name': repo.name,
                                'description': repo.description or f"Vulnerable web application - {repo.name}",
                                'language': repo.language or 'Unknown',
                                'technologies': list(repo.get_topics())[:10],
                                'collection': ['offline']
                            }
                        }
                        self.discovered_repos.append(info)
                        count += 1
                        print(f"  Found: {repo.full_name} (Score: {score})")
            except Exception as e:
                print(f"Error searching '{query}': {e}")
        print(f"Discovery complete! Found {len(self.discovered_repos)} new repos")
    
    def generate_report(self):
        self.discovered_repos.sort(key=lambda x: x['quality_score'], reverse=True)
        date_str = datetime.now().strftime('%Y-%m-%d')
        md = f"""## 🔍 Automated Scout Report - {date_str}

🤖 **Automated Discovery Run**

This issue was automatically generated by the Repository Scout bot.

---

### 📊 Summary

- **New Applications Found:** {len(self.discovered_repos)}
- **Existing Applications:** {len(self.existing_repos)}
- **Search Queries Used:** {len(self.SEARCH_QUERIES)}

---

### 🆕 Discovered Applications

"""
        if not self.discovered_repos:
            md += "*No new repositories found in this scan.*\n"
        else:
            for i, repo in enumerate(self.discovered_repos, 1):
                if repo['quality_score'] >= 70:
                    rec = "✅ **Recommended**"
                elif repo['quality_score'] >= 50:
                    rec = "⚠️ Review Needed"
                else:
                    rec = "❌ Low Quality"
                docker = "🐋 Docker" if repo['has_docker'] else ""
                md += f"""
#### {i}. [{repo['name']}]({repo['url']})

**Repository:** `{repo['repository']}`  
**Quality Score:** {repo['quality_score']}/100 {rec}  
**Stars:** ⭐ {repo['stars']} | **Language:** {repo['language']} | {docker}  
**Last Updated:** {repo['last_updated']}

**Description:**  
{repo['description']}

<details>
<summary>📋 Suggested collection.json Entry</summary>

```json
{json.dumps(repo['json_entry'], indent=2)}
�

"""
md += f"""