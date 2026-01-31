# Contributing Guidelines

Thank you for your interest in contributing to the Vulnerable Web Applications Directory (VWAD). We welcome all contributions and appreciate your efforts to improve our project.

## Getting Started

To get started with contributing, please follow these steps:

1. Fork the repository and clone it to your local machine.
2. Set up your development environment.
3. Make your changes and test them locally to ensure they work as expected.
4. Submit a pull request with your changes.

## Testing

To set up a local development environment for this [Jekyll](https://jekyllrb.com/docs/installation/ubuntu/) site:

1. Install Jekyll and its required dependencies for your operating system. See [Installation](https://jekyllrb.com/docs/installation/).
2. Clone this repository, for example:
    `git clone git@github.com:OWASP/www-project-vulnerable-web-applications-directory.git www-vwad`
3. Change into the repository directory and install dependencies with:
    `cd www-vwad && bundle install`
4. Serve the site to view it locally by running:
     `bundle exec jekyll serve`

## Pull Request Guidelines

1. The overwhelming majority of this project exists within a single JSON data file: [`_data/collection.json`](https://github.com/OWASP/www-project-vulnerable-web-applications-directory/blob/master/_data/collection.json).
	1. That data file uses a single tab per level of indentation. (You can use <https://jsonformatter.curiousconcept.com/>, if needed. [Make sure you set tab to 1 tab :grinning:])
	2. Contains entries sorted case insensitively by the value of the `name` key. You can use the following, if needed:
```python
import json

# Load the JSON file
with open('_data/collection.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# Sort the data (by `name` as an example)
sorted_data = sorted(data, key=lambda x: x.get('name').lower())

# Write it back to the file with tabs for indentation
with open('_data/collection.json', 'w', encoding='utf-8') as file:
    # Use the `indent` parameter with custom separators to ensure no extra spaces
    # IMPORTANT: Use ensure_ascii=False to preserve special characters (ç, ê, etc.)
    # instead of converting them to Unicode escape sequences (\u00e7, \u00ea)
    json.dump(sorted_data, file, indent='\t', ensure_ascii=False)
    file.write('\n')  # Add a blank line at the end
```
	3. The details associated with the entries are governed by the established [JSON schema](https://github.com/OWASP/www-project-vulnerable-web-applications-directory/blob/master/schema.json).
		1. PRs which involve the data file are validated against this schema as part of a GitHub workflow process.
2. Ensure your changes do not break the data file.
3. Pull requests should include a clear and concise description of the changes you have made.
3. If your change is related to a specific issue, please ensure your PR description includes a keyword to close the issue (as applicable). Per: <https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/using-keywords-in-issues-and-pull-requests#linking-a-pull-request-to-an-issue>

## Code of Conduct

We ask that all contributors to OWASP projects abide by our [Code of Conduct](https://owasp.org/www-policy/operational/code-of-conduct). This code outlines our expectations for behavior within the project community and helps us maintain a welcoming and inclusive environment for all contributors.

Thank you for your interest in contributing to an OWASP project. We appreciate your efforts to help us improve and grow our projects.
