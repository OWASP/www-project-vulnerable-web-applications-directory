#!/usr/bin/env python3
"""
Check if collection.json is ordered alphabetically by the 'name' field.
"""
import json
import sys
import logging
from datetime import datetime

# Configure logging with standard format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def check_ordering(json_file):
    """
    Check if entries are ordered alphabetically by name field.
    
    Uses case-insensitive comparison to ensure consistent ordering
    regardless of capitalization (e.g., 'Abc' comes before 'xyz').
    """
    try:
        logging.info(f"Starting alphabetical ordering check")
        logging.info(f"JSON file: {json_file}")
        
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            logging.error("JSON root is not an array")
            print("ERROR: JSON root must be an array")
            return False
        
        logging.info(f"Processing {len(data)} entries")
        
        # Check for missing names and collect names
        names = []
        for i, entry in enumerate(data):
            if 'name' not in entry:
                logging.error(f"Entry at index {i} missing 'name' field")
                print(f"ERROR: Entry at index {i} is missing required 'name' field")
                return False
            names.append(entry['name'])
        
        # Sort names case-insensitively for consistent ordering
        logging.debug("Checking alphabetical ordering")
        sorted_names = sorted(names, key=lambda x: x.lower())
        
        if names != sorted_names:
            logging.error("Entries are not in alphabetical order")
            print("ERROR: Collection entries are not ordered alphabetically by 'name' field")
            print("\nExpected order:")
            mismatches = 0
            for i, (actual, expected) in enumerate(zip(names, sorted_names)):
                if actual != expected:
                    print(f"  Position {i}: Found '{actual}', expected '{expected}'")
                    mismatches += 1
            logging.error(f"Found {mismatches} ordering mismatches")
            return False
        
        logging.info("Alphabetical ordering check completed successfully")
        print("SUCCESS: All entries are ordered alphabetically by 'name' field")
        return True
    
    except FileNotFoundError:
        logging.error(f"File '{json_file}' not found")
        print(f"ERROR: File '{json_file}' not found")
        return False
    except json.JSONDecodeError as e:
        logging.error(f"Invalid JSON: {e}")
        print(f"ERROR: Invalid JSON - {e}")
        return False
    except Exception as e:
        logging.error(f"Unexpected error: {e}", exc_info=True)
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: check_ordering.py <json_file>")
        sys.exit(1)
    
    success = check_ordering(sys.argv[1])
    sys.exit(0 if success else 1)
