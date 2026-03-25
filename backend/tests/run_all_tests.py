"""Run all file registry tests (unit + live server integration).

Usage:
    py -3 tests/run_all_tests.py              # run from backend/
    py -3 tests/run_all_tests.py --skip-live   # skip live server tests
"""

import subprocess
import sys
import os

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS_DIR = os.path.join(BACKEND_DIR, "tests")
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8000")


def run(label, cmd):
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}\n")
    result = subprocess.run(cmd, cwd=BACKEND_DIR)
    return result.returncode


def main():
    skip_live = "--skip-live" in sys.argv
    results = {}

    # 1. Unit tests: database
    rc = run(
        "Unit Tests: Database (test_database.py)",
        [sys.executable, "-m", "pytest", "tests/test_database.py", "-v"],
    )
    results["test_database.py"] = rc

    # 2. Unit tests: file registry
    rc = run(
        "Unit Tests: File Registry (test_file_registry.py)",
        [sys.executable, "-m", "pytest", "tests/test_file_registry.py", "-v"],
    )
    results["test_file_registry.py"] = rc

    # 3. Live server integration tests
    if skip_live:
        print(f"\n{'='*60}")
        print("  SKIPPED: Live Server Tests (--skip-live)")
        print(f"{'='*60}\n")
        results["test_file_registry_live.py"] = "SKIPPED"
    else:
        # Check if server is reachable first
        import requests
        try:
            r = requests.get(f"{SERVER_URL}/", timeout=3)
            server_ok = r.status_code == 200
        except Exception:
            server_ok = False

        if not server_ok:
            print(f"\n{'='*60}")
            print(f"  SKIPPED: Live Server Tests (server not reachable at {SERVER_URL})")
            print(f"  Start the server with: py -3 server.py")
            print(f"{'='*60}\n")
            results["test_file_registry_live.py"] = "SKIPPED"
        else:
            env = {**os.environ, "SERVER_URL": SERVER_URL}
            rc = run(
                f"Live Server Tests: File Registry ({SERVER_URL})",
                [sys.executable, "-m", "pytest", "tests/test_file_registry_live.py", "-v"],
            )
            results["test_file_registry_live.py"] = rc

    # Summary
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}\n")

    all_passed = True
    for name, rc in results.items():
        if rc == "SKIPPED":
            status = "SKIPPED"
        elif rc == 0:
            status = "PASSED"
        else:
            status = "FAILED"
            all_passed = False
        print(f"  {status:8s}  {name}")

    print()
    if all_passed:
        print("  All tests passed!")
    else:
        print("  Some tests failed.")
    print()

    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
