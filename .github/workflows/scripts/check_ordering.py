#!/usr/bin/env python3
"""
Check if collection.json is ordered alphabetically by the 'name' field.
"""
import json
import sys

def check_ordering(json_file):
    """Check if entries are ordered alphabetically by name field."""
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            print("ERROR: JSON root must be an array")
            return False
        
        names = [entry.get('name', '') for entry in data]
        sorted_names = sorted(names, key=lambda x: x.lower())
        
        if names != sorted_names:
            print("ERROR: Collection entries are not ordered alphabetically by 'name' field")
            print("\nExpected order:")
            for i, (actual, expected) in enumerate(zip(names, sorted_names)):
                if actual != expected:
                    print(f"  Position {i}: Found '{actual}', expected '{expected}'")
            return False
        
        print("SUCCESS: All entries are ordered alphabetically by 'name' field")
        return True
    
    except FileNotFoundError:
        print(f"ERROR: File '{json_file}' not found")
        return False
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON - {e}")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: check_ordering.py <json_file>")
        sys.exit(1)
    
    success = check_ordering(sys.argv[1])
    sys.exit(0 if success else 1)
