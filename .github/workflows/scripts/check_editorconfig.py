#!/usr/bin/env python3
"""
Check if collection.json adheres to .editorconfig rules.
Rules for *.json files:
- indent_style = tab
- indent_size = 1
- charset = utf-8
- end_of_line = lf
- insert_final_newline = true
- trim_trailing_whitespace = true
"""
import sys
import logging
from datetime import datetime

# Configure logging with standard format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def check_editorconfig(json_file):
    """Check if JSON file adheres to .editorconfig rules."""
    logging.info(f"Starting .editorconfig compliance check")
    logging.info(f"JSON file: {json_file}")
    
    errors = []
    
    try:
        with open(json_file, 'rb') as f:
            content = f.read()
        
        logging.debug("Checking UTF-8 encoding")
        # Check charset (UTF-8)
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            logging.error("File is not UTF-8 encoded")
            errors.append("ERROR: File is not UTF-8 encoded")
            print('\n'.join(errors))
            return False
        
        logging.debug("Checking line endings")
        # Check end_of_line (LF)
        if b'\r\n' in content:
            logging.error("File contains CRLF line endings")
            errors.append("ERROR: File contains CRLF line endings (should be LF)")
        elif b'\r' in content:
            logging.error("File contains CR line endings")
            errors.append("ERROR: File contains CR line endings (should be LF)")
        
        logging.debug("Checking final newline")
        # Check insert_final_newline
        if not content.endswith(b'\n'):
            logging.error("File does not end with a newline")
            errors.append("ERROR: File does not end with a newline")
        
        # Check trim_trailing_whitespace and indent_style (tabs)
        logging.debug("Checking whitespace and indentation")
        lines = text.split('\n')
        whitespace_errors = 0
        indentation_errors = 0
        
        for i, line in enumerate(lines, 1):
            # Skip the final empty line (result of file ending with \n)
            if i == len(lines) and line == '':
                continue
            
            # Check trailing whitespace
            if line.rstrip() != line:
                errors.append(f"ERROR: Line {i} has trailing whitespace")
                whitespace_errors += 1
            
            # Check for spaces used for indentation (should be tabs)
            if line.startswith(' '):
                errors.append(f"ERROR: Line {i} uses spaces for indentation (should use tabs)")
                indentation_errors += 1
        
        if whitespace_errors > 0:
            logging.error(f"Found {whitespace_errors} lines with trailing whitespace")
        if indentation_errors > 0:
            logging.error(f"Found {indentation_errors} lines with incorrect indentation")
        
        if errors:
            logging.error(f".editorconfig compliance check failed with {len(errors)} error(s)")
            print('\n'.join(errors))
            return False
        
        logging.info(".editorconfig compliance check completed successfully")
        print("SUCCESS: File adheres to .editorconfig rules")
        return True
    
    except FileNotFoundError:
        logging.error(f"File '{json_file}' not found")
        print(f"ERROR: File '{json_file}' not found")
        return False
    except Exception as e:
        logging.error(f"Unexpected error: {e}", exc_info=True)
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: check_editorconfig.py <json_file>")
        sys.exit(1)
    
    success = check_editorconfig(sys.argv[1])
    sys.exit(0 if success else 1)
