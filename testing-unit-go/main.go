package main

import (
	"github.com/pulumi/pulumi-aws/sdk/v4/go/aws/ec2"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

type Infrastructure struct {
	pulumi.ResourceState

	group  *ec2.SecurityGroup
	server *ec2.Instance
}

func newInfrastructure(ctx *pulumi.Context, name string, opts ...pulumi.ResourceOption) (*Infrastructure, error) {
	infra := &Infrastructure{}
	err := ctx.RegisterComponentResource("pkg:index:MyComponent", name, infra, opts...)
	if err != nil {
		return nil, err
	}

	group, err := ec2.NewSecurityGroup(ctx, "web-secgrp", &ec2.SecurityGroupArgs{
		Ingress: ec2.SecurityGroupIngressArray{
			// Uncomment to fail a test:
			//ec2.SecurityGroupIngressArgs{
			//   Protocol:   pulumi.String("tcp"),
			//   FromPort:   pulumi.Int(22),
			//   ToPort:     pulumi.Int(22),
			//   CidrBlocks: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
			//},
			ec2.SecurityGroupIngressArgs{
				Protocol:   pulumi.String("tcp"),
				FromPort:   pulumi.Int(80),
				ToPort:     pulumi.Int(80),
				CidrBlocks: pulumi.StringArray{pulumi.String("0.0.0.0/0")},
			},
		},
	})
	if err != nil {
		return nil, err
	}

	mostRecent := true
	ami, err := ec2.LookupAmi(ctx, &ec2.LookupAmiArgs{
		Filters: []ec2.GetAmiFilter{
			{
				Name:   "name",
				Values: []string{"ubuntu/images/hvm-ssd/ubuntu-bionic-18.04-amd64-server-*"},
			},
		},
		Owners:     []string{"137112412989"},
		MostRecent: &mostRecent,
	})
	if err != nil {
		return nil, err
	}

	const userData = `#!/bin/bash echo "Hello, World!" > index.html nohup python -m SimpleHTTPServer 80 &`

	server, err := ec2.NewInstance(ctx, "web-server-www", &ec2.InstanceArgs{
		InstanceType:        pulumi.String("t2-micro"),
		VpcSecurityGroupIds: pulumi.StringArray{group.ID()}, // reference the group object above
		Ami:                 pulumi.String(ami.Id),
		// Comment out to fail a test:
		Tags: pulumi.StringMap{"Name": pulumi.String("webserver")},
		// Uncomment to fail a test:
		//UserData:       pulumi.String(userData),      // start a simple web server
	})
	if err != nil {
		return nil, err
	}

	infra.group = group
	infra.server = server
	return infra, nil
}

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		infra, err := newInfrastructure(ctx, "infra")
		if err != nil {
			return err
		}

		ctx.Export("group", infra.group.ID())
		ctx.Export("server", infra.server.ID())
		ctx.Export("publicIp", infra.server.PublicIp)
		ctx.Export("publicHostName", infra.server.PublicDns)
		return nil
	})
}
