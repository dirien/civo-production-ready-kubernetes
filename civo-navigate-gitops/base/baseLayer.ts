import * as pulumi from "@pulumi/pulumi";
import {Service} from "./service";
import {local} from "@pulumi/command";

export interface CollectionArgs {
    targetDir: pulumi.Input<string>;
    token?: pulumi.Input<string>;
    dnsDomainName?: pulumi.Input<string>;
    clusterName: pulumi.Input<string>;
}

export class BaseLayer extends pulumi.ComponentResource {
    readonly name: string

    constructor(name: string, _args: CollectionArgs, opts?: pulumi.ComponentResourceOptions) {
        super(`collection:index:${name}`, name, {}, opts);
        this.name = name;
    }
}

export function moveFilesForService(args: CollectionArgs, service: Service, parent: pulumi.ComponentResource, name: string) {
    const subFolder = new local.Command(`mkdir-${service.serviceName}`, {
        create: `mkdir -p ${args.targetDir}/${name}/${service.serviceName}`,
        update: `mkdir -p ${args.targetDir}/${name}/${service.serviceName}`,
    }, {
        parent: parent,
        dependsOn: [service]
    });

    new local.Command(`mv-${service.serviceName}`, {
        triggers: [service.chartVersion],
        create: `cp rendered/${service.serviceName}/*/** ${args.targetDir}/${name}/${service.serviceName}/`,
        update: `cp rendered/${service.serviceName}/*/** ${args.targetDir}/${name}/${service.serviceName}/`,
    }, {
        parent: parent,
        dependsOn: [service, subFolder]
    });
}
