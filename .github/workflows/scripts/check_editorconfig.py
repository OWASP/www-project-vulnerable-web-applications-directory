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

def check_editorconfig(json_file):
    """Check if JSON file adheres to .editorconfig rules."""
    errors = []
    
    try:
        with open(json_file, 'rb') as f:
            content = f.read()
        
        # Check charset (UTF-8)
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            errors.append("ERROR: File is not UTF-8 encoded")
            print('\n'.join(errors))
            return False
        
        # Check end_of_line (LF)
        if b'\r\n' in content:
            errors.append("ERROR: File contains CRLF line endings (should be LF)")
        elif b'\r' in content:
            errors.append("ERROR: File contains CR line endings (should be LF)")
        
        # Check insert_final_newline
        if not content.endswith(b'\n'):
            errors.append("ERROR: File does not end with a newline")
        
        # Check trim_trailing_whitespace and indent_style (tabs)
        lines = text.split('\n')
        for i, line in enumerate(lines, 1):
            # Skip the final empty line (result of file ending with \n)
            if i == len(lines) and line == '':
                continue
            
            # Check trailing whitespace
            if line.rstrip() != line:
                errors.append(f"ERROR: Line {i} has trailing whitespace")
            
            # Check for spaces used for indentation (should be tabs)
            if line.startswith(' '):
                errors.append(f"ERROR: Line {i} uses spaces for indentation (should use tabs)")
        
        if errors:
            print('\n'.join(errors))
            return False
        
        print("SUCCESS: File adheres to .editorconfig rules")
        return True
    
    except FileNotFoundError:
        print(f"ERROR: File '{json_file}' not found")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: check_editorconfig.py <json_file>")
        sys.exit(1)
    
    success = check_editorconfig(sys.argv[1])
    sys.exit(0 if success else 1)
