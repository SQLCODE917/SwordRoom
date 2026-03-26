import { Duration } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambdaEventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { InfraConfig } from "../config.js";

export interface DispatcherServiceProps {
  readonly config: InfraConfig;
  readonly commandsQueue: sqs.IQueue;
  readonly gameStateTableName: string;
  readonly commandLogTableName: string;
}

export class DispatcherService extends Construct {
  public readonly function: nodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: DispatcherServiceProps) {
    super(scope, id);

    this.function = new nodejs.NodejsFunction(this, "DispatcherLambda", {
      entry: `${props.config.repoRoot}/packages/services/dispatcher/src/lambda.ts`,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        target: "node20",
        sourceMap: true,
      },
      depsLockFilePath: `${props.config.repoRoot}/pnpm-lock.yaml`,
      projectRoot: props.config.repoRoot,
      environment: {
        GAMESTATE_TABLE: props.gameStateTableName,
        COMMANDLOG_TABLE: props.commandLogTableName,
        COMMANDS_QUEUE_URL: props.commandsQueue.queueUrl,
      },
    });

    this.function.addEventSource(
      new lambdaEventSources.SqsEventSource(props.commandsQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      })
    );
  }
}
