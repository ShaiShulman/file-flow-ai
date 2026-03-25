"""Integration test for document categorization.

Calls analyze_document directly (bypassing the LangGraph agent) to verify
that categorization returns meaningful results for real files.

Requires:
    - AWS credentials configured for Bedrock access
    - Files from session 0054de47-2562-4f87-a47c-ec4360664d6b in uploads/

Usage:
    cd backend
    python tests/test_categorization_integration.py
"""

import os
import sys
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from text_analysis import analyze_document

# ── Configuration ──

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORKING_DIRECTORY = os.path.join(
    PROJECT_ROOT, "uploads", "extracted_0054de47-2562-4f87-a47c-ec4360664d6b"
)

# Two real files from the last session
TEST_FILES = [
    "14.06.2023 - Amobee Ltd - BoD Resolution re Bank Signatories - signed with Appendix A.pdf",
    "Amobee Israel - Change of Control Letter - 02042024.docx",
]


def run_test():
    """Analyze two real files and verify categorization works."""
    print(f"Working directory: {WORKING_DIRECTORY}")
    assert os.path.isdir(WORKING_DIRECTORY), f"Directory not found: {WORKING_DIRECTORY}"

    all_results = {}

    for i, file_name in enumerate(TEST_FILES):
        full_path = os.path.join(WORKING_DIRECTORY, file_name)
        assert os.path.isfile(full_path), f"File not found: {full_path}"

        print(f"\n{'='*60}")
        print(f"[{i+1}/{len(TEST_FILES)}] Analyzing: {file_name}")
        print(f"{'='*60}")

        # Call analyze_document directly (the underlying function, not the LangChain tool wrapper)
        result = analyze_document.func(
            working_directory=WORKING_DIRECTORY,
            file_path=file_name,
            categorize=True,
            title=True,
            date=True,
            state=None,  # No prior state — fresh analysis
        )

        print(f"\nResult:")
        print(json.dumps(result, indent=2, default=str))

        metadata = result.get("file_metadata", {}).get(file_name, {})
        all_results[file_name] = metadata

        category = metadata.get("category", "MISSING")
        title = metadata.get("title", "MISSING")
        date = metadata.get("date", "MISSING")
        tokens = result.get("total_tokens", 0)

        print(f"\n  Category: {category}")
        print(f"  Title:    {title}")
        print(f"  Date:     {date}")
        print(f"  Tokens:   {tokens}")

    # ── Final summary ──
    print(f"\n{'='*60}")
    print("RESULTS SUMMARY")
    print(f"{'='*60}")

    categorized_count = 0
    for file_name, metadata in all_results.items():
        category = metadata.get("category", "N/A")
        is_categorized = category and category != "N/A"
        status = "OK" if is_categorized else "FAIL"
        if is_categorized:
            categorized_count += 1
        print(f"  [{status}] {file_name}")
        print(f"       category={category}")

    print(f"\n  {categorized_count}/{len(all_results)} files categorized successfully")

    # ── Assertions ──
    assert len(all_results) == len(TEST_FILES), "Not all files were analyzed"
    if categorized_count == 0:
        print("\n  TEST FAILED: All files returned 'N/A' category.")
        print("  The categorization system is not matching documents to categories.")
        sys.exit(1)
    else:
        print("\n  TEST PASSED")


if __name__ == "__main__":
    try:
        run_test()
    except Exception as e:
        print(f"\n  ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
