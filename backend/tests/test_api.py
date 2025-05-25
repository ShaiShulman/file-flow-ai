import requests
import json
import argparse
import os
from typing import Dict, Any, List


class AgentAPIClient:
    """Client for interacting with the Agent API."""

    def __init__(self, base_url: str = "http://localhost:8000"):
        """Initialize the API client.

        Args:
            base_url (str): The base URL of the API
        """
        self.base_url = base_url
        self.session_id = None

    def health_check(self) -> Dict[str, Any]:
        """Check if the API is running.

        Returns:
            Dict[str, Any]: The response from the health check endpoint
        """
        response = requests.get(f"{self.base_url}/")
        response.raise_for_status()
        return response.json()

    def create_session(
        self, working_directory: str = None, session_id: str = None
    ) -> str:
        """Create a new agent session.

        Args:
            working_directory (str, optional): Custom working directory for the agent
            session_id (str, optional): Specific session ID to use instead of generating a new one

        Returns:
            str: The session ID
        """
        params = {}
        if working_directory:
            params["working_directory"] = working_directory
        if session_id:
            params["session_id"] = session_id

        response = requests.post(f"{self.base_url}/sessions", params=params)
        response.raise_for_status()
        result = response.json()
        self.session_id = result["session_id"]
        return self.session_id

    def create_session_with_id(
        self, session_id: str, working_directory: str = None
    ) -> str:
        """Create a new agent session with a specific ID.

        Args:
            session_id (str): The specific session ID to create
            working_directory (str, optional): Custom working directory for the agent

        Returns:
            str: The session ID
        """
        params = {}
        if working_directory:
            params["working_directory"] = working_directory

        response = requests.post(
            f"{self.base_url}/sessions/{session_id}", params=params
        )
        response.raise_for_status()
        result = response.json()
        self.session_id = result["session_id"]
        return self.session_id

    def run_agent(
        self, message: str, working_directory: str = None, session_id: str = None
    ) -> Dict[str, Any]:
        """Run the agent with the given input.

        Args:
            message (str): The user's input to process
            working_directory (str, optional): Custom working directory for this run
            session_id (str, optional): The session ID to use (defaults to current session)

        Returns:
            Dict[str, Any]: The response from the agent
        """
        sid = session_id or self.session_id
        if not sid:
            sid = self.create_session(working_directory)

        payload = {"message": message}
        if working_directory:
            payload["working_directory"] = working_directory

        response = requests.post(f"{self.base_url}/sessions/{sid}/run", json=payload)
        response.raise_for_status()
        return response.json()

    def delete_session(self, session_id: str = None) -> bool:
        """Delete an agent session.

        Args:
            session_id (str, optional): The session ID to delete (defaults to current session)

        Returns:
            bool: True if session was deleted successfully
        """
        sid = session_id or self.session_id
        if not sid:
            return False

        response = requests.delete(f"{self.base_url}/sessions/{sid}")
        response.raise_for_status()
        result = response.json()

        if self.session_id == sid:
            self.session_id = None

        return result.get("success", False)

    def list_sessions(self) -> list:
        """List all active session IDs.

        Returns:
            list: List of active session IDs
        """
        response = requests.get(f"{self.base_url}/sessions")
        response.raise_for_status()
        return response.json()

    def get_categories(self) -> Dict[str, List[str]]:
        """Get all categories.

        Returns:
            Dict[str, List[str]]: Dictionary of categories and their values
        """
        response = requests.get(f"{self.base_url}/categories")
        response.raise_for_status()
        return response.json()

    def get_category(self, name: str) -> Dict[str, Any]:
        """Get a specific category.

        Args:
            name (str): The name of the category

        Returns:
            Dict[str, Any]: The category status and values
        """
        response = requests.get(f"{self.base_url}/categories/{name}")
        response.raise_for_status()
        return response.json()

    def add_or_update_category(self, name: str, values: List[str]) -> Dict[str, str]:
        """Add or update a category.

        Args:
            name (str): The name of the category
            values (List[str]): The values for the category

        Returns:
            Dict[str, str]: The operation result
        """
        response = requests.post(f"{self.base_url}/categories/{name}", json=values)
        response.raise_for_status()
        return response.json()

    def delete_category(self, name: str) -> Dict[str, str]:
        """Delete a category.

        Args:
            name (str): The name of the category

        Returns:
            Dict[str, str]: The operation result
        """
        response = requests.delete(f"{self.base_url}/categories/{name}")
        response.raise_for_status()
        return response.json()

    def clear_categories(self) -> Dict[str, str]:
        """Clear all categories.

        Returns:
            Dict[str, str]: The operation result
        """
        response = requests.delete(f"{self.base_url}/categories")
        response.raise_for_status()
        return response.json()

    def get_token_stats(self, session_id: str = None) -> Dict[str, int]:
        """Get token usage statistics for a specific session.

        Args:
            session_id (str, optional): The session ID to get stats for (defaults to current session)

        Returns:
            Dict[str, int]: Dictionary containing total analysis and instruction tokens
        """
        sid = session_id or self.session_id
        if not sid:
            raise ValueError("No session ID provided and no active session")

        response = requests.get(f"{self.base_url}/stats/tokens/{sid}")
        response.raise_for_status()
        return response.json()


