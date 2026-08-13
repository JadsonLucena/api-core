import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
	AssociativeEntity,
	OpaqueEntity,
	SequentialEntity,
	Confirmable,
	Archivable,
	Expirable,
} from '../../../src/domain/models/Entity.ts'
import UUIDVO from '../../../src/domain/value-objects/UUIDVO.ts'

const ENTITY_ID = new UUIDVO('018f1a2b-3c4d-7e8f-9a0b-1c2d3e4f5a6b')
const CREATED_AT = new Date('2024-01-15T10:00:00.000Z')
const CONFIRMED_AT = new Date('2024-01-16T10:00:00.000Z')
const DISABLED_AT = new Date('2024-01-17T10:00:00.000Z')
const DELETED_AT = new Date('2024-01-18T10:00:00.000Z')
const EXPIRED_AT = new Date('2024-06-01T00:00:00.000Z')
const INVALID_DATE = new Date('invalid')

const oneDayFromNow = () => new Date(Date.now() + 24 * 60 * 60 * 1000)
const twoDaysFromNow = () => new Date(Date.now() + 48 * 60 * 60 * 1000)

class AuditEntry extends AssociativeEntity {}
class CatalogItem extends OpaqueEntity {}
class OrderLine extends SequentialEntity {}
class Membership extends Confirmable(Archivable(OpaqueEntity)) {}
class Subscription extends Expirable(Archivable(OpaqueEntity)) {}
class License extends Expirable(Confirmable(Archivable(OpaqueEntity))) {}
class Trial extends Expirable(OpaqueEntity) {}
class Account extends Archivable(OpaqueEntity) {}
class Invite extends Confirmable(OpaqueEntity) {}

function createMembership(
	overrides: ConstructorParameters<typeof Membership>[0] = {},
) {
	return new Membership({
		id: ENTITY_ID,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		...overrides,
	})
}

function createSubscription(
	overrides: ConstructorParameters<typeof Subscription>[0] = {},
) {
	return new Subscription({
		id: ENTITY_ID,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		startAt: CREATED_AT,
		...overrides,
	})
}

function createLicense(
	overrides: ConstructorParameters<typeof License>[0] = {},
) {
	return new License({
		id: ENTITY_ID,
		createdAt: CREATED_AT,
		updatedAt: CREATED_AT,
		startAt: CREATED_AT,
		...overrides,
	})
}

