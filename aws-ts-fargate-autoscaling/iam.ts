import * as aws from "@pulumi/aws";

const scalingPolicy = new aws.iam.Policy("fargate-autoscalingpolicy", { // from https://docs.aws.amazon.com/AmazonECS/latest/developerguide/service-auto-scaling.html#auto-scaling-IAM
    policy: aws.iam.getPolicyDocumentOutput({
        statements: [{
            effect: "Allow",
            actions: [
                "application-autoscaling:*",
                "ecs:DescribeServices",
                "ecs:UpdateService",
                "cloudwatch:DescribeAlarms",
                "cloudwatch:PutMetricAlarm",
                "cloudwatch:DeleteAlarms",
                "cloudwatch:DescribeAlarmHistory",
                "cloudwatch:DescribeAlarmsForMetric",
                "cloudwatch:GetMetricStatistics",
                "cloudwatch:ListMetrics",
                "cloudwatch:DisableAlarmActions",
                "cloudwatch:EnableAlarmActions",
                "iam:CreateServiceLinkedRole",
                "sns:CreateTopic",
                "sns:Subscribe",
                "sns:Get*",
                "sns:List*"
            ],
            resources: ["*"]
        }]
    }).json
});

const role = new aws.iam.Role("fargate-role", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal(aws.iam.Principals.EcsTasksPrincipal),
    managedPolicyArns: [aws.iam.ManagedPolicy.AmazonECSTaskExecutionRolePolicy]
});

const roleAttachment = new aws.iam.RolePolicyAttachment("scalingRpa", {
    role: role,
    policyArn: scalingPolicy.arn
});

export const fargateRoleArn = role.arn;