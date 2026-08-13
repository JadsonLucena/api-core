import { isValidDate } from '../service/TypeGuard.ts'
import UUIDVO from '../value-objects/UUIDVO.ts'

/**
 * A Base Domain Entity base inspired by MER associative entities: the concept is the relationship
 * itself, and its identity is the composite of the related participants - not a standalone surrogate key.
 *
 * Kept so those associations can own a shared lifecycle without inventing an
 * artificial id only to fit the usual Entity shape.
 */
export abstract class AssociativeEntity implements IAssociativeEntity {
	private _createdAt!: Date
	private _updatedAt!: Date

	constructor({
		createdAt = new Date(),
		updatedAt
	}: Partial<IAssociativeEntity> = {}) {
		this.createdAt = createdAt
		this.updatedAt = updatedAt ?? this.createdAt
	}

	get createdAt() {
		return structuredClone(this._createdAt)
	}

	private set createdAt(value: Date) {
		if (!isValidDate(value)) {
			throw new Error('createdAt is invalid')
		} else if (value.getTime() > Date.now()) {
			throw new Error('createdAt cannot be in the future')
		}

		this._createdAt = structuredClone(value)
	}

	get updatedAt() {
		return structuredClone(this._updatedAt)
	}

	protected set updatedAt(value: Date) {
		if (!isValidDate(value)) {
			throw new Error('updatedAt is invalid')
		} else if (value.getTime() < this.createdAt.getTime()) {
			throw new Error('updatedAt cannot be before createdAt')
		}

		this._updatedAt = structuredClone(value)
	}
}

export abstract class OpaqueEntity extends AssociativeEntity implements IOpaqueEntity {
	readonly id: UUIDVO

	constructor({
		id = new UUIDVO(),
		...rest
	}: Partial<IOpaqueEntity> = {}) {
		super(rest)
		this.id = id
	}
}

export abstract class SequentialEntity extends AssociativeEntity implements ISequentialEntity {
	readonly id?: number | bigint

	constructor({
		id,
		...rest
	}: Partial<ISequentialEntity> = {}) {
		super(rest)
		this.id = id
	}
}

export function Confirmable<TBase extends AbstractConstructor<AssociativeEntity & Partial<IArchivable & IExpirable>>>(
	Base: TBase
): MixinConstructor<TBase, IConfirmable, ConfirmablePayload<TBase>>
export function Confirmable(
	Base: AbstractConstructor<AssociativeEntity & Partial<IArchivable & IExpirable>>
) {
	abstract class ConfirmableMixin extends Base implements IConfirmable {
		private _confirmedAt?: Date
		private _isConfirmableHydrating = true

		constructor(...args: any[]) {
			const { confirmedAt, ...rest } = args[0] ?? {}

			super(rest)

			this.confirmedAt = confirmedAt
			this._isConfirmableHydrating = false
		}

		get confirmedAt() {
			return structuredClone(this._confirmedAt)
		}

		private set confirmedAt(value: Date | undefined) {
			if (value && !isValidDate(value)) {
				throw new Error('confirmedAt is invalid')
			} else if (value && value.getTime() < this.createdAt.getTime()) {
				throw new Error('confirmedAt cannot be before createdAt')
			} else if (
				!this._isConfirmableHydrating &&
				value?.getTime() !== this._confirmedAt?.getTime()
			) {
				this.updatedAt = new Date()
			}

			this._confirmedAt = structuredClone(value)
		}

		confirm() {
			if (this.isConfirmed()) {
				throw new Error('It is already confirmed')
			} else if (this.isSoftDeleted?.()) {
				throw new Error('It is soft deleted')
			} else if (this.isDisabled?.()) {
				throw new Error('It is disabled')
			} else if (this.isExpired?.()) {
				throw new Error('It is expired')
			}

			this.confirmedAt = new Date()
		}

		isConfirmed() {
			return !!this.confirmedAt
		}
	}

	return ConfirmableMixin
}

export function Archivable<TBase extends AbstractConstructor<AssociativeEntity>>(
	Base: TBase
): MixinConstructor<TBase, IArchivable, ArchivablePayload<TBase>>
export function Archivable(Base: AbstractConstructor<AssociativeEntity>) {
	abstract class ArchivableMixin extends Base implements IArchivable {
		private _disabledAt?: Date
		private _deletedAt?: Date
		private _isArchivableHydrating = true

		constructor(...args: any[]) {
			const { disabledAt, deletedAt, ...rest } = args[0] ?? {}

			super(rest)

			this.disabledAt = disabledAt
			this.deletedAt = deletedAt
			this._isArchivableHydrating = false
		}

		get disabledAt() {
			return structuredClone(this._disabledAt)
		}

		private set disabledAt(value: Date | undefined) {
			if (value && !isValidDate(value)) {
				throw new Error('disabledAt is invalid')
			} else if (value && value.getTime() < this.createdAt.getTime()) {
				throw new Error('disabledAt cannot be before createdAt')
			} else if (
				!this._isArchivableHydrating &&
				value?.getTime() !== this._disabledAt?.getTime()
			) {
				this.updatedAt = new Date()
			}

			this._disabledAt = structuredClone(value)
		}

		get deletedAt() {
			return structuredClone(this._deletedAt)
		}

		private set deletedAt(value: Date | undefined) {
			if (value && !isValidDate(value)) {
				throw new Error('deletedAt is invalid')
			} else if (value && value.getTime() < this.createdAt.getTime()) {
				throw new Error('deletedAt cannot be before createdAt')
			} else if (
				!this._isArchivableHydrating &&
				value?.getTime() !== this._deletedAt?.getTime()
			) {
				this.updatedAt = new Date()
			}

			this._deletedAt = structuredClone(value)
		}

		softDelete() {
			if (this.isSoftDeleted()) {
				throw new Error('It is already soft deleted')
			}

			this.deletedAt = new Date()
		}

		restore() {
			if (!this.isSoftDeleted()) {
				throw new Error('It is not soft deleted')
			}

			this.deletedAt = undefined
		}

		isSoftDeleted() {
			return !!this.deletedAt
		}

		enable() {
			if (this.isSoftDeleted()) {
				throw new Error('It is soft deleted')
			} else if (!this.isDisabled()) {
				throw new Error('It is not disabled')
			}

			this.disabledAt = undefined
		}

		disable() {
			if (this.isSoftDeleted()) {
				throw new Error('It is soft deleted')
			} else if (this.isDisabled()) {
				throw new Error('It is already disabled')
			}

			this.disabledAt = new Date()
		}

		isDisabled() {
			return !!this.disabledAt
		}
	}

	return ArchivableMixin
}

