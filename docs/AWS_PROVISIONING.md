# Provisioning the OceanEmbed SageMaker Endpoint

This repository includes `infra/aws/sagemaker-serverless.yaml`, a parameterized CloudFormation template for the **actual production inference endpoint**. It prevents hard-coded AWS account IDs, image URIs, model locations, credentials, or regions from entering source control.

The model image must accept a documented scene payload and return the 15 standard depth values, per-depth calibrated uncertainty, model version, input provenance, confidence, risk, and `fallbackMode`. The endpoint must never release an autonomous heat-fuel classification when the guardrail requires human review.

## Required AWS inputs

| Input | Source | Vercel variable after deployment |
|---|---|---|
| Evaluated inference image | Your ECR repository | Not stored on Vercel. |
| Immutable `model.tar.gz` | Approved versioned S3 prefix | Not stored on Vercel. |
| Least-privilege SageMaker execution role | IAM | Not stored on Vercel. |
| CloudFormation endpoint output | `SageMakerEndpointName` output | `AWS_SAGEMAKER_ENDPOINT` |
| Endpoint Region | Region selected for the stack | `AWS_REGION` |

## Deploy command

After pushing the image to ECR and placing the immutable model artifact in S3, deploy the template from an AWS-authenticated terminal:

```bash
aws cloudformation deploy \
  --stack-name oceanembed-inference \
  --template-file infra/aws/sagemaker-serverless.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    EndpointName=oceanembed-profile-reconstruction \
    ModelImageUri=ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/oceanembed-inference:MODEL_VERSION \
    ModelDataUrl=s3://OCEANEMBED_ARTIFACT_BUCKET/models/MODEL_VERSION/model.tar.gz \
    SageMakerExecutionRoleArn=arn:aws:iam::ACCOUNT_ID:role/OceanEmbedSageMakerExecutionRole
```

Copy the `SageMakerEndpointName` output into Vercel as `AWS_SAGEMAKER_ENDPOINT`. Configure Vercel’s runtime role/credentials with only `sagemaker:InvokeEndpoint` for the endpoint ARN and restricted access to the exact artifact prefix. Add the Vercel worker callback URL and a high-entropy shared secret as `AWS_WORKER_DISPATCH_URL` and `AWS_WORKER_DISPATCH_SECRET`.

> Do not mark the endpoint as `ready` in `pipeline_configs` until a real scene successfully returns the required payload, immutable evidence bundle, and QA trace. This preserves OceanEmbed’s conservative fallback behavior.

SageMaker Serverless Inference is a better fit than a Lambda-hosted model for the intended bursty, request-driven inference path, but memory and latency must still be benchmarked against the real model.[1]

## Reference

[1]: https://docs.aws.amazon.com/sagemaker/latest/dg/serverless-endpoints.html "Amazon SageMaker Serverless Inference"
