export class IterableWeakMap<K extends WeakKey, V> implements Map<K, V> {
	private uuids = new WeakMap<K, string>()
	private refs: Record<string, [WeakRef<K>, any]> = {}
	private createIterator<I>(cb: (key: K, value: V) => I): MapIterator<I> {
		const that = this
		return (function* () {
			for (const uuid of Object.keys(that.refs)) {
				const [keyRef, value] = that.refs[uuid],
					key = keyRef.deref()
				if (key) yield cb(key, value)
				else delete that.refs[uuid]
			}
			return undefined
		})()
	}
	clear(): void {
		this.uuids = new WeakMap<K, string>()
		this.refs = {}
	}
	delete(key: K): boolean {
		const uuid = this.uuids.get(key)
		if (!uuid) return false
		delete this.refs[uuid]
		this.uuids.delete(key)
		return true
	}
	forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void {
		for (const [k, v] of this) callbackfn.call(thisArg ?? this, v, k, thisArg ?? this)
	}
	get(key: K): V | undefined {
		const uuid = this.uuids.get(key)
		if (!uuid) return undefined
		return this.refs[uuid][1]
	}
	has(key: K): boolean {
		return this.uuids.has(key)
	}
	set(key: K, value: V): this {
		let uuid = this.uuids.get(key)
		if (uuid) {
			this.refs[uuid][1] = value
		} else {
			uuid = crypto.randomUUID()
			this.uuids.set(key, uuid)
			this.refs[uuid] = [new WeakRef(key), value]
		}
		return this
	}
	get size(): number {
		return [...this].length
	}
	entries(): MapIterator<[K, V]> {
		return this.createIterator((key, value) => [key, value] as [K, V])
	}
	keys(): MapIterator<K> {
		return this.createIterator((key, value) => key)
	}
	values(): MapIterator<V> {
		return this.createIterator((key, value) => value)
	}
	[Symbol.iterator](): MapIterator<[K, V]> {
		return this.entries()
	}
	readonly [Symbol.toStringTag]: string = 'IterableWeakMap'
}

//function iterableSetLike<K extends WeakKey>(set: Set<K>): IterableWeakSet<K> {

export class IterableWeakSet<K extends WeakKey> implements Set<K> {
	private uuids = new WeakMap<K, string>()
	private refs: Record<string, WeakRef<K>> = {}
	private createIterator<I>(cb: (key: K) => I): MapIterator<I> {
		const that = this
		return (function* () {
			for (const uuid of Object.keys(that.refs)) {
				const key = that.refs[uuid].deref()
				if (key) yield cb(key)
				else delete that.refs[uuid]
			}
			return undefined
		})()
	}

	clear(): void {
		this.uuids = new WeakMap<K, string>()
		this.refs = {}
	}

	add(value: K): this {
		let uuid = this.uuids.get(value)
		if (!uuid) {
			uuid = crypto.randomUUID()
			this.uuids.set(value, uuid)
			this.refs[uuid] = new WeakRef(value)
		}
		return this
	}
	delete(value: K): boolean {
		const uuid = this.uuids.get(value)
		if (!uuid) return false
		delete this.refs[uuid]
		this.uuids.delete(value)
		return true
	}

	forEach(callbackfn: (value: K, value2: K, set: Set<K>) => void, thisArg?: any): void {
		for (const value of this) callbackfn.call(thisArg ?? this, value, value, thisArg ?? this)
	}

	has(value: K): boolean {
		return this.uuids.has(value)
	}
	get size(): number {
		return [...this].length
	}
	entries(): SetIterator<[K, K]> {
		return this.createIterator((key) => [key, key] as [K, K])
	}
	keys(): SetIterator<K> {
		return this.createIterator((key) => key)
	}
	values(): SetIterator<K> {
		return this.createIterator((key) => key)
	}
	[Symbol.iterator](): SetIterator<K> {
		return this.keys()
	}
	readonly [Symbol.toStringTag]: string = 'IterableWeakSet'

	union<U>(other: ReadonlySetLike<U>): Set<K | U> {
		const others = {
				[Symbol.iterator]() {
					return other.keys()
				}
			},
			that = this

		return new Set(
			(function* () {
				yield* that
				for (const value of others) if (!that.has(<K>(<unknown>value))) yield value
			})()
		)
	}
	intersection<U>(other: ReadonlySetLike<U>): Set<K & U> {
		const that = this
		return new Set(
			(function* () {
				for (const value of that) if (other.has(<U>(<unknown>value))) yield <K & U>value
			})()
		)
	}
	difference<U>(other: ReadonlySetLike<U>): Set<K> {
		const that = this
		return new Set(
			(function* () {
				for (const value of that) if (!other.has(<U>(<unknown>value))) yield <K>value
			})()
		)
	}
	symmetricDifference<U>(other: ReadonlySetLike<U>): Set<K | U> {
		const others = {
				[Symbol.iterator]() {
					return other.keys()
				}
			},
			that = this
		return new Set(
			(function* () {
				for (const value of that) if (!other.has(<U>(<unknown>value))) yield <K | U>value
				for (const value of others) if (!that.has(<K>(<unknown>value))) yield <K | U>value
			})()
		)
	}
	isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
		for (const value of this) if (!other.has(value)) return false
		return true
	}
	isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
		const others = {
			[Symbol.iterator]() {
				return other.keys()
			}
		}
		for (const value of others) if (!this.has(<K>value)) return false
		return true
	}
	isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
		for (const value of this) if (other.has(value)) return false
		return true
	}
}
