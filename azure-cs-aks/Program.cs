// Copyright 2016-2021, Pulumi Corporation.  All rights reserved.

using System;
using System.Text;
using Pulumi;
using Pulumi.AzureAD;
using Pulumi.AzureNative.ContainerService;
using Pulumi.AzureNative.ContainerService.Inputs;
using Pulumi.AzureNative.DBforMySQL;
using Pulumi.AzureNative.DBforMySQL.Inputs;
using Pulumi.AzureNative.Resources;
using Pulumi.AzureNative.Storage;
using Pulumi.Random;
using Pulumi.Tls;

return await Pulumi.Deployment.RunAsync(() =>
{
    // Create an Azure Resource Group
    var resourceGroup = new ResourceGroup("azure-cs-aks");

    var storageAccount = new StorageAccount("sa", new StorageAccountArgs
    {
        ResourceGroupName = resourceGroup.Name,
        Sku = new Pulumi.AzureNative.Storage.Inputs.SkuArgs
        {
            Name = SkuName.Standard_LRS
        },
        Kind = Kind.StorageV2,
    });

    var checkpointBlob = new BlobContainer("check-blob", new BlobContainerArgs
    {
        ResourceGroupName = resourceGroup.Name,
        AccountName = storageAccount.Name
    });

    var policyBlob = new BlobContainer("policy-blob", new BlobContainerArgs
    {
        ResourceGroupName = resourceGroup.Name,
        AccountName = storageAccount.Name
    });

    var storageKeys = ListStorageAccountKeys.Invoke(new ListStorageAccountKeysInvokeArgs
    {
        ResourceGroupName = resourceGroup.Name,
        AccountName = storageAccount.Name,
    });

    // Generate random password
    var password = new RandomPassword("password", new RandomPasswordArgs
    {
        Length = 20,
        Special = true
    });

    var server = new Server("server", new()
    {
        Properties = new ServerPropertiesForDefaultCreateArgs
        {
            AdministratorLogin = "cloudsa",
            AdministratorLoginPassword = password.Result,
            CreateMode = "Default",
            SslEnforcement = SslEnforcementEnum.Enabled,
            StorageProfile = new StorageProfileArgs
            {
                BackupRetentionDays = 7,
                GeoRedundantBackup = "Enabled",
                StorageMB = 128000,
            },
            PublicNetworkAccess = PublicNetworkAccessEnum.Enabled,
        },
        ResourceGroupName = resourceGroup.Name,
        ServerName = "mysqltestsvc4",
        Sku = new SkuArgs
        {
            Capacity = 2,
            Family = "Gen5",
            Name = "GP_Gen5_2",
            Tier = "GeneralPurpose",
        },
        Tags =
        {
            { "ElasticServer", "1" },
        },
    });

    var db = new Database("db", new DatabaseArgs
    {
        Charset = "utf8",
        Collation = "utf8_general_ci",
        DatabaseName = "pulumi",
        ServerName = server.Name,
        ResourceGroupName = resourceGroup.Name,
    });

    new FirewallRule("fw-rule", new FirewallRuleArgs
    {
        ResourceGroupName = resourceGroup.Name,
        ServerName = server.Name,
        StartIpAddress = "0.0.0.0",
        EndIpAddress = "255.255.255.255",
    });

    // Create an AD service principal
    var adApp = new Application("aks", new ApplicationArgs
    {
        DisplayName = "aks"
    });
    var adSp = new ServicePrincipal("aksSp", new ServicePrincipalArgs
    {
        ApplicationId = adApp.ApplicationId
    });

    // Create the Service Principal Password
    var adSpPassword = new ServicePrincipalPassword("aksSpPassword", new ServicePrincipalPasswordArgs
    {
        ServicePrincipalId = adSp.Id,
        Value = password.Result,
        EndDate = "2099-01-01T00:00:00Z"
    });

    // Generate an SSH key
    var sshKey = new PrivateKey("ssh-key", new PrivateKeyArgs
    {
        Algorithm = "RSA",
        RsaBits = 4096
    });

    var cluster = new ManagedCluster("my-aks", new ManagedClusterArgs
    {
        ResourceGroupName = resourceGroup.Name,
        AgentPoolProfiles =
            {
                new ManagedClusterAgentPoolProfileArgs
                {
                    Count = 3,
                    MaxPods = 110,
                    Mode = "System",
                    Name = "agentpool",
                    OsDiskSizeGB = 30,
                    OsType = "Linux",
                    Type = "VirtualMachineScaleSets",
                    VmSize = "Standard_DS2_v2",
                }
            },
        DnsPrefix = "AzureNativeprovider",
        EnableRBAC = true,
        KubernetesVersion = "1.26.0",
        LinuxProfile = new ContainerServiceLinuxProfileArgs
        {
            AdminUsername = "testuser",
            Ssh = new ContainerServiceSshConfigurationArgs
            {
                PublicKeys =
                    {
                        new ContainerServiceSshPublicKeyArgs
                        {
                            KeyData = sshKey.PublicKeyOpenssh,
                        }
                    }
            }
        },
        NodeResourceGroup = $"MC_azure-cs_my_aks",
        ServicePrincipalProfile = new ManagedClusterServicePrincipalProfileArgs
        {
            ClientId = adApp.ApplicationId,
            Secret = adSpPassword.Value
        }
    });

    // Export the name of the bucket
    return new System.Collections.Generic.Dictionary<string, object?>
    {
        ["kubeconfig"] = GetKubeConfig(resourceGroup.Name, cluster.Name),
        ["dbEndpoint"] = server.FullyQualifiedDomainName,
        ["dbServerName"] = server.Name,
        ["dbUsername"] = server.AdministratorLogin,
        ["password"] = password.Result,
        ["storageKey1"] = storageKeys.Apply(s => s.Keys[0].Value),
        ["storageKey2"] = storageKeys.Apply(s => s.Keys[1].Value),
        ["checkpointBlobId"] = checkpointBlob.Id,
        ["policypackBlobId"] = policyBlob.Id,
        ["checkpointBloblName"] = checkpointBlob.Name,
        ["policypackBlobName"] = policyBlob.Name,
        ["storageAccountName"] = storageAccount.Name,
    };
});

static Output<string> GetKubeConfig(Output<string> resourceGroupName, Output<string> clusterName)
        => ListManagedClusterUserCredentials.Invoke(new ListManagedClusterUserCredentialsInvokeArgs
        {
            ResourceGroupName = resourceGroupName,
            ResourceName = clusterName
        }).Apply(credentials =>
        {
            var encoded = credentials.Kubeconfigs[0].Value;
            var data = Convert.FromBase64String(encoded);
            return Encoding.UTF8.GetString(data);
        });