def run_interactive_session(
    client: AgentAPIClient, working_directory: str = None, session_id: str = None
):
    """Run an interactive session with the Agent API.

    Args:
        client (AgentAPIClient): The API client to use
        working_directory (str, optional): Custom working directory for the agent
        session_id (str, optional): Existing session ID to use instead of creating a new one
    """
    print("\nWelcome to the Agent API interactive session!")
    print("Type 'help' for available commands, 'exit' to quit.")
    print("Any other input will be sent directly to the agent.\n")

    # Use existing session or create a new one
    if session_id:
        print(f"Attempting to use existing session: {session_id}")
        client.session_id = session_id

        # Verify session exists
        try:
            sessions = client.list_sessions()
            if session_id not in sessions:
                print(f"Session {session_id} was not found in active sessions list")
                print(f"Available sessions: {sessions}")
                print(f"Creating a new session with ID: {session_id}")

                # Create a new session with the specific ID
                try:
                    created_session_id = client.create_session_with_id(
                        session_id, working_directory
                    )
                    print(f"Created new session: {created_session_id}")
                    if working_directory:
                        print(f"Using working directory: {working_directory}")
                except Exception as create_error:
                    print(
                        f"Error creating session with ID {session_id}: {str(create_error)}"
                    )
                    print("Creating a new session with auto-generated ID instead...")
                    session_id = client.create_session(working_directory)
                    print(f"Created new session: {session_id}")
                    if working_directory:
                        print(f"Using working directory: {working_directory}")
            else:
                print(f"Session verified in active sessions: {sessions}")
        except Exception as e:
            print(f"Error verifying session: {str(e)}")
            print(f"Creating a new session with ID: {session_id}")

            # Create a new session with the specific ID
            try:
                created_session_id = client.create_session_with_id(
                    session_id, working_directory
                )
                print(f"Created new session: {created_session_id}")
                if working_directory:
                    print(f"Using working directory: {working_directory}")
            except Exception as create_error:
                print(
                    f"Error creating session with ID {session_id}: {str(create_error)}"
                )
                print("Please make sure the server is running at:", client.base_url)
                return
    else:
        # Automatically create a session
        try:
            session_id = client.create_session(working_directory)
            print(f"Created session: {session_id}")
            if working_directory:
                print(f"Using working directory: {working_directory}")

            # Verify session was created
            sessions = client.list_sessions()
            if session_id not in sessions:
                print("Warning: Session was not found in active sessions list")
            else:
                print(f"Session verified in active sessions: {sessions}")
        except Exception as e:
            print(f"Error creating initial session: {str(e)}")
            print("Please make sure the server is running at:", client.base_url)
            return

    while True:
        try:
            # Get user input
            command = input("> ").strip()

            if not command:
                continue

            # Parse command and arguments
            parts = command.split()
            cmd = parts[0].lower()
            args = parts[1:]

            # Handle commands
            if cmd == "exit":
                print("Goodbye!")
                break

            elif cmd == "help":
                print("\nAvailable commands:")
                print(
                    "  create_session [working_directory] - Create a new agent session"
                )
                print("  list_categories                   - List all categories")
                print("  add_category <name> <values...>   - Add or update a category")
                print("  delete_category <name>            - Delete a category")
                print("  token_stats [session_id]          - Get token statistics")
                print("  help                              - Show this help message")
                print(
                    "  exit                              - Exit the interactive session"
                )
                print(f"\nCurrent session ID: {session_id}")
                print("Note: Any other input will be sent directly to the agent.")
                print(
                    "Tip: Use --session <session_id> when starting to reuse an existing session."
                )

            elif cmd == "create_session":
                working_dir = args[0] if args else None
                print(f"Creating new session with working directory: {working_dir}")
                session_id = client.create_session(working_dir)
                print(f"Created session: {session_id}")

                # Verify session was created
                sessions = client.list_sessions()
                if session_id not in sessions:
                    print("Warning: Session was not found in active sessions list")
                else:
                    print(f"Session verified in active sessions: {sessions}")

            elif cmd == "list_categories":
                try:
                    categories = client.get_categories()
                    print("\nCategories:")
                    print(json.dumps(categories, indent=2))
                except Exception as e:
                    print(f"Error listing categories: {str(e)}")

            elif cmd == "add_category":
                if len(args) < 2:
                    print("Usage: add_category <name> <value1> <value2> ...")
                    continue

                name = args[0]
                values = args[1:]
                try:
                    result = client.add_or_update_category(name, values)
                    print(f"Category operation result: {json.dumps(result, indent=2)}")
                except Exception as e:
                    print(f"Error adding category: {str(e)}")

            elif cmd == "delete_category":
                if not args:
                    print("Usage: delete_category <name>")
                    continue

                try:
                    result = client.delete_category(args[0])
                    print(f"Delete result: {json.dumps(result, indent=2)}")
                except Exception as e:
                    print(f"Error deleting category: {str(e)}")

            elif cmd == "token_stats":
                target_session = args[0] if args else session_id
                if not target_session:
                    print(
                        "No active session. Create one first with create_session or specify a session ID."
                    )
                    continue

                try:
                    stats = client.get_token_stats(target_session)
                    print(f"\nToken Statistics for session {target_session}:")
                    print(json.dumps(stats, indent=2))
                except Exception as e:
                    print(f"Error getting token stats: {str(e)}")

            else:
                # If not a recognized command, treat as a message to the agent
                try:
                    result = client.run_agent(command, session_id=session_id)

                    if not result:
                        print("Warning: Received empty response from server")
                        continue

                    # Display response
                    print("\nAgent Response:")
                    print(f"Message: {result.get('message', 'No message')}")
                    print(
                        f"Working Directory: {result.get('working_directory', 'Not set')}"
                    )
                    print(
                        f"Affected Files: {json.dumps(result.get('affected_files', []), indent=2)}"
                    )

                    # Display token statistics
                    print("\nToken Statistics:")
                    print(f"Analysis Tokens: {result.get('analysis_tokens', 0)}")
                    print(f"Instruction Tokens: {result.get('instruction_tokens', 0)}")
                    print(
                        f"Total Tokens: {result.get('analysis_tokens', 0) + result.get('instruction_tokens', 0)}"
                    )

                    # Display other response data
                    print("\nActions:")
                    print(json.dumps(result.get("actions", []), indent=2))
                    print("\nFile Metadata:")
                    print(json.dumps(result.get("file_metadata", {}), indent=2))
                    print("\nCategories:")
                    print(json.dumps(result.get("categories", {}), indent=2))

                except requests.exceptions.ConnectionError:
                    print(f"\nError: Could not connect to server at {client.base_url}")
                    print("Please make sure the server is running.")
                except Exception as e:
                    print(f"\nError running agent: {str(e)}")
                    print("Full error details:", str(e.__class__.__name__))

        except KeyboardInterrupt:
            print("\nExiting...")
            break
        except Exception as e:
            print(f"Error: {str(e)}")


