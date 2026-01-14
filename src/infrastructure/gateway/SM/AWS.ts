import {
	SecretsManagerClient,
	ListSecretsCommand,
	GetSecretValueCommand,
	DescribeSecretCommand,
  type SecretListEntry,
  type DescribeSecretCommandOutput,
  type ListSecretsCommandOutput
} from '@aws-sdk/client-secrets-manager'
import { fromTokenFile } from '@aws-sdk/credential-providers'

import { PAGINATION } from '../../../config.ts'

import type { ISM, CursorPagination } from '../../../application/ports/ISM.ts'
import Secret from './Secret.ts'

export default class AwsSM implements ISM {
  private client: SecretsManagerClient

  constructor(props: AwsSmProps) {
    this.client = new SecretsManagerClient({
      apiVersion: props.apiVersion,
      region: props.region,
      credentials: this.getCredentials(props)
    })
  }

  private getCredentials(props: AwsSmProps) {
    if ('federatedTokenFile' in props) {
      return fromTokenFile({
        webIdentityTokenFile: props.federatedTokenFile,
        roleArn: props.roleArn,
        roleSessionName: props.appName
      })
    }

    return {
      accessKeyId: props.accessKeyId,
      secretAccessKey: props.secretAccessKey
    }
  }

  async *list({
    perPage = PAGINATION.MAX_PER_PAGE,
    cursor,
  }: CursorPagination = {}) {
    let nextPageToken: string | undefined | null = cursor
    while (true) {
      const { SecretList, NextToken }: ListSecretsCommandOutput = await this.client.send(new ListSecretsCommand({
        MaxResults: perPage,
        NextToken: nextPageToken
      }))

      const secretInfos = await Promise.all((SecretList ?? []).map(secretMetadata => this.mountResponse(secretMetadata)))

      yield secretInfos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      nextPageToken = NextToken
      if (!nextPageToken) {
        break
      }
    }
  }

  async get(name: string) {
    const secret = await this.client.send(new DescribeSecretCommand({
      SecretId: name
    }))

    return this.mountResponse(secret)
  }

  private async mountResponse(secret: SecretListEntry | DescribeSecretCommandOutput): Promise<Secret> {
    const versions = await this.getVersions(secret)

		return new Secret({
      // id: secret.ARN!,
      name: secret.Name!,
      description: secret.Description!,
      tags: secret.Tags?.reduce((acc, tag) => {
        acc[tag.Key!] = tag.Value!
        return acc
      }, {} as Record<string, string>) || {},
      rotatesAt: secret.NextRotationDate,
      createdAt: secret.CreatedDate!,
      lastModifiedAt: secret.LastChangedDate,
      startsAt: undefined,
      expiresAt: undefined,
      versions: await Promise.all(versions.map(version => {
        return {
          id: version.VersionId!,
          value: version.SecretString!,
          enabled: Boolean(version.VersionStages?.includes('AWSCURRENT')),
          createdAt: new Date(version.CreatedDate!),
          expiresAt: undefined
        }
      }))
    })
	}

  private async getVersions(secret: SecretListEntry | DescribeSecretCommandOutput) {
    const versions = (secret as SecretListEntry).SecretVersionsToStages ?? (secret as DescribeSecretCommandOutput).VersionIdsToStages

    return (await Promise.all(Object.entries(versions ?? []).map(([VersionId]) => {
      return this.client.send(new GetSecretValueCommand({
        SecretId: secret.ARN!,
        VersionId
      }))
    })))
  }
}

export type AwsSmProps = {
  apiVersion: string,
  region: string
} & ({
  accessKeyId: string,
  secretAccessKey: string
} | {
  federatedTokenFile: string,
  roleArn: string,
  appName: string
})