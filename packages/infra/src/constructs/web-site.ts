import { RemovalPolicy, Size, Stack } from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as iam from "aws-cdk-lib/aws-iam";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

export interface WebSiteProps {
  readonly appName: string;
  readonly deployEnv: string;
  readonly webAssetPath: string;
  readonly webDomainName: string;
  readonly certificateArnUsEast1?: string;
  readonly hostedZoneName?: string;
  readonly isProduction: boolean;
}

export class WebSite extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.CfnDistribution;
  public readonly siteUrl: string;

  constructor(scope: Construct, id: string, props: WebSiteProps) {
    super(scope, id);

    this.bucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      autoDeleteObjects: !props.isProduction,
      removalPolicy: props.isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      versioned: true,
    });

    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, "WebOriginAccessControl", {
      originAccessControlConfig: {
        name: `${props.appName}-${props.deployEnv}-web-oac`,
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });

    const distributionConfig: cloudfront.CfnDistribution.DistributionConfigProperty = {
      enabled: true,
      defaultRootObject: "index.html",
      httpVersion: "http2",
      origins: [
        {
          id: "web-bucket-origin",
          domainName: this.bucket.bucketRegionalDomainName,
          originAccessControlId: originAccessControl.attrId,
          s3OriginConfig: { originAccessIdentity: "" },
        },
      ],
      defaultCacheBehavior: {
        targetOriginId: "web-bucket-origin",
        viewerProtocolPolicy: "redirect-to-https",
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        compress: true,
        cachePolicyId: cloudfront.CachePolicy.CACHING_OPTIMIZED.cachePolicyId,
      },
      customErrorResponses: [
        { errorCode: 403, responseCode: 200, responsePagePath: "/index.html", errorCachingMinTtl: 0 },
        { errorCode: 404, responseCode: 200, responsePagePath: "/index.html", errorCachingMinTtl: 0 },
      ],
      priceClass: "PriceClass_100",
      ...(props.certificateArnUsEast1
        ? {
            aliases: [props.webDomainName],
            viewerCertificate: {
              acmCertificateArn: props.certificateArnUsEast1,
              sslSupportMethod: "sni-only",
              minimumProtocolVersion: "TLSv1.2_2021",
            },
          }
        : {}),
    };


    this.distribution = new cloudfront.CfnDistribution(this, "WebDistribution", {
      distributionConfig,
    });

    if (props.certificateArnUsEast1 && props.hostedZoneName) {
      const hostedZoneName = ensureTrailingDot(props.hostedZoneName);

      new route53.CfnRecordSet(this, "WebAliasARecord", {
        hostedZoneName,
        name: props.webDomainName,
        type: "A",
        aliasTarget: {
          dnsName: this.distribution.attrDomainName,
          hostedZoneId: "Z2FDTNDATAQYW2",
          evaluateTargetHealth: false,
        },
      });

      new route53.CfnRecordSet(this, "WebAliasAaaaRecord", {
        hostedZoneName,
        name: props.webDomainName,
        type: "AAAA",
        aliasTarget: {
          dnsName: this.distribution.attrDomainName,
          hostedZoneId: "Z2FDTNDATAQYW2",
          evaluateTargetHealth: false,
        },
      });
    }

    this.bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AllowCloudFrontServicePrincipalReadOnly",
        actions: ["s3:GetObject"],
        resources: [this.bucket.arnForObjects("*")],
        principals: [new iam.ServicePrincipal("cloudfront.amazonaws.com")],
        conditions: {
          StringEquals: {
            "AWS:SourceArn": `arn:${Stack.of(this).partition}:cloudfront::${Stack.of(this).account}:distribution/${this.distribution.ref}`
          },
        },
      })
    );

    new s3deploy.BucketDeployment(this, "BootstrapWebAssets", {
      destinationBucket: this.bucket,
      sources: [s3deploy.Source.asset(props.webAssetPath)],
      prune: true,
      retainOnDelete: props.isProduction,
      memoryLimit: 512,
      ephemeralStorageSize: Size.mebibytes(512),
    });

    this.siteUrl = props.certificateArnUsEast1
      ? `https://${props.webDomainName}`
      : `https://${this.distribution.attrDomainName}`;
  }
}

function ensureTrailingDot(value: string): string {
  const trimmed = value.trim();
  if (trimmed.endsWith(".")) {
    return trimmed;
  }
  return `${trimmed}.`;
}
