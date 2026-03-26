import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { InfraConfig } from "../config.js";

export interface SharedResources {
  readonly gameStateTable: dynamodb.Table;
  readonly commandLogTable: dynamodb.Table;
  readonly commandsQueue: sqs.Queue;
  readonly commandsDlq: sqs.Queue;
  readonly uploadsBucket: s3.Bucket;
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly hostedUiDomainUrl: string;
  readonly userPoolIssuerUrl: string;
}

export interface SharedStackProps extends StackProps {
  readonly config: InfraConfig;
}

export class SharedStack extends Stack {
  public readonly resources: SharedResources;

  constructor(scope: Construct, id: string, props: SharedStackProps) {
    super(scope, id, props);

    const gameStateTable = new dynamodb.Table(this, "GameStateTable", {
      tableName: `${props.config.stackPrefix}-game-state`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      deletionProtection: props.config.isProduction,
      removalPolicy: props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const commandLogTable = new dynamodb.Table(this, "CommandLogTable", {
      tableName: `${props.config.stackPrefix}-command-log`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      deletionProtection: props.config.isProduction,
      removalPolicy: props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const commandsDlq = new sqs.Queue(this, "CommandsDlq", {
      queueName: `${props.config.stackPrefix}-commands-dlq.fifo`,
      fifo: true,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      retentionPeriod: Duration.days(14),
    });
    commandsDlq.applyRemovalPolicy(props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY);

    const commandsQueue = new sqs.Queue(this, "CommandsQueue", {
      queueName: `${props.config.stackPrefix}-commands.fifo`,
      fifo: true,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      visibilityTimeout: Duration.seconds(120),
      deadLetterQueue: { queue: commandsDlq, maxReceiveCount: 5 },
    });
    commandsQueue.applyRemovalPolicy(props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY);

    const uploadsBucket = new s3.Bucket(this, "UploadsBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      autoDeleteObjects: !props.config.isProduction,
      removalPolicy: props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      cors: [
        {
          allowedHeaders: ["*"],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedOrigins: [props.config.webOrigin],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `${props.config.stackPrefix}-users`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 12,
        requireDigits: true,
        requireLowercase: true,
        requireUppercase: true,
        requireSymbols: false,
      },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      removalPolicy: props.config.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient("UserPoolClient", {
      userPoolClientName: `${props.config.stackPrefix}-web-client`,
      generateSecret: false,
      preventUserExistenceErrors: true,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [props.config.webCallbackUrl],
        logoutUrls: [props.config.webLogoutUrl],
      },
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.COGNITO],
    });

    userPool.addDomain("HostedUiDomain", {
      cognitoDomain: { domainPrefix: props.config.cognitoDomainPrefix },
    });

    const hostedUiDomainUrl = `https://${props.config.cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com`;
    const userPoolIssuerUrl = userPool.userPoolProviderUrl;

    this.resources = {
      gameStateTable,
      commandLogTable,
      commandsQueue,
      commandsDlq,
      uploadsBucket,
      userPool,
      userPoolClient,
      hostedUiDomainUrl,
      userPoolIssuerUrl,
    };

    new CfnOutput(this, "GameStateTableName", { value: gameStateTable.tableName });
    new CfnOutput(this, "CommandLogTableName", { value: commandLogTable.tableName });
    new CfnOutput(this, "CommandsQueueUrl", { value: commandsQueue.queueUrl });
    new CfnOutput(this, "CommandsDlqUrl", { value: commandsDlq.queueUrl });
    new CfnOutput(this, "UploadsBucketName", { value: uploadsBucket.bucketName });
    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: userPoolClient.userPoolClientId });
    new CfnOutput(this, "UserPoolIssuerUrl", { value: userPoolIssuerUrl });
    new CfnOutput(this, "HostedUiDomainUrl", { value: hostedUiDomainUrl });
  }
}