def run_test(base_url: str, working_directory: str = None):
    """Run a simple test of the Agent API.

    Args:
        base_url (str): The base URL of the API
        working_directory (str, optional): Custom working directory for the agent
    """
    client = AgentAPIClient(base_url)

    # Test health check
    print("\nTesting health check...")
    health = client.health_check()
    print(f"Health check response: {json.dumps(health, indent=2)}")

    # Test session creation
    print("\nTesting session creation...")
    session_id = client.create_session(working_directory)
    print(f"Created session: {session_id}")

    # Test listing sessions
    print("\nTesting session listing...")
    sessions = client.list_sessions()
    print(f"Active sessions: {sessions}")

    # Test agent run
    print("\nTesting agent run...")
    test_message = "Tell me what files are in the current directory"
    print(f"Sending message: '{test_message}'")
    result = client.run_agent(test_message)
    print(f"Agent response: {json.dumps(result, indent=2)}")

    # Test session deletion
    print("\nTesting session deletion...")
    deleted = client.delete_session()
    print(f"Session deleted: {deleted}")

    # Verify session was deleted
    sessions = client.list_sessions()
    print(f"Remaining sessions: {sessions}")

    # Test categories API
    print("\nTesting categories API...")

    # Test getting all categories
    print("Getting all categories...")
    categories = client.get_categories()
    print(f"Current categories: {json.dumps(categories, indent=2)}")

    # Test adding a new category
    print("Adding a new category...")
    test_category = "TestCategory"
    test_values = ["test1", "test2", "test3"]
    add_result = client.add_or_update_category(test_category, test_values)
    print(f"Add result: {json.dumps(add_result, indent=2)}")

    # Test getting a specific category
    print("Getting the test category...")
    category = client.get_category(test_category)
    print(f"Category values: {json.dumps(category, indent=2)}")

    # Test updating a category
    print("Updating the test category...")
    updated_values = ["updated1", "updated2"]
    update_result = client.add_or_update_category(test_category, updated_values)
    print(f"Update result: {json.dumps(update_result, indent=2)}")

    # Test deleting a category
    print("Deleting the test category...")
    delete_result = client.delete_category(test_category)
    print(f"Delete result: {json.dumps(delete_result, indent=2)}")

    print("\nTest completed successfully!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the Agent API")
    parser.add_argument(
        "--url", type=str, default="http://localhost:8000", help="Base URL of the API"
    )
    parser.add_argument(
        "--working-dir", type=str, default=None, help="Working directory for the agent"
    )
    parser.add_argument(
        "--session", type=str, default=None, help="Existing session ID to use"
    )
    parser.add_argument(
        "--interactive", action="store_true", help="Start an interactive session"
    )

    args = parser.parse_args()

    if args.interactive:
        try:
            # Test server connection first
            client = AgentAPIClient(args.url)
            health = client.health_check()
            print(f"Connected to server at {args.url}")
            print(f"Server status: {health}")

            # Start interactive session
            run_interactive_session(client, args.working_dir, args.session)
        except requests.exceptions.ConnectionError:
            print(f"Error: Could not connect to server at {args.url}")
            print(
                "Please make sure the server is running before starting the interactive session."
            )
        except Exception as e:
            print(f"Error starting interactive session: {str(e)}")
    else:
        run_test(args.url, args.working_dir)
