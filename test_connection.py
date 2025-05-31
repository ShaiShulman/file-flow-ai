#!/usr/bin/env python3
"""
Simple test script to verify the backend API is working correctly.
Run this after starting the backend server to test the connection.
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_health_check():
    """Test the health check endpoint."""
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Health Check: {response.status_code} - {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Health Check Failed: {e}")
        return False


def test_session_creation():
    """Test session creation."""
    try:
        # Create a session
        session_data = {"working_directory": "/test"}
        response = requests.post(f"{BASE_URL}/sessions", json=session_data)
        print(f"Session Creation: {response.status_code} - {response.json()}")

        if response.status_code == 200:
            session_id = response.json()["session_id"]
            print(f"Created session: {session_id}")
            return session_id
        return None
    except Exception as e:
        print(f"Session Creation Failed: {e}")
        return None


def test_categories():
    """Test category operations."""
    try:
        # Test getting categories (should be empty initially)
        response = requests.get(f"{BASE_URL}/categories")
        print(f"Get Categories: {response.status_code} - {response.json()}")

        # Test resetting categories
        test_categories = {
            "Document Type": ["Contract", "Invoice", "Report"],
            "Priority": ["High", "Medium", "Low"],
        }
        response = requests.put(f"{BASE_URL}/categories/reset", json=test_categories)
        print(f"Reset Categories: {response.status_code} - {response.json()}")

        # Test getting categories again
        response = requests.get(f"{BASE_URL}/categories")
        print(f"Get Categories After Reset: {response.status_code} - {response.json()}")

        return True
    except Exception as e:
        print(f"Categories Test Failed: {e}")
        return False


def test_agent_message(session_id):
    """Test sending a message to the agent."""
    if not session_id:
        print("No session ID available for agent test")
        return False

    try:
        message_data = {
            "message": "Hello, can you help me organize my files?",
            "working_directory": "/test",
        }
        response = requests.post(
            f"{BASE_URL}/sessions/{session_id}/run", json=message_data
        )
        print(f"Agent Message: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"Agent Response: {result.get('message', 'No message')}")
            print(
                f"Tokens Used: {result.get('analysis_tokens', 0) + result.get('instruction_tokens', 0)}"
            )
            return True
        else:
            print(f"Agent Message Failed: {response.text}")
            return False
    except Exception as e:
        print(f"Agent Message Test Failed: {e}")
        return False


def main():
    """Run all tests."""
    print("Testing Backend API Connection...")
    print("=" * 50)

    # Test health check
    if not test_health_check():
        print("❌ Backend server is not running or not accessible")
        return

    print("✅ Backend server is running")

    # Test session creation
    session_id = test_session_creation()
    if session_id:
        print("✅ Session creation works")
    else:
        print("❌ Session creation failed")

    # Test categories
    if test_categories():
        print("✅ Categories API works")
    else:
        print("❌ Categories API failed")

    # Test agent message
    if test_agent_message(session_id):
        print("✅ Agent messaging works")
    else:
        print("❌ Agent messaging failed")

    print("=" * 50)
    print("Backend API testing complete!")


if __name__ == "__main__":
    main()
