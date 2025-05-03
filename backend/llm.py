import time
import json
import boto3
from langchain_aws import ChatBedrock as Bedrock
from config import BEDROCK_INSTRUCTIONS_MODEL_ID, AWS_DEFAULT_REGION, DEBUG_LLM


class TimedBedrock(Bedrock):
    def _prepare_message_dict(self, message_dicts):
        """
        Print the message dictionary as raw JSON to help with token optimization.
        This is useful for seeing exactly what's being sent to the API.
        """
        if DEBUG_LLM:
            raw_request = json.dumps(message_dicts, indent=2)
            print(
                f"\033[38;5;208m=== RAW API REQUEST ===\n{raw_request}\n=============\033[0m"
            )
        return super()._prepare_message_dict(message_dicts)

    def invoke(self, *args, **kwargs):
        # Extract and print the entire prompt including system messages and tools
        if DEBUG_LLM:
            messages = None
            if "messages" in kwargs:
                messages = kwargs["messages"]
            elif args and len(args) > 0 and hasattr(args[0], "messages"):
                messages = args[0].messages

            if messages:
                # Print the entire messages structure in a detailed format
                print(f"\033[38;5;208m=== COMPLETE REQUEST STRUCTURE ===\n")

                # Try to convert LangChain message objects to dictionaries for inspection
                message_dicts = []
                for i, msg in enumerate(messages):
                    print(f"[Message {i+1}]")

                    if hasattr(msg, "to_json"):
                        try:
                            # Use LangChain's serialization if available
                            json_msg = msg.to_json()
                            print(f"Type: {msg.__class__.__name__}")
                            print(f"JSON: {json.dumps(json_msg, indent=2)}")
                            message_dicts.append(json_msg)
                        except Exception as e:
                            print(f"Error serializing: {e}")

                    # Print all attributes (this is a fallback)
                    print("Attributes:")
                    for attr in dir(msg):
                        if not attr.startswith("_") and not callable(
                            getattr(msg, attr)
                        ):
                            try:
                                value = getattr(msg, attr)
                                # For large content, truncate the output
                                if (
                                    attr == "content"
                                    and isinstance(value, str)
                                    and len(value) > 1000
                                ):
                                    value = (
                                        value[:500]
                                        + "... [truncated, total length: "
                                        + str(len(value))
                                        + "]"
                                        + value[-500:]
                                    )
                                print(f"  {attr}: {value}")
                            except Exception as e:
                                print(f"  {attr}: Error retrieving value - {e}")
                    print("")

                print("=============\033[0m")

                # Try to mimic the API request format if possible
                try:
                    if hasattr(self, "_prepare_message_dict"):
                        print(
                            f"\033[38;5;208m=== ATTEMPTING TO GENERATE API REQUEST PREVIEW ===\n"
                        )
                        print(
                            "This may not be exact but should help with token estimation\n"
                        )

                        # Convert message objects to dicts (simplified version of what _prepare_message_dict does)
                        api_messages = []
                        for msg in messages:
                            if hasattr(msg, "to_dict"):
                                try:
                                    api_messages.append(msg.to_dict())
                                except:
                                    pass

                        if api_messages:
                            # This is a simplified approximation of how these get processed for Bedrock
                            bedrock_format = {
                                "anthropic_version": "bedrock-2023-05-31",
                                "max_tokens": 4096,
                                "messages": api_messages,
                            }
                            print(json.dumps(bedrock_format, indent=2))

                        print("=============\033[0m")
                except Exception as e:
                    print(f"Error generating API preview: {e}")

        start_time = time.time()
        result = super().invoke(*args, **kwargs)
        end_time = time.time()

        # Print only the content property of the response and token usage
        if DEBUG_LLM:
            # Extract content
            content = (
                result.content if hasattr(result, "content") else "No content found"
            )

            # Extract token usage
            usage = {}
            if hasattr(result, "usage_metadata"):
                usage = result.usage_metadata
            elif (
                hasattr(result, "response_metadata")
                and "usage" in result.response_metadata
            ):
                usage = result.response_metadata["usage"]
            elif (
                hasattr(result, "additional_kwargs")
                and "usage" in result.additional_kwargs
            ):
                usage = result.additional_kwargs["usage"]

            input_tokens = usage.get("input_tokens", usage.get("prompt_tokens", "N/A"))
            output_tokens = usage.get(
                "output_tokens", usage.get("completion_tokens", "N/A")
            )

            print(
                f"\033[38;5;208m=== RESPONSE CONTENT ===\n{content}\n=============\033[0m"
            )
            print(
                f"\033[38;5;208m=== TOKEN USAGE ===\nInput tokens: {input_tokens}\nOutput tokens: {output_tokens}\n=============\033[0m"
            )
            print(
                f"\033[38;5;208m=== LLM CALL TIME ===\n{end_time - start_time:.2f} seconds\n=============\033[0m"
            )
        else:
            print(f"LLM call time: {end_time - start_time:.2f} seconds")

        return result


def get_bedrock_client(region):
    return boto3.client("bedrock-runtime", region_name=region)


def create_bedrock_llm(client):
    return TimedBedrock(
        model_id=BEDROCK_INSTRUCTIONS_MODEL_ID,
        client=client,
        model_kwargs={"temperature": 0},
        region_name=AWS_DEFAULT_REGION,
    )


llm = create_bedrock_llm(get_bedrock_client(region="us-east-1"))
