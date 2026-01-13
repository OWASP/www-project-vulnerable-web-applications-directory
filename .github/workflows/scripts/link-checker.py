import json
import requests
from sys import exit

DATA_FILE = "_data/collection.json"
FAILURES = []
REDIRECTS = []
SEEN_URLS = set()

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

        if response.is_redirect:
            # Log redirects for review
            REDIRECTS.append({
                "url": url,
                "final_url": response.headers.get("Location"),
                "status": response.status_code,
                "context": context
            })
            print(f"Redirect noted: {url} -> {response.headers.get('Location')} ({response.status_code})")
        elif response.status_code >= 400:
            # Failures for 4xx and 5xx status codes
            FAILURES.append({"url": url, "status": response.status_code, "context": context})
        else:
            print(f"URL passed: {url} ({response.status_code})")
    except requests.RequestException as e:
        FAILURES.append({"url": url, "error": str(e), "context": context})

# Process each entry in the JSON file
for index, entry in enumerate(data):
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
        print(f"- {failure.get('context')}: {failure.get('url')} ({failure.get('status') or failure.get('error')})")
    with open("failed_links.json", "w") as f:
        json.dump({"failures": FAILURES, "redirects": REDIRECTS}, f, indent=2)
    exit(1)
else:
    if REDIRECTS:
        with open("failed_links.json", "w") as f:
            json.dump({"redirects": REDIRECTS}, f, indent=2)
    print("All URLs passed validation!")
