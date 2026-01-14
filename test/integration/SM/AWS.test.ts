import test, { before, describe } from 'node:test'

import { SM, APP_NAME, PROVIDERS } from '../../../src/config.ts'

import type { ISM } from '../../../src/application/ports/ISM.ts'
import GatewayFactory from '../../../src/infrastructure/services/GatewayFactory.ts'
import { secretManagerTestFactory } from './secretManagerTestFactory.ts'

const client = await GatewayFactory.SM({
	...SM,
	PROVIDER: PROVIDERS.AWS
}, APP_NAME)
const tests = secretManagerTestFactory(client as ISM)

describe('AWS SM', () => {
	before(tests.setup)

	test('List secrets', tests.listSecrets)
	test('Get by name', tests.getByName)
	test('Get active versions', tests.getActiveVersions)
	test('Get latest active version', tests.getLatestActiveVersion)
	test('Get version by id', tests.getVersionById)
})