# Auto-scaling a dockerized app using ECS, ECR, and Fargate

This example uses the AWS Classic provider to build, deploy and run a containerized application complete with autoscaling policies.

To do this, we use Pulumi infrastructure as code to provision an
[Elastic Container Service (ECS)](https://aws.amazon.com/ecs/) cluster, build our `Dockerfile` and deploy the
resulting image to a private [Elastic Container Registry (ECR)](https://aws.amazon.com/ecr/) repository, and then create
a scaled-out [Fargate](https://aws.amazon.com/fargate/) service behind an
[Elastic Application Load Balancer](https://aws.amazon.com/elasticloadbalancing/) that allows traffic from the Internet
on port 80. Because this example using AWS services directly, you can mix in other resources, like S3 buckets, RDS
databases, and so on.

## Prerequisites

- [Node.js](https://nodejs.org/en/download/)
- [Docker](https://docker.com)
- [Download and install the Pulumi CLI](https://www.pulumi.com/docs/get-started/install/)
- [Connect Pulumi with your AWS account](https://www.pulumi.com/docs/intro/cloud-providers/aws/setup/) (if your AWS CLI is configured, no further changes are required)

## Running the Example

After cloning this repo, `cd` into it and run these commands:

1. Create a new stack, which is an isolated deployment target for this example:

    ```bash
    $ pulumi stack init dev
    ```

2. Set your desired AWS region:

    ```bash
    $ pulumi config set aws:region us-east-1 # any valid AWS region will work
    ```

3. Deploy everything with a single `pulumi up` command. This will show you a preview of changes first, which
   includes all of the required AWS resources (clusters, services, and the like). Don't worry if it's more than
   you expected -- this is one of the benefits of Pulumi, it configures everything so that so you don't need to!

    ```bash
    $ pulumi up
    ```

    After being prompted and selecting "yes", your deployment will begin. It'll complete in a few minutes:

    ```
    Updating (dev)

    View Live: https://app.pulumi.com/pierskarsenbarg/aws-ts-fargate-autoscaling/dev/updates/9

        Type                                          Name                             Status     
    +   pulumi:pulumi:Stack                           aws-ts-fargate-autoscaling-dev   created (21
    +   ├─ awsx:ecr:Repository                        repo                             created (9s
    +   │  ├─ aws:ecr:Repository                      repo                             created (0.
    +   │  └─ aws:ecr:LifecyclePolicy                 repo                             created (0.
    +   ├─ aws:cloudwatch:LogGroup                    fargate-loggroup                 created (0.
    +   ├─ aws:iam:Role                               fargate-role                     created (2s
    +   ├─ aws:ecs:Cluster                            fargate-autoscaling              created (11
    +   ├─ aws:iam:Policy                             fargate-autoscalingpolicy        created (0.
    +   ├─ aws:iam:RolePolicyAttachment               scalingRpa                       created (0.
    +   ├─ awsx:ec2:Vpc                               vpc                              created (0.
    +   │  └─ aws:ec2:Vpc                             vpc                              created (1s
    +   │     ├─ aws:ec2:Subnet                       vpc-public-ecs-fargate-subnet-2  created (11
    +   │     │  └─ aws:ec2:RouteTable                vpc-public-ecs-fargate-subnet-2  created (0.
    +   │     │     ├─ aws:ec2:RouteTableAssociation  vpc-public-ecs-fargate-subnet-2  created (0.
    +   │     │     └─ aws:ec2:Route                  vpc-public-ecs-fargate-subnet-2  created (1s
    +   │     ├─ aws:ec2:Subnet                       vpc-public-ecs-fargate-subnet-1  created (11
    +   │     │  └─ aws:ec2:RouteTable                vpc-public-ecs-fargate-subnet-1  created (0.
    +   │     │     ├─ aws:ec2:RouteTableAssociation  vpc-public-ecs-fargate-subnet-1  created (1.
    +   │     │     └─ aws:ec2:Route                  vpc-public-ecs-fargate-subnet-1  created (1s
    +   │     └─ aws:ec2:InternetGateway              vpc                              created (1s
    +   ├─ awsx:ecr:Image                             app-image                        created (0.
    +   ├─ aws:ec2:SecurityGroup                      lbSg                             created (2s
    +   ├─ aws:lb:LoadBalancer                        lb                               created (18
    +   ├─ aws:ec2:SecurityGroup                      taskSg                           created (2s
    +   ├─ aws:ecs:TaskDefinition                     appdemoTd                        created (0.
    +   ├─ aws:lb:TargetGroup                         tg                               created (1s
    +   ├─ aws:lb:Listener                            httpListener                     created (0.
    +   ├─ aws:ecs:Service                            appdemoService                   created (1s
    +   ├─ aws:appautoscaling:Target                  appScalingTarget                 created (0.
    +   ├─ aws:appautoscaling:Policy                  cpuASPolicy                      created (0.
    +   └─ aws:appautoscaling:Policy                  memoryASPolicy                   created (0.


    Diagnostics:
    awsx:ecr:Image (app-image):
        warning: #1 [internal] load build definition from Dockerfile
        #1 sha256:2b8c5ad08d81959712c05acbb2b3486d3b7486b8d5589d6a7f67da4d66f29855
        #1 transferring dockerfile: 36B 0.0s done
        #1 DONE 0.1s
        
        #2 [internal] load .dockerignore
        #2 sha256:13b76c648ad84f16c977c6e2949af93bc1cd3b868572bdb68c44e93807f7fd3b
        #2 transferring context: 2B done
        #2 DONE 0.0s
        
        #3 [internal] load metadata for docker.io/library/node:19-alpine3.16
        #3 sha256:6a86262cebe690426b7a608ec22f965bbf82adf173d7614998ff539ce59dffb2
        #3 ...
        
        #4 [auth] library/node:pull token for registry-1.docker.io
        #4 sha256:2385fd70cfed61925c827cf94e5dd15faced90d568434ba25fe44dda39077799
        #4 DONE 0.0s
        
        #3 [internal] load metadata for docker.io/library/node:19-alpine3.16
        #3 sha256:6a86262cebe690426b7a608ec22f965bbf82adf173d7614998ff539ce59dffb2
        #3 DONE 1.3s
        
        #5 [1/5] FROM docker.io/library/node:19-alpine3.16@sha256:a48288382fd9a756af6512347e452e7ea6d3dfd0e3279a65e88f90f24648c4c1
        #5 sha256:279523bf0952d78f3aa7a5571fc28a67dc0449fcee0106e885ae3e7899269074
        #5 DONE 0.0s
        
        #7 [internal] load build context
        #7 sha256:81ae02843b401cd718b9b66b4b8618f6995f55d4ecae375a005d59aa586c28fb
        #7 transferring context: 100B done
        #7 DONE 0.0s
        
        #6 [2/5] WORKDIR /app
        #6 sha256:390c644581d6458498afea4f94af437e3be5d7dbbc60e5127fa37e822407aeec
        #6 CACHED
        
        #8 [3/5] COPY package*.json .
        #8 sha256:a4e0a17a9f6da54b574b7ef8899e9a6ecbb1d7802088cc1e1dd1a9f38dab3957
        #8 CACHED
        
        #9 [4/5] RUN npm ci
        #9 sha256:9060834877843666a50ffd7479400425f73332a84d5d02483b011b24fa13a179
        #9 CACHED
        
        #10 [5/5] COPY index.js .
        #10 sha256:7e35c3665d4599873e65eeda1ec94d755a469c21b105ff33ce8d6d7de07bb907
        #10 CACHED
        
        #11 exporting to image
        #11 sha256:e8c613e07b0b7ff33893b694f7759a10d42e180f2b4dc349fb57dc6b71dcab00
        #11 exporting layers done
        #11 writing image sha256:6f87465290a3728a5cd01826e993d125a0aa463d34e2e579f42b71e496c6f557 0.0s done
        #11 naming to docker.io/library/12fda807-container done
        #11 DONE 0.0s
        
        Use 'docker scan' to run Snyk tests against images to find vulnerabilities and learn how to fix them

    Outputs:
        lbDns: "lb-eabdb43-1757810096.eu-west-1.elb.amazonaws.com"

    Resources:
        + 31 created

    Duration: 3m44s


    examples/aws-ts-fargate-autoscaling on  fargate-autoscaling [?] via  v18.12.1 🛥  dev on ☁️  piers@pulumi.com took 4m4s 
    ```

4. At this point, your app is running! The URL was published so it's easy to interact with:

    ```bash
    $ curl http://$(pulumi stack output lbDns) 
    {"message":"Hello, World"}% 
    ``` 

5. Once you are done, you can destroy all of the resources, and the stack:

    ```bash
    $ pulumi destroy
    $ pulumi stack rm
    ```