import time
import boto3
from langchain_aws import ChatBedrock as Bedrock
from config import BEDROCK_INSTRUCTIONS_MODEL_ID, AWS_DEFAULT_REGION


class TimedBedrock(Bedrock):
    def invoke(self, *args, **kwargs):
        start_time = time.time()
        result = super().invoke(*args, **kwargs)
        end_time = time.time()
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