describe('AssociativeEntity', () => {
	it('creates timestamps when constructed without payload', () => {
		const entry = new AuditEntry()

		assert.ok(entry.createdAt instanceof Date)
		assert.strictEqual(entry.updatedAt.getTime(), entry.createdAt.getTime())
	})

	it('hydrates createdAt and updatedAt from the payload', () => {
		const entry = new AuditEntry({
			createdAt: CREATED_AT,
			updatedAt: CONFIRMED_AT,
		})

		assert.strictEqual(entry.createdAt.toISOString(), CREATED_AT.toISOString())
		assert.strictEqual(entry.updatedAt.toISOString(), CONFIRMED_AT.toISOString())
	})

	it('defaults updatedAt to createdAt when updatedAt is omitted', () => {
		const entry = new AuditEntry({ createdAt: CREATED_AT })

		assert.strictEqual(entry.updatedAt.toISOString(), CREATED_AT.toISOString())
	})

	it('rejects createdAt in the future', () => {
		assert.throws(
			() => new AuditEntry({ createdAt: oneDayFromNow() }),
			{ message: 'createdAt cannot be in the future' },
		)
	})

	it('rejects updatedAt before createdAt', () => {
		assert.throws(
			() => new AuditEntry({
				createdAt: CONFIRMED_AT,
				updatedAt: CREATED_AT,
			}),
			{ message: 'updatedAt cannot be before createdAt' },
		)
	})

	it('rejects invalid createdAt', () => {
		assert.throws(
			() => new AuditEntry({ createdAt: INVALID_DATE }),
			{ message: 'createdAt is invalid' },
		)
	})

	it('rejects invalid updatedAt', () => {
		assert.throws(
			() => new AuditEntry({
				createdAt: CREATED_AT,
				updatedAt: INVALID_DATE,
			}),
			{ message: 'updatedAt is invalid' },
		)
	})

	it('does not expose mutable date references through getters', () => {
		const entry = new AuditEntry({
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		entry.createdAt.setUTCFullYear(1999)
		entry.updatedAt.setUTCFullYear(1999)

		assert.strictEqual(entry.createdAt.toISOString(), CREATED_AT.toISOString())
		assert.strictEqual(entry.updatedAt.toISOString(), CREATED_AT.toISOString())
	})
})

describe('OpaqueEntity', () => {
	it('assigns a generated id when created without payload', () => {
		const item = new CatalogItem()

		assert.ok(item.id instanceof UUIDVO)
		assert.ok(item.createdAt instanceof Date)
	})

	it('hydrates with the provided id and inherits AssociativeEntity timestamps', () => {
		const item = new CatalogItem({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CONFIRMED_AT,
		})

		assert.strictEqual(item.id.toString(), ENTITY_ID.toString())
		assert.strictEqual(item.createdAt.toISOString(), CREATED_AT.toISOString())
		assert.strictEqual(item.updatedAt.toISOString(), CONFIRMED_AT.toISOString())
	})
})

describe('SequentialEntity', () => {
	it('keeps id undefined when the entity is not persisted yet', () => {
		const line = new OrderLine({ createdAt: CREATED_AT })

		assert.strictEqual(line.id, undefined)
	})

	it('hydrates with a numeric id', () => {
		const line = new OrderLine({ id: 42, createdAt: CREATED_AT })

		assert.strictEqual(line.id, 42)
	})

	it('hydrates with a bigint id', () => {
		const line = new OrderLine({ id: 9007199254740993n, createdAt: CREATED_AT })

		assert.strictEqual(line.id, 9007199254740993n)
	})
})

describe('Confirmable', () => {
	it('confirms an active entity and marks it as confirmed', () => {
		const membership = createMembership()

		membership.confirm()

		assert.strictEqual(membership.isConfirmed(), true)
		assert.ok(membership.confirmedAt instanceof Date)
		assert.ok(membership.updatedAt.getTime() >= CREATED_AT.getTime())
	})

	it('hydrates a previously confirmed entity without changing updatedAt', () => {
		const membership = createMembership({
			confirmedAt: CONFIRMED_AT,
			updatedAt: CREATED_AT,
		})

		assert.strictEqual(membership.isConfirmed(), true)
		assert.strictEqual(membership.confirmedAt?.toISOString(), CONFIRMED_AT.toISOString())
		assert.strictEqual(membership.updatedAt.toISOString(), CREATED_AT.toISOString())
	})

	it('rejects confirmation when already confirmed', () => {
		const membership = createMembership({ confirmedAt: CONFIRMED_AT })

		assert.throws(() => membership.confirm(), { message: 'It is already confirmed' })
	})

	it('rejects confirmation when soft deleted', () => {
		const membership = createMembership({ deletedAt: DELETED_AT })

		assert.throws(() => membership.confirm(), { message: 'It is soft deleted' })
	})

	it('rejects confirmation when disabled', () => {
		const membership = createMembership({ disabledAt: DISABLED_AT })

		assert.throws(() => membership.confirm(), { message: 'It is disabled' })
	})

	it('prefers soft-deleted over disabled when both apply', () => {
		const membership = createMembership({
			disabledAt: DISABLED_AT,
			deletedAt: DELETED_AT,
		})

		assert.throws(() => membership.confirm(), { message: 'It is soft deleted' })
	})

	it('rejects confirmation when expired', () => {
		const license = createLicense({ expiresAt: EXPIRED_AT })

		assert.throws(() => license.confirm(), { message: 'It is expired' })
	})

	it('rejects confirmedAt before createdAt during hydration', () => {
		assert.throws(
			() => createMembership({ confirmedAt: new Date('2023-12-01T00:00:00.000Z') }),
			{ message: 'confirmedAt cannot be before createdAt' },
		)
	})

	it('rejects invalid confirmedAt during hydration', () => {
		assert.throws(
			() => createMembership({ confirmedAt: INVALID_DATE }),
			{ message: 'confirmedAt is invalid' },
		)
	})

	it('allows confirmation without Archivable or Expirable capabilities', () => {
		const invite = new Invite({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		invite.confirm()

		assert.strictEqual(invite.isConfirmed(), true)
	})
})

describe('Archivable', () => {
	it('disables an active entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		account.disable()

		assert.strictEqual(account.isDisabled(), true)
		assert.ok(account.disabledAt instanceof Date)
	})

	it('rejects disabling an already disabled entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			disabledAt: DISABLED_AT,
		})

		assert.throws(() => account.disable(), { message: 'It is already disabled' })
	})

	it('rejects disabling a soft-deleted entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			deletedAt: DELETED_AT,
		})

		assert.throws(() => account.disable(), { message: 'It is soft deleted' })
	})

	it('enables a disabled entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			disabledAt: DISABLED_AT,
		})

		account.enable()

		assert.strictEqual(account.isDisabled(), false)
		assert.strictEqual(account.disabledAt, undefined)
	})

	it('rejects enabling an entity that is not disabled', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		assert.throws(() => account.enable(), { message: 'It is not disabled' })
	})

	it('rejects enabling a soft-deleted entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			disabledAt: DISABLED_AT,
			deletedAt: DELETED_AT,
		})

		assert.throws(() => account.enable(), { message: 'It is soft deleted' })
	})

	it('soft deletes an active entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		account.softDelete()

		assert.strictEqual(account.isSoftDeleted(), true)
		assert.ok(account.deletedAt instanceof Date)
	})

	it('allows soft deleting a disabled entity and preserves disabledAt', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			disabledAt: DISABLED_AT,
		})

		account.softDelete()

		assert.strictEqual(account.isSoftDeleted(), true)
		assert.strictEqual(account.disabledAt?.toISOString(), DISABLED_AT.toISOString())
	})

	it('rejects soft deleting an already soft-deleted entity', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			deletedAt: DELETED_AT,
		})

		assert.throws(() => account.softDelete(), { message: 'It is already soft deleted' })
	})

	it('restores a soft-deleted entity and preserves prior disabledAt', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			disabledAt: DISABLED_AT,
			deletedAt: DELETED_AT,
		})

		account.restore()

		assert.strictEqual(account.isSoftDeleted(), false)
		assert.strictEqual(account.deletedAt, undefined)
		assert.strictEqual(account.disabledAt?.toISOString(), DISABLED_AT.toISOString())
	})

	it('rejects restoring an entity that is not soft deleted', () => {
		const account = new Account({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		assert.throws(() => account.restore(), { message: 'It is not soft deleted' })
	})

	it('rejects disabledAt before createdAt during hydration', () => {
		assert.throws(
			() => new Account({
				id: ENTITY_ID,
				createdAt: CREATED_AT,
				disabledAt: new Date('2023-12-01T00:00:00.000Z'),
			}),
			{ message: 'disabledAt cannot be before createdAt' },
		)
	})

	it('rejects deletedAt before createdAt during hydration', () => {
		assert.throws(
			() => new Account({
				id: ENTITY_ID,
				createdAt: CREATED_AT,
				deletedAt: new Date('2023-12-01T00:00:00.000Z'),
			}),
			{ message: 'deletedAt cannot be before createdAt' },
		)
	})

	it('rejects invalid disabledAt and deletedAt during hydration', () => {
		assert.throws(
			() => new Account({
				id: ENTITY_ID,
				createdAt: CREATED_AT,
				disabledAt: INVALID_DATE,
			}),
			{ message: 'disabledAt is invalid' },
		)
		assert.throws(
			() => new Account({
				id: ENTITY_ID,
				createdAt: CREATED_AT,
				deletedAt: INVALID_DATE,
			}),
			{ message: 'deletedAt is invalid' },
		)
	})
})

