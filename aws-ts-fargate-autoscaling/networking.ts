import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const vpc = new awsx.ec2.Vpc("vpc", {
    cidrBlock: "10.0.0.0/16",
    numberOfAvailabilityZones: 2,
    subnetSpecs: [{
        type: awsx.ec2.SubnetType.Public,
        name: "public-ecs-fargate-subnet",
    }],
    tags: {
        name: "ecs-fargate-autoscaling"
    },
    natGateways: {
        strategy: "None"
    }
});

const lbSecurityGroup = new aws.ec2.SecurityGroup("lbSg", {
    vpcId: vpc.vpcId,
    ingress: [
    {
        protocol: "tcp",
        fromPort: 80,
        toPort: 80,
        cidrBlocks: ["0.0.0.0/0"]
    }],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"]
    }]
});

const taskSecurityGroup = new aws.ec2.SecurityGroup("taskSg", {
    vpcId: vpc.vpcId,
    ingress: [{
        protocol: "tcp",
        fromPort: 3000,
        toPort: 3000,
        securityGroups: [lbSecurityGroup.id]
    }],
    egress: [{
        protocol: "-1",
        fromPort: 0,
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"]
    }, 
]
});

const lb = new aws.lb.LoadBalancer("lb", {
    securityGroups: [lbSecurityGroup.id],
    subnets: vpc.publicSubnetIds,
    loadBalancerType: "application",
});

const tg = new aws.lb.TargetGroup("tg", {
    port: 3000,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: vpc.vpcId,
    deregistrationDelay: 5,
    healthCheck: {
        enabled: true,
        interval: 30,
        timeout: 5,
        path: "/health",
        healthyThreshold: 5,
        protocol: "HTTP",
        port: "3000"
    }
}, { dependsOn: lb });

const httpListener = new aws.lb.Listener("httpListener", {
    loadBalancerArn: lb.arn,
    port: 80,
    defaultActions: [{
        type: "forward",
        targetGroupArn: tg.arn
    }],
});

export const vpcId = vpc.vpcId;
export const publicSubnetIds = vpc.publicSubnetIds;
export const lbDnsName = lb.dnsName;
export const taskSecurityGroupId = taskSecurityGroup.id;
export const targetGroupArn = tg.arn;