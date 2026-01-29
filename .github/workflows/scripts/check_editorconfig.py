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

def build_line_to_entry_map(text, lines):
    """
    Build a mapping from line numbers to entry information.
    Uses the parsed JSON structure to identify entries and their boundaries.
    Returns a dict mapping line number to (entry_index, entry_name).
    """
    line_to_entry = {}
    
    try:
        data = json.loads(text)
        if not isinstance(data, list):
            return line_to_entry
        
        # For each entry in the parsed JSON, find where it appears in the text
        # by searching for unique fields like "name" or "url"
        entry_line_ranges = []
        
        for entry_index, entry in enumerate(data):
            # Get identifying fields for this entry
            entry_name = entry.get('name', '')
            entry_url = entry.get('url', '')
            
            # Search for the line containing this entry's name field
            # Format in JSON: "name": "EntryName",
            name_search = f'"name": "{entry_name}"'
            
            start_line = None
            for i, line in enumerate(lines, 1):
                if name_search in line:
                    start_line = i
                    break
            
            # If we found the name, work backwards to find the opening brace
            # and forwards to find the closing brace
            if start_line:
                # Find opening brace (search backwards from name line)
                open_line = start_line
                for i in range(start_line - 1, 0, -1):
                    if lines[i - 1].strip() == '{' or lines[i - 1].strip().startswith('{'):
                        open_line = i
                        break
                
                # Find closing brace (search forwards from name line)
                close_line = start_line
                brace_depth = 0
                found_opening = False
                for i in range(open_line - 1, len(lines)):
                    line_stripped = lines[i].strip()
                    # Track brace depth to find matching closing brace
                    if '{' in line_stripped:
                        brace_depth += line_stripped.count('{')
                        found_opening = True
                    if '}' in line_stripped:
                        brace_depth -= line_stripped.count('}')
                        if found_opening and brace_depth == 0:
                            close_line = i + 1
                            break
                
                entry_line_ranges.append((entry_index, entry_name, open_line, close_line))
        
        # Now map all lines within each entry's range
        for entry_index, entry_name, start_line, end_line in entry_line_ranges:
            for line_num in range(start_line, end_line + 1):
                line_to_entry[line_num] = (entry_index, entry_name)
        
    except Exception:
        # If we can't build the map, return empty dict
        pass
    
    return line_to_entry


def check_json_structural_indentation(text, lines):
    """
    Check if JSON structural indentation adheres to tab-based rules.
    Validates that braces, brackets, and their contents are properly indented.
    """
    errors = []
    
    # Try to parse JSON to ensure it's valid
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        errors.append(f"ERROR: Invalid JSON - {e}")
        return errors
    
    # Build mapping from line numbers to entries
    line_to_entry = build_line_to_entry_map(text, lines)
    
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
        has_mixed_indentation = False
        for j, char in enumerate(line):
            if char == '\t':
                leading_tabs += 1
            elif char == ' ':
                # Found space in indentation area - this is an error
                entry_info = line_to_entry.get(i)
                if entry_info:
                    entry_index, entry_name = entry_info
                    if entry_name:
                        errors.append(
                            f"ERROR: Entry #{entry_index} ('{entry_name}'): Line {i} has space character in indentation "
                            f"(position {j+1}): tabs and spaces should not be mixed"
                        )
                    else:
                        errors.append(
                            f"ERROR: Entry #{entry_index}: Line {i} has space character in indentation "
                            f"(position {j+1}): tabs and spaces should not be mixed"
                        )
                else:
                    errors.append(
                        f"ERROR: Line {i} has space character in indentation "
                        f"(position {j+1}): tabs and spaces should not be mixed"
                    )
                has_mixed_indentation = True
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
        
        # Guard against negative depth (malformed JSON structure)
        if expected_depth < 0:
            expected_depth = 0
        
        # Check if indentation matches expected depth (skip if mixed indentation already reported)
        if not has_mixed_indentation and leading_tabs != expected_depth:
            # Get context for error message
            context = stripped[:50] + '...' if len(stripped) > 50 else stripped
            
            # Get entry information if available
            entry_info = line_to_entry.get(i)
            if entry_info:
                entry_index, entry_name = entry_info
                if entry_name:
                    errors.append(
                        f"ERROR: Entry #{entry_index} ('{entry_name}'): Line {i} has incorrect indentation: "
                        f"expected {expected_depth} tab(s), found {leading_tabs} tab(s) - '{context}'"
                    )
                else:
                    errors.append(
                        f"ERROR: Entry #{entry_index}: Line {i} has incorrect indentation: "
                        f"expected {expected_depth} tab(s), found {leading_tabs} tab(s) - '{context}'"
                    )
            else:
                errors.append(
                    f"ERROR: Line {i} has incorrect indentation: "
                    f"expected {expected_depth} tab(s), found {leading_tabs} tab(s) - '{context}'"
                )
        
        # Update depth for next line based on what's on this line
        # We need to properly count braces/brackets, ignoring those in strings
        # Note: This assumes single-line strings (which is the case for this repository)
        line_in_string = in_string
        line_escape_next = escape_next
        open_count = 0
        close_count = 0
        
        for char in stripped:
            if line_escape_next:
                line_escape_next = False
                continue
            
            if char == '\\':
                line_escape_next = True
                continue
            
            if char == '"':
                line_in_string = not line_in_string
                continue
            
            if not line_in_string:
                if char == '{' or char == '[':
                    open_count += 1
                elif char == '}' or char == ']':
                    close_count += 1
        
        # Update the persistent string state for multi-line string support
        in_string = line_in_string
        escape_next = line_escape_next
        
        # Account for same-line open/close (like "[]" or "{}")
        net_change = open_count - close_count
        depth += net_change
        
        # Guard against negative depth
        if depth < 0:
            depth = 0
    
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
        
        # Build line-to-entry map for better error messages
        try:
            data = json.loads(text)
            line_to_entry = build_line_to_entry_map(text, lines)
        except:
            data = None
            line_to_entry = {}
        
        for i, line in enumerate(lines, 1):
            # Skip the final empty line (result of file ending with \n)
            if i == len(lines) and line == '':
                continue
            
            # Check trailing whitespace
            if line.rstrip() != line:
                entry_info = line_to_entry.get(i)
                if entry_info:
                    entry_index, entry_name = entry_info
                    if entry_name:
                        errors.append(f"ERROR: Entry #{entry_index} ('{entry_name}'): Line {i} has trailing whitespace")
                    else:
                        errors.append(f"ERROR: Entry #{entry_index}: Line {i} has trailing whitespace")
                else:
                    errors.append(f"ERROR: Line {i} has trailing whitespace")
            
            # Check for spaces used for indentation (should be tabs)
            if line.startswith(' '):
                entry_info = line_to_entry.get(i)
                if entry_info:
                    entry_index, entry_name = entry_info
                    if entry_name:
                        errors.append(f"ERROR: Entry #{entry_index} ('{entry_name}'): Line {i} uses spaces for indentation (should use tabs)")
                    else:
                        errors.append(f"ERROR: Entry #{entry_index}: Line {i} uses spaces for indentation (should use tabs)")
                else:
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
