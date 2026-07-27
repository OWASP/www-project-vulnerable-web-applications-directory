#!/usr/bin/env python3

import os
import requests
import yaml
from pathlib import Path
import argparse

URLS = [
    "https://api.github.com/repos/OWASP/OWASP-VWAD/contributors",
    "https://api.github.com/repos/OWASP/www-project-vulnerable-web-applications-directory/contributors",
]

EXCLUDE = {
    # Bots
    "vwadbot",
    "dependabot[bot]",
    "owasp-nest[bot]",
    "github-actions[bot]",
    "Copilot",
    "OWASPFoundation",
    # Authors
    "kingthorin",
    "psiinon",
    "raulsiles"
}


def fetch_contributors(token: str = None):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    totals = {}

    for url in URLS:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()

        for user in resp.json():
            login = user["login"]
            if login in EXCLUDE:
                continue
            totals[login] = totals.get(login, 0) + user["contributions"]

    # Sort by contributions descending, then login ascending
    return sorted(
        totals.items(),
        key=lambda x: (-x[1], x[0].lower()),
    )


def update_front_matter(md_file: Path, contributors):
    text = md_file.read_text(encoding="utf-8")

    if not text.startswith("---"):
        raise RuntimeError(f"{md_file} has no YAML front matter")

    # Split front matter
    _, fm, body = text.split("---", 2)
    data = yaml.safe_load(fm) or {}

    old_contributors = data.get("contributors")
    new_contributors = [login for login, _ in contributors]

    if old_contributors == new_contributors:
        print(f"{md_file}: contributors already up to date")
        return

    data["contributors"] = new_contributors

    new_fm = yaml.safe_dump(
        data,
        sort_keys=False,
        default_flow_style=False,
    ).strip()

    new_text = f"---\n{new_fm}\n---{body}"

    md_file.write_text(new_text, encoding="utf-8")
    print(f"{md_file}: contributors updated")


def main():
    parser = argparse.ArgumentParser(
        description="Update Jekyll front matter contributors from GitHub"
    )
    parser.add_argument(
        "markdown_file",
        type=Path,
        help="Path to the markdown file to update",
    )
    args = parser.parse_args()

    # Get PAT from environment
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("Warning: GITHUB_TOKEN not set. Using unauthenticated requests.", flush=True)

    contributors = fetch_contributors(token=token)
    update_front_matter(args.markdown_file, contributors)


if __name__ == "__main__":
    main()
