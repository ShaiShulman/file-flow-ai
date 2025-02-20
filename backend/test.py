import boto3
import json
import os

from langchain_aws import ChatBedrock

os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
boto3_bedrock = boto3.client(service_name="bedrock-runtime", region_name="us-east-1")


inference_modifier = {
    "temperature": 0.5,
    "top_k": 250,
    "top_p": 1,
    "stop_sequences": ["\n\nHuman"],
}

bedrock_llm = ChatBedrock(
    model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
    client=boto3_bedrock,
    model_kwargs=inference_modifier,
)

messages = [
    (
        "system",
        "You are a helpful assistant that translates English to French. Translate the user sentence.",
    ),
    ("human", "I love programming."),
]
ai_msg = bedrock_llm.invoke(messages)
print(ai_msg)
