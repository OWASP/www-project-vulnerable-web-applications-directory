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
import json

def check_json_structural_indentation(text, lines):
    """
    Check if JSON structural indentation adheres to tab-based rules.
    Validates that braces, brackets, and their contents are properly indented.
    """
    errors = []
    
    # Try to parse JSON to ensure it's valid
    try:
        json.loads(text)
    except json.JSONDecodeError as e:
        errors.append(f"ERROR: Invalid JSON - {e}")
        return errors
    
    # Track expected indentation depth based on JSON structure
    # We'll analyze each line and determine expected indentation
    depth = 0
    in_string = False
    escape_next = False
    
    for i, line in enumerate(lines, 1):
        # Skip the final empty line
        if i == len(lines) and line == '':
            continue
        
        stripped = line.strip()
        
        # Skip empty lines
        if not stripped:
            continue
        
        # Count leading tabs and check for mixed indentation
        leading_tabs = 0
        for j, char in enumerate(line):
            if char == '\t':
                leading_tabs += 1
            elif char == ' ':
                # Found space in indentation area - this is an error
                errors.append(
                    f"ERROR: Line {i} has space character in indentation "
                    f"(position {j+1}): tabs and spaces should not be mixed"
                )
                break
            else:
                # First non-whitespace character
                break
        
        # Determine expected indentation based on the line content
        # Lines that decrease depth (closing braces/brackets)
        if stripped.startswith('}') or stripped.startswith(']'):
            expected_depth = depth - 1
        else:
            expected_depth = depth
        
        # Check if indentation matches expected depth
        if leading_tabs != expected_depth:
            # Get context for error message
            context = stripped[:50] + '...' if len(stripped) > 50 else stripped
            errors.append(
                f"ERROR: Line {i} has incorrect indentation: "
                f"expected {expected_depth} tab(s), found {leading_tabs} tab(s) - '{context}'"
            )
        
        # Update depth for next line based on what's on this line
        # We need to properly count braces/brackets, ignoring those in strings
        in_string = False
        escape_next = False
        open_count = 0
        close_count = 0
        
        for char in stripped:
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char == '"':
                in_string = not in_string
                continue
            
            if not in_string:
                if char == '{' or char == '[':
                    open_count += 1
                elif char == '}' or char == ']':
                    close_count += 1
        
        # Account for same-line open/close (like "[]" or "{}")
        net_change = open_count - close_count
        depth += net_change
    
    return errors


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
        
        # Check JSON structural indentation
        structural_errors = check_json_structural_indentation(text, lines)
        errors.extend(structural_errors)
        
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