export function Expirable<TBase extends AbstractConstructor<AssociativeEntity & Partial<IArchivable>>>(
	Base: TBase
): MixinConstructor<TBase, IExpirable, ExpirablePayload<TBase>>
export function Expirable(Base: AbstractConstructor<AssociativeEntity & Partial<IArchivable>>) {
	abstract class ExpirableMixin extends Base implements IExpirable {
		private _expiresAt?: Date
		private _startAt!: Date
		private _isExpirableHydrating = true

		constructor(...args: any[]) {
			const { expiresAt, startAt, ...rest } = args[0] ?? {}

			super(rest)

			this.schedule(startAt ?? this.createdAt, expiresAt)
			this._isExpirableHydrating = false
		}

		get startAt() {
			return structuredClone(this._startAt)
		}

		get expiresAt() {
			return structuredClone(this._expiresAt)
		}

		schedule(startAt: Date, expiresAt?: Date) {
			if (!this._isExpirableHydrating) {
				if (this.isSoftDeleted?.()) {
					throw new Error('It is soft deleted')
				} else if (this.isDisabled?.()) {
					throw new Error('It is disabled')
				}
			}

			if (!isValidDate(startAt)) {
				throw new Error('startAt is invalid')
			} else if (startAt.getTime() < this.createdAt.getTime()) {
				throw new Error('startAt cannot be before createdAt')
			}

			if (expiresAt !== undefined) {
				if (!isValidDate(expiresAt)) {
					throw new Error('expiresAt is invalid')
				} else if (
					!this._isExpirableHydrating &&
					expiresAt.getTime() <= Date.now()
				) {
					throw new Error('expiresAt must be in the future')
				} else if (expiresAt.getTime() < this.createdAt.getTime()) {
					throw new Error('expiresAt cannot be before createdAt')
				} else if (expiresAt.getTime() < startAt.getTime()) {
					throw new Error('expiresAt cannot be before startAt')
				}
			}

			if (
				!this._isExpirableHydrating &&
				(
					startAt.getTime() !== this._startAt?.getTime() ||
					expiresAt?.getTime() !== this._expiresAt?.getTime()
				)
			) {
				this.updatedAt = new Date()
			}

			this._startAt = structuredClone(startAt)
			this._expiresAt = structuredClone(expiresAt)
		}

		expireAt(expiresAt: Date) {
			this.schedule(this._startAt, expiresAt)
		}

		neverExpire() {
			this.schedule(this._startAt, undefined)
		}

		isStarted() {
			return Date.now() >= this.startAt.getTime()
		}

		isExpired() {
			return Date.now() >= (this.expiresAt?.getTime() ?? Infinity)
		}
	}

	return ExpirableMixin
}

export interface IAssociativeEntity {
	get createdAt(): Date
	get updatedAt(): Date
}
export interface IOpaqueEntity extends IAssociativeEntity {
	readonly id: UUIDVO
}
export interface ISequentialEntity extends IAssociativeEntity {
	readonly id?: number | bigint
}
export interface IConfirmable {
	get confirmedAt(): Date | undefined
	confirm(): void
	isConfirmed(): boolean
}
export interface IArchivable {
	get disabledAt(): Date | undefined
	get deletedAt(): Date | undefined
	disable(): void
	enable(): void
	isDisabled(): boolean
	softDelete(): void
	restore(): void
	isSoftDeleted(): boolean
}
export interface IExpirable {
	get startAt(): Date
	get expiresAt(): Date | undefined
	schedule(startAt: Date, expiresAt?: Date): void
	expireAt(expiresAt: Date): void
	neverExpire(): void
	isStarted(): boolean
	isExpired(): boolean
}

type AbstractConstructor<T = object> = abstract new (...args: any[]) => T
type ConstructorParams<T> = T extends abstract new (...args: infer P) => any ? P : never
type BasePayload<TBase> = NonNullable<ConstructorParams<TBase>[0]>

type MixinConstructor<TBase extends AbstractConstructor, TMixin, TPayload extends object> =
	abstract new (props?: TPayload) => InstanceType<TBase> & TMixin

type ConfirmablePayload<TBase> = { confirmedAt?: Date } & BasePayload<TBase>
type ArchivablePayload<TBase> = { disabledAt?: Date; deletedAt?: Date } & BasePayload<TBase>
type ExpirablePayload<TBase> = { startAt?: Date; expiresAt?: Date } & BasePayload<TBase>