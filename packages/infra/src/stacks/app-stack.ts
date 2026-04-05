import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import { Construct } from "constructs";
import { ApiService } from "../constructs/api-service.js";
import { DispatcherService } from "../constructs/dispatcher-service.js";
import { WebSite } from "../constructs/web-site.js";
import { InfraConfig } from "../config.js";
import { SharedResources } from "./shared-stack.js";

export interface AppStackProps extends StackProps {
  readonly config: InfraConfig;
  readonly sharedResources: SharedResources;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const website = new WebSite(this, "WebSite", {
      appName: props.config.appName,
      deployEnv: props.config.deployEnv,
      webAssetPath: props.config.webAssetPath,
      webDomainName: props.config.webDomainName,
      certificateArnUsEast1: props.config.certificateArnUsEast1,
      hostedZoneName: props.config.hostedZoneName,
      isProduction: props.config.isProduction,
    });

    const apiService = new ApiService(this, "ApiService", {
      config: props.config,
      gameStateTableName: props.sharedResources.gameStateTable.tableName,
      commandLogTableName: props.sharedResources.commandLogTable.tableName,
      commandsQueueUrl: props.sharedResources.commandsQueue.queueUrl,
      uploadsBucketName: props.sharedResources.uploadsBucket.bucketName,
      userPoolIssuerUrl: props.sharedResources.userPoolIssuerUrl,
      userPoolClientId: props.sharedResources.userPoolClient.userPoolClientId,
    });

    const dispatcherService = new DispatcherService(this, "DispatcherService", {
      config: props.config,
      commandsQueue: props.sharedResources.commandsQueue,
      gameStateTableName: props.sharedResources.gameStateTable.tableName,
      commandLogTableName: props.sharedResources.commandLogTable.tableName,
    });

    props.sharedResources.gameStateTable.grantReadWriteData(apiService.function);
    props.sharedResources.commandLogTable.grantReadWriteData(apiService.function);
    props.sharedResources.commandsQueue.grantSendMessages(apiService.function);
    props.sharedResources.uploadsBucket.grantReadWrite(apiService.function);

    props.sharedResources.gameStateTable.grantReadWriteData(dispatcherService.function);
    props.sharedResources.commandLogTable.grantReadWriteData(dispatcherService.function);
    props.sharedResources.commandsQueue.grantConsumeMessages(dispatcherService.function);

    new cloudwatch.Alarm(this, "ApiLambdaErrorsAlarm", {
      metric: apiService.function.metricErrors(),
      evaluationPeriods: 1,
      threshold: 1,
    });

    new cloudwatch.Alarm(this, "DispatcherLambdaErrorsAlarm", {
      metric: dispatcherService.function.metricErrors(),
      evaluationPeriods: 1,
      threshold: 1,
    });

    new cloudwatch.Alarm(this, "CommandsDlqVisibleAlarm", {
      metric: props.sharedResources.commandsDlq.metricApproximateNumberOfMessagesVisible(),
      evaluationPeriods: 1,
      threshold: 1,
    });

    new CfnOutput(this, "ApiBaseUrl", { value: apiService.apiUrl });
    new CfnOutput(this, "WebBucketName", { value: website.bucket.bucketName });
    new CfnOutput(this, "WebDistributionId", { value: website.distribution.ref });
    new CfnOutput(this, "WebDistributionDomainName", { value: website.distribution.attrDomainName });
    new CfnOutput(this, "WebUrl", { value: website.siteUrl });
  }
}
