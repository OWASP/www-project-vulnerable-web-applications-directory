import json
import requests
import os
from sys import exit

DATA_FILE = "_data/collection.json"
FAILURES = []
REDIRECTS = []
SEEN_URLS = set()

def get_status_or_error(failure):
    """Get status code or error message from a failure dict."""
    return failure.get('status') if failure.get('status') is not None else failure.get('error')

def output_summary(total_entries, failures_count, redirects_count):
    """Output workflow summary to GITHUB_STEP_SUMMARY."""
    summary = f"""## Link Checker Results

**Summary:**
- Total entries checked: {total_entries}
- Failed URLs: {failures_count}
- Redirected URLs: {redirects_count}
- Status: {'✓ PASSED' if failures_count == 0 else '✗ FAILED'}
"""

    print(summary)
    
    # Get the path to the summary file from the environment variable
    summary_file_path = os.environ.get('GITHUB_STEP_SUMMARY')
    
    if summary_file_path:
        with open(summary_file_path, 'a') as summary_file:
            summary_file.write(summary)
            
            # Add failure details if any
            if FAILURES:
                summary_file.write(f"\n### {len(FAILURES)} URLs failed validation:\n\n")
                for failure in FAILURES:
                    summary_file.write(f"- {failure.get('context')}: {failure.get('url')} ({get_status_or_error(failure)})\n")
            
            # Add redirect details if any
            if REDIRECTS:
                summary_file.write(f"\n### {len(REDIRECTS)} URLs resulted in redirects:\n\n")
                for redirect in REDIRECTS:
                    summary_file.write(f"- {redirect['context']}: {redirect['url']} -> {redirect['final_url']} ({redirect['status']})\n")
    else:
        print("GITHUB_STEP_SUMMARY environment variable not found.")

# Load collection JSON file
try:
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
except FileNotFoundError:
    print(f"Error: File '{DATA_FILE}' not found.")
    exit(1)
except json.JSONDecodeError as e:
    print(f"Error: Failed to parse JSON file. {e}")
    exit(1)

# Validate URLs
def validate_url(url, context):
    if url in SEEN_URLS:
        print(f"Skipping duplicate URL: {url}")
        return
    SEEN_URLS.add(url)
    try:
        print(f"Checking URL: {url} (Context: {context})")
        response = requests.head(url, allow_redirects=True, timeout=10)

        # Check if URL was redirected
        if response.history:
            # URL was redirected
            original_response = response.history[0]
            REDIRECTS.append({
                "url": url,
                "final_url": response.url,
                "status": original_response.status_code,
                "context": context
            })
            print(f"Redirect noted: {url} -> {response.url} ({original_response.status_code})")
            # Also check if the final destination has an error status
            if response.status_code >= 400:
                FAILURES.append({"url": url, "status": response.status_code, "context": context})
                print(f"  Warning: Final URL returned error status {response.status_code}")
        elif response.status_code >= 400:
            # Failures for 4xx and 5xx status codes
            FAILURES.append({"url": url, "status": response.status_code, "context": context})
        else:
            print(f"URL passed: {url} ({response.status_code})")
    except requests.RequestException as e:
        FAILURES.append({"url": url, "error": str(e), "context": context})

# Process each entry in the JSON file
for index, entry in enumerate(data):
    # Use 1-based indexing for human-readable fallback name
    name = entry.get("name", f"Entry {index + 1}")

    # Check app URL
    app_url = entry.get("url")
    if app_url:
        validate_url(app_url, f"{name} (App URL)")

    # Check associated reference URLs
    references = entry.get("references", [])
    if isinstance(references, list):
        for ref in references:
            ref_url = ref.get("url")
            if ref_url:
                validate_url(ref_url, f"{name} (Reference URL)")

# Log results
if REDIRECTS:
    print(f"\n{len(REDIRECTS)} URLs resulted in redirects:")
    for redirect in REDIRECTS:
        print(f"- {redirect['context']}: {redirect['url']} -> {redirect['final_url']} ({redirect['status']})")

if FAILURES:
    print(f"\n{len(FAILURES)} URLs failed validation:")
    for failure in FAILURES:
        print(f"- {failure.get('context')}: {failure.get('url')} ({get_status_or_error(failure)})")
    with open("failed_links.json", "w") as f:
        json.dump({"failures": FAILURES, "redirects": REDIRECTS}, f, indent=2)
    output_summary(len(data), len(FAILURES), len(REDIRECTS))
    exit(1)
else:
    if REDIRECTS:
        with open("failed_links.json", "w") as f:
            json.dump({"redirects": REDIRECTS}, f, indent=2)
    print("All URLs passed validation!")
    output_summary(len(data), len(FAILURES), len(REDIRECTS))
