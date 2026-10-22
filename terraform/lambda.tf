# -----------------------------------------------------------------------------
# AWS Lambda - Event-Driven Quantitative Compute Worker
# -----------------------------------------------------------------------------

resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_cloud_policy" {
  name        = "${var.project_name}-lambda-policy"
  description = "IAM policy granting Lambda access to DynamoDB, S3, SQS, SNS, and CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.market_regimes.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.market_data.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = aws_sqs_queue.regime_events.arn
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.regime_alerts.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_cloud_policy.arn
}

# Creates a deployment zip artifact for Lambda
data "archive_file" "lambda_dummy_zip" {
  type        = "zip"
  output_path = "${path.module}/lambda_dist.zip"

  source {
    content  = "def lambda_handler(event, context): return {'statusCode': 200}"
    filename = "worker.py"
  }
}

resource "aws_lambda_function" "regime_worker" {
  function_name = "${var.project_name}-worker"
  role          = aws_iam_role.lambda_exec.arn
  handler       = "worker.lambda_handler"
  runtime       = "python3.11"
  timeout       = 60
  memory_size   = 512

  filename         = data.archive_file.lambda_dummy_zip.output_path
  source_code_hash = data.archive_file.lambda_dummy_zip.output_base64sha256

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = aws_dynamodb_table.market_regimes.name
      S3_BUCKET_NAME      = aws_s3_bucket.market_data.id
      SNS_TOPIC_ARN       = aws_sns_topic.regime_alerts.arn
      SQS_QUEUE_URL       = aws_sqs_queue.regime_events.id
      ENV                 = var.environment
    }
  }
}

# SQS Trigger Mapping for Lambda
resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.regime_events.arn
  function_name    = aws_lambda_function.regime_worker.arn
  batch_size       = 1
  enabled          = true
}
