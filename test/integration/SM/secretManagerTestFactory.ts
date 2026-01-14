import assert from 'node:assert'
import type { ISM, ISecret } from '../../../src/application/ports/ISM.ts'

export function secretManagerTestFactory(client: ISM) {
  const secrets: ISecret[] = []

  async function setup() {
    for await (const list of client.list()) {
      list.forEach(secret => secrets.push(secret))
    }
  }

  return {
    setup,
    listSecrets: async () => {
      assert.strictEqual(secrets.length >= 1, true)
    },
    listFromASpecificCursor: async () => {
      const allSecrets: ISecret[] = []
      let cursor: string | undefined = undefined

      // First page
      for await (const list of client.list({ perPage: 2 })) {
        allSecrets.push(...list)
        if (list.length === 2) {
          cursor = list[1].name
        }
        break
      }

      assert.strictEqual(allSecrets.length, 2)
      assert.ok(cursor)

      // Second page
      const secondPageSecrets: ISecret[] = []
      for await (const list of client.list({ cursor, perPage: 2 })) {
        secondPageSecrets.push(...list)
        break
      }

      assert.ok(secondPageSecrets.length > 0)
    },
    getByName: async () => {
      const secret = await client.get(secrets[0].name)
      assert.deepStrictEqual(secrets[0], secret)
    },
    getActiveVersions: async () => {
      const secret = await client.get(secrets[0].name)
      const activeVersions = secret?.getActiveVersions()
      assert.strictEqual(activeVersions?.length, 1)
    },
    getLatestActiveVersion: async () => {
      const secret = await client.get(secrets[0].name)
      const latestActiveVersion = secret?.getLatestActiveVersion()
      assert.strictEqual(latestActiveVersion?.enabled, true)
    },
    getVersionById: async () => {
      const secret = await client.get(secrets[0].name)
      const version = secret?.getVersion(secrets[0].versions[0].id)
      assert.deepStrictEqual(version, secrets[0].versions[0])
    }
  }
}
