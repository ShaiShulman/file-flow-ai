import uvicorn
import argparse
import os
from typing import Dict, Any

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Agent API server")
    parser.add_argument(
        "--host", type=str, default="0.0.0.0", help="Host to run the server on"
    )
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to run the server on"
    )
    parser.add_argument(
        "--reload", action="store_true", help="Enable auto-reload for development"
    )
    parser.add_argument(
        "--working-dir",
        type=str,
        default=os.getcwd(),
        help="Default working directory for the agent",
    )

    args = parser.parse_args()

    # Update the current working directory if provided
    if args.working_dir:
        os.chdir(args.working_dir)

    print(f"Starting server on {args.host}:{args.port}")
    print(f"Working directory: {os.getcwd()}")

    uvicorn.run("api:app", host=args.host, port=args.port, reload=args.reload)
