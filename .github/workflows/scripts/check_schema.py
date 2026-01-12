#!/usr/bin/env python3
"""
Check if collection.json conforms to the JSON schema.
Uses Python's jsonschema library for validation with user-friendly error messages.
"""
import json
import sys
import logging
from datetime import datetime
from jsonschema import Draft202012Validator, FormatChecker, ValidationError

# Configure logging with standard format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)


def check_schema(schema_file, json_file):
    """Check if JSON file conforms to the schema."""
    try:
        logging.info(f"Starting schema validation")
        logging.info(f"Schema file: {schema_file}")
        logging.info(f"JSON file: {json_file}")
        
        # Load schema
        logging.debug(f"Loading schema from {schema_file}")
        with open(schema_file, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        
        # Load data
        logging.debug(f"Loading data from {json_file}")
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        logging.info(f"Processing {len(data) if isinstance(data, list) else 'N/A'} entries")
        
        # Create validator with format checking (for URIs, dates, etc.)
        logging.debug("Creating validator with format checker")
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        
        # Collect all validation errors
        logging.debug("Validating data against schema")
        errors = list(validator.iter_errors(data))
        
        if errors:
            logging.error(f"Schema validation failed with {len(errors)} error(s)")
            print(f"ERROR: Schema validation failed with {len(errors)} error(s)\n")
            
            for i, error in enumerate(errors, 1):
                # Get the path to the error (e.g., which entry)
                path_list = list(error.path)
                
                if path_list:
                    entry_index = path_list[0]
                    field_path = " -> ".join(str(p) for p in path_list[1:]) if len(path_list) > 1 else None
                    
                    print(f"Entry #{entry_index}:")
                    print(f"  Error: {error.message}")
                    if field_path:
                        print(f"  Field: {field_path}")
                else:
                    print(f"Error {i}: {error.message}")
                
                # Show validator type for additional context
                if error.validator in ['required', 'enum', 'minimum', 'maximum', 'format']:
                    if error.validator == 'required':
                        print(f"  Required fields: {error.validator_value}")
                    elif error.validator == 'enum':
                        print(f"  Allowed values: {error.validator_value}")
                    elif error.validator in ['minimum', 'maximum']:
                        print(f"  Constraint: {error.validator} = {error.validator_value}")
                    elif error.validator == 'format':
                        print(f"  Expected format: {error.validator_value}")
                
                print()
            
            return False
        
        logging.info("Schema validation completed successfully")
        print("SUCCESS: All entries conform to the schema")
        return True
    
    except FileNotFoundError as e:
        logging.error(f"File not found: {e}")
        print(f"ERROR: File not found - {e}")
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
    if len(sys.argv) != 3:
        print("Usage: check_schema.py <schema_file> <json_file>")
        sys.exit(1)
    
    success = check_schema(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)