describe('Expirable', () => {
	it('defaults startAt to createdAt when omitted', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		assert.strictEqual(trial.startAt.toISOString(), CREATED_AT.toISOString())
		assert.strictEqual(trial.expiresAt, undefined)
		assert.strictEqual(trial.isExpired(), false)
	})

	it('hydrates an expired window without changing updatedAt', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
			expiresAt: EXPIRED_AT,
		})

		assert.strictEqual(trial.isExpired(), true)
		assert.strictEqual(trial.isStarted(), true)
		assert.strictEqual(trial.updatedAt.toISOString(), CREATED_AT.toISOString())
	})

	it('schedules a future validity window and updates updatedAt', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
		})
		const startAt = oneDayFromNow()
		const expiresAt = twoDaysFromNow()

		trial.schedule(startAt, expiresAt)

		assert.strictEqual(trial.startAt.toISOString(), startAt.toISOString())
		assert.strictEqual(trial.expiresAt?.toISOString(), expiresAt.toISOString())
		assert.ok(trial.updatedAt.getTime() > CREATED_AT.getTime())
	})

	it('does not bump updatedAt when schedule receives the same window', () => {
		const expiresAt = oneDayFromNow()
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
			expiresAt,
		})

		trial.schedule(CREATED_AT, expiresAt)

		assert.strictEqual(trial.updatedAt.toISOString(), CREATED_AT.toISOString())
	})

	it('can move the window forward past the previous expiresAt in one schedule call', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
			expiresAt: oneDayFromNow(),
		})
		const startAt = twoDaysFromNow()
		const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

		trial.schedule(startAt, expiresAt)

		assert.strictEqual(trial.startAt.toISOString(), startAt.toISOString())
		assert.strictEqual(trial.expiresAt?.toISOString(), expiresAt.toISOString())
	})

	it('sets expiresAt through expireAt', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
		})
		const expiresAt = oneDayFromNow()

		trial.expireAt(expiresAt)

		assert.strictEqual(trial.expiresAt?.toISOString(), expiresAt.toISOString())
		assert.strictEqual(trial.startAt.toISOString(), CREATED_AT.toISOString())
	})

	it('clears expiresAt through neverExpire', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
			expiresAt: EXPIRED_AT,
		})

		trial.neverExpire()

		assert.strictEqual(trial.expiresAt, undefined)
		assert.strictEqual(trial.isExpired(), false)
	})

	it('rejects expiresAt in the present or past during mutation', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
		})

		assert.throws(
			() => trial.expireAt(new Date()),
			{ message: 'expiresAt must be in the future' },
		)
		assert.throws(
			() => trial.expireAt(EXPIRED_AT),
			{ message: 'expiresAt must be in the future' },
		)
	})

	it('rejects startAt before createdAt', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		assert.throws(
			() => trial.schedule(new Date('2023-12-01T00:00:00.000Z'), oneDayFromNow()),
			{ message: 'startAt cannot be before createdAt' },
		)
	})

	it('rejects expiresAt before startAt', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		assert.throws(
			() => trial.schedule(twoDaysFromNow(), oneDayFromNow()),
			{ message: 'expiresAt cannot be before startAt' },
		)
	})

	it('rejects expiresAt before createdAt during hydration', () => {
		assert.throws(
			() => new Trial({
				id: ENTITY_ID,
				createdAt: CREATED_AT,
				updatedAt: CREATED_AT,
				startAt: CREATED_AT,
				expiresAt: new Date('2023-12-01T00:00:00.000Z'),
			}),
			{ message: 'expiresAt cannot be before createdAt' },
		)
	})

	it('rejects invalid startAt and expiresAt', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
		})

		assert.throws(
			() => trial.schedule(INVALID_DATE, oneDayFromNow()),
			{ message: 'startAt is invalid' },
		)
		assert.throws(
			() => trial.expireAt(INVALID_DATE),
			{ message: 'expiresAt is invalid' },
		)
	})

	it('rejects scheduling when soft deleted', () => {
		const subscription = createSubscription({ deletedAt: DELETED_AT })

		assert.throws(
			() => subscription.schedule(CREATED_AT, oneDayFromNow()),
			{ message: 'It is soft deleted' },
		)
		assert.throws(
			() => subscription.expireAt(oneDayFromNow()),
			{ message: 'It is soft deleted' },
		)
		assert.throws(
			() => subscription.neverExpire(),
			{ message: 'It is soft deleted' },
		)
	})

	it('rejects scheduling when disabled', () => {
		const subscription = createSubscription({ disabledAt: DISABLED_AT })

		assert.throws(
			() => subscription.schedule(CREATED_AT, oneDayFromNow()),
			{ message: 'It is disabled' },
		)
	})

	it('prefers soft-deleted over disabled when scheduling', () => {
		const subscription = createSubscription({
			disabledAt: DISABLED_AT,
			deletedAt: DELETED_AT,
		})

		assert.throws(
			() => subscription.neverExpire(),
			{ message: 'It is soft deleted' },
		)
	})

	it('allows scheduling an expired entity that is still active', () => {
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
			expiresAt: EXPIRED_AT,
		})
		const expiresAt = oneDayFromNow()

		trial.expireAt(expiresAt)

		assert.strictEqual(trial.expiresAt?.toISOString(), expiresAt.toISOString())
		assert.strictEqual(trial.isExpired(), false)
	})

	it('reports started and expired at the exact boundary timestamps', () => {
		const now = Date.now()
		const trial = new Trial({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: new Date(now),
			expiresAt: new Date(now),
		})

		assert.strictEqual(trial.isStarted(), true)
		assert.strictEqual(trial.isExpired(), true)
	})
})

