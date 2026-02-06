#!/usr/bin/env python3
"""
Repository Scout for OWASP VWAD
Automatically discovers new vulnerable web applications on GitHub
"""

import os
import json
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
from github import Github
from github.Repository import Repository
import requests

class VulnerableAppScout:
    """Scout for discovering vulnerable web applications"""

    # Search queries for finding vulnerable web apps
    SEARCH_QUERIES = [
        "intentionally vulnerable",
        "deliberately vulnerable web",
        "security training application",
        "practice hacking web",
        "vulnerable by design",
        "pentesting practice app",
        "security testing application",
        "OWASP practice",
        "CTF web challenge",
        "vulnerable REST API",
    ]

    # Minimum requirements
    MIN_STARS = 10
    MAX_AGE_MONTHS = 24

    # Quality scoring weights
    SCORE_WEIGHTS = {
        'has_docker': 15,
        'has_readme': 10,
        'recent_activity': 20,
        'stars': 25,
        'has_description': 10,
        'has_topics': 10,
        'has_license': 5,
        'open_issues': 5,
    }

    def __init__(self, github_token: str, collection_file: str = '_data/collection.json'):
        """Initialize the scout"""
        self.gh = Github(github_token)
        self.collection_file = collection_file
        self.existing_repos = self._load_existing_repos()
        self.discovered_repos: List[Dict[str, Any]] = []

    def _load_existing_repos(self) -> set:
        """Load existing repositories from collection.json"""
        existing = set()
        try:
            if os.path.exists(self.collection_file):
                with open(self.collection_file, 'r') as f:
                    collection = json.load(f)
                    for item in collection:
                        url = item.get('url', '')
                        if 'github.com' in url:
                            # Extract repo full name from URL
                            match = re.search(r'github\.com/([^/]+/[^/\s]+)', url)
                            if match:
                                existing.add(match.group(1).lower())
        except Exception as e:
            print(f"Warning: Could not load existing collection: {e}")

        return existing

    def _calculate_quality_score(self, repo: Repository) -> int:
        """Calculate a quality score for the repository (0-100)"""
        score = 0

        # Docker support
        try:
            repo.get_contents("Dockerfile")
            score += self.SCORE_WEIGHTS['has_docker']
        except:
            pass

        # README
        try:
            repo.get_readme()
            score += self.SCORE_WEIGHTS['has_readme']
        except:
            pass

        # Recent activity (updated in last 6 months)
        months_since_update = (datetime.now() - repo.updated_at).days / 30
        if months_since_update < 6:
            score += self.SCORE_WEIGHTS['recent_activity']
        elif months_since_update < 12:
            score += self.SCORE_WEIGHTS['recent_activity'] * 0.5

        # Stars (logarithmic scale)
        if repo.stargazers_count >= 100:
            score += self.SCORE_WEIGHTS['stars']
        elif repo.stargazers_count >= 50:
            score += self.SCORE_WEIGHTS['stars'] * 0.8
        elif repo.stargazers_count >= 25:
            score += self.SCORE_WEIGHTS['stars'] * 0.5
        elif repo.stargazers_count >= self.MIN_STARS:
            score += self.SCORE_WEIGHTS['stars'] * 0.3

        # Description
        if repo.description:
            score += self.SCORE_WEIGHTS['has_description']

        # Topics
        if repo.get_topics():
            score += self.SCORE_WEIGHTS['has_topics']

        # License
        if repo.license:
            score += self.SCORE_WEIGHTS['has_license']

        # Active maintenance (has recent issues/PRs)
        if repo.open_issues_count > 0 and repo.open_issues_count < 50:
            score += self.SCORE_WEIGHTS['open_issues']

        return min(score, 100)

    def _detect_vulnerability_types(self, repo: Repository) -> List[str]:
        """Detect what types of vulnerabilities the app covers"""
        vuln_types = []

        # Check description and topics
        text_to_check = (repo.description or '').lower()
        topics = [t.lower() for t in repo.get_topics()]
        all_text = text_to_check + ' ' + ' '.join(topics)

        # Common vulnerability types
        vuln_keywords = {
            'SQL Injection': ['sql injection', 'sqli', 'sql-injection'],
            'XSS': ['xss', 'cross-site scripting', 'cross site scripting'],
            'CSRF': ['csrf', 'cross-site request forgery'],
            'Command Injection': ['command injection', 'rce', 'remote code execution'],
            'Path Traversal': ['path traversal', 'directory traversal', 'lfi'],
            'Authentication': ['authentication', 'broken auth', 'session'],
            'SSRF': ['ssrf', 'server-side request forgery'],
            'XXE': ['xxe', 'xml external entity'],
            'Insecure Deserialization': ['deserialization', 'pickle', 'serialization'],
            'API Security': ['api', 'rest api', 'graphql'],
            'OWASP Top 10': ['owasp', 'top 10', 'top10'],
        }

        for vuln_type, keywords in vuln_keywords.items():
            if any(keyword in all_text for keyword in keywords):
                vuln_types.append(vuln_type)

        return vuln_types

    def _is_valid_repo(self, repo: Repository) -> bool:
        """Check if repository meets basic criteria"""
        try:
            # Check if already in collection
            repo_full_name = repo.full_name.lower()
            if repo_full_name in self.existing_repos:
                return False

            # Check stars
            if repo.stargazers_count < self.MIN_STARS:
                return False

            # Check age
            months_since_update = (datetime.now() - repo.updated_at).days / 30
            if months_since_update > self.MAX_AGE_MONTHS:
                return False

            # Check if archived
            if repo.archived:
                return False

            # Check if has README
            try:
                repo.get_readme()
            except:
                return False

            return True

        except Exception as e:
            print(f"Error validating repo {repo.full_name}: {e}")
            return False

    def _generate_json_entry(self, repo: Repository) -> Dict[str, Any]:
        """Generate a collection.json entry for the repository"""

        # Detect language
        language = repo.language or 'Unknown'

        # Detect technologies from topics and description
        technologies = list(repo.get_topics())

        # Determine collection type
        collection_type = ['offline']  # Default

        # Check for Docker
        try:
            repo.get_contents("Dockerfile")
            if 'docker' not in [t.lower() for t in technologies]:
                technologies.append('Docker')
        except:
            pass

        # Check for docker-compose
        try:
            repo.get_contents("docker-compose.yml")
            if 'docker' not in [t.lower() for t in technologies]:
                technologies.append('Docker')
        except:
            pass

        return {
            "url": repo.html_url,
            "name": repo.name,
            "description": repo.description or f"Vulnerable web application - {repo.name}",
            "language": language,
            "technologies": technologies[:10],  # Limit to 10
            "collection": collection_type,
        }

    def search_repositories(self) -> None:
        """Search for new vulnerable web applications"""
        print("Starting repository scout...")
        print(f"Loaded {len(self.existing_repos)} existing repositories")

        found_repos = set()

        for query in self.SEARCH_QUERIES:
            print(f"\nSearching: '{query}'")

            try:
                # Search GitHub
                search_query = f"{query} stars:>={self.MIN_STARS}"
                results = self.gh.search_repositories(
                    query=search_query,
                    sort='stars',
                    order='desc'
                )

                # Process results
                count = 0
                for repo in results:
                    if count >= 10:  # Limit results per query to avoid rate limits
                        break

                    repo_full_name = repo.full_name.lower()

                    # Skip if already found or processed
                    if repo_full_name in found_repos:
                        continue

                    if self._is_valid_repo(repo):
                        found_repos.add(repo_full_name)

                        # Calculate quality score
                        quality_score = self._calculate_quality_score(repo)

                        # Detect vulnerability types
                        vuln_types = self._detect_vulnerability_types(repo)

                        # Generate JSON entry
                        json_entry = self._generate_json_entry(repo)

                        repo_info = {
                            'repository': repo.full_name,
                            'url': repo.html_url,
                            'name': repo.name,
                            'description': repo.description or 'No description',
                            'stars': repo.stargazers_count,
                            'language': repo.language or 'Unknown',
                            'last_updated': repo.updated_at.strftime('%Y-%m-%d'),
                            'has_docker': self._has_dockerfile(repo),
                            'quality_score': quality_score,
                            'vulnerability_types': vuln_types,
                            'json_entry': json_entry,
                        }

                        self.discovered_repos.append(repo_info)
                        count += 1
                        print(f"  ✓ Found: {repo.full_name} (⭐{repo.stargazers_count}, Score: {quality_score}/100)")

            except Exception as e:
                print(f"Error searching '{query}': {e}")
                continue

        print(f"\n✅ Discovery complete! Found {len(self.discovered_repos)} new repositories")

    def _has_dockerfile(self, repo: Repository) -> bool:
        """Check if repository has a Dockerfile"""
        try:
            repo.get_contents("Dockerfile")
            return True
        except:
            return False

    def generate_report(self) -> None:
        """Generate markdown report and JSON results"""

        # Sort by quality score
        self.discovered_repos.sort(key=lambda x: x['quality_score'], reverse=True)

        # Generate markdown report
        markdown = self._generate_markdown()

        # Save markdown
        with open('scout-issue-body.md', 'w') as f:
            f.write(markdown)

        # Save JSON results
        results = {
            'scan_date': datetime.now().strftime('%Y-%m-%d'),
            'total_found': len(self.discovered_repos),
            'repositories': self.discovered_repos,
        }

        with open('scout-results.json', 'w') as f:
            json.dump(results, f, indent=2)

        print(f"\n📄 Report saved to scout-issue-body.md")
        print(f"📄 Results saved to scout-results.json")

    def _generate_markdown(self) -> str:
        """Generate markdown issue body"""

        date_str = datetime.now().strftime('%Y-%m-%d')

        md = f"""## 🔍 Automated Scout Report - {date_str}

🤖 **Automated Discovery Run**

This issue was automatically generated by the Repository Scout bot that searches GitHub for new vulnerable web applications.

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
                recommendation = "✅ **Recommended**" if repo['quality_score'] >= 70 else "⚠️ Review Needed" if repo['quality_score'] >= 50 else "❌ Low Quality"

                docker_badge = "🐋 Docker" if repo['has_docker'] else ""

                md += f"""
#### {i}. [{repo['name']}]({repo['url']})

**Repository:** `{repo['repository']}`  
**Quality Score:** {repo['quality_score']}/100 {recommendation}  
**Stars:** ⭐ {repo['stars']} | **Language:** {repo['language']} | {docker_badge}  
**Last Updated:** {repo['last_updated']}

**Description:**  
{repo['description']}

**Detected Vulnerability Types:**  
{', '.join(repo['vulnerability_types']) if repo['vulnerability_types'] else 'Not detected from metadata'}

<details>
<summary>📋 Suggested collection.json Entry</summary>

```json
{json.dumps(repo['json_entry'], indent=2)}
�

"""
md += f"""