describe('Capability composition', () => {
	it('hydrates a full capability stack without bumping updatedAt', () => {
		const license = createLicense({
			confirmedAt: CONFIRMED_AT,
			disabledAt: DISABLED_AT,
			deletedAt: DELETED_AT,
			startAt: CREATED_AT,
			expiresAt: EXPIRED_AT,
			updatedAt: CREATED_AT,
		})

		assert.strictEqual(license.isConfirmed(), true)
		assert.strictEqual(license.isDisabled(), true)
		assert.strictEqual(license.isSoftDeleted(), true)
		assert.strictEqual(license.isExpired(), true)
		assert.strictEqual(license.updatedAt.toISOString(), CREATED_AT.toISOString())
	})

	it('keeps confirm and schedule blocked after soft delete of a disabled entity', () => {
		const license = createLicense({
			disabledAt: DISABLED_AT,
			expiresAt: oneDayFromNow(),
		})

		license.softDelete()

		assert.throws(() => license.confirm(), { message: 'It is soft deleted' })
		assert.throws(() => license.schedule(CREATED_AT, twoDaysFromNow()), {
			message: 'It is soft deleted',
		})
		assert.strictEqual(license.disabledAt?.toISOString(), DISABLED_AT.toISOString())
	})

	it('works with Archivable outside Expirable and Confirmable', () => {
		class NestedLicense extends Archivable(Confirmable(Expirable(OpaqueEntity))) {}
		const license = new NestedLicense({
			id: ENTITY_ID,
			createdAt: CREATED_AT,
			updatedAt: CREATED_AT,
			startAt: CREATED_AT,
			expiresAt: oneDayFromNow(),
		})

		license.confirm()
		license.disable()

		assert.strictEqual(license.isConfirmed(), true)
		assert.strictEqual(license.isDisabled(), true)
		assert.throws(() => license.neverExpire(), { message: 'It is disabled' })
	})
})
