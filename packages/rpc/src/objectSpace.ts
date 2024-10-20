import { ManageableObject } from './types'

abstract class IdSpace {
	constructor(public readonly name: string) {}
	protected abstract get<T extends ManageableObject>(id: number): any
}

export class LocalIdSpace extends IdSpace {
	/**
	 * Timeout in ms to add freed index into the free index pool - avoid re-allocating the index and have a message on
	 *  the deleted object confused with the new re-allocated one
	 * Note: HTTP timeout is usually 5 seconds, longest is 30
	 */
	public poolTimeout = 31000
	private next = 1
	private readonly pool = new Set<number>()
	private readonly outerSpaces: Record<string, IdSpace> = {}
	private readonly usedBy: Record<number, Set<OuterSpace>> = {}
	private readonly objectRefs = new WeakMap<ManageableObject, number>()
	protected readonly objects: Record<number, WeakRef<object>> = {}

	constructor(name: string) {
		super(name)
		this.registerIdSpace(this)
	}
	public registerIdSpace(space: IdSpace) {
		this.outerSpaces[space.name] = space
	}
	/**
	 * To be overridden - make a proxy, whatever
	 * @param obj
	 * @returns
	 */
	protected customizeObject<T extends ManageableObject>(obj: T) {
		return obj
	}
	private allocateId() {
		if (!this.pool.size) return this.next++
		const n = [...this.pool][0]
		this.pool.delete(n)
		return n
	}
	private freeId(n: number) {
		setTimeout(() => {
			this.pool.add(n)
			while (this.pool.has(this.next - 1)) this.pool.delete(--this.next)
		}, this.poolTimeout)
	}

	public local<T extends ManageableObject>(obj: T): T {
		if (this.objectRefs.has(obj)) return obj
		const n = this.allocateId()
		const customizeObject = this.customizeObject(obj)
		this.objects[n] = new WeakRef(customizeObject)
		this.objectRefs.set(customizeObject, n)
		if (customizeObject !== obj) this.objectRefs.set(obj, n)
		this.usedBy[n] = new Set()
		return customizeObject
	}

	get(id: number) {
		const ref = this.objects[id]
		if (!ref) throw new Error(`Object ${id} not found`)
		const obj = ref.deref()
		if (!obj) throw new Error(`Object ${id} deleted`)
		return obj
	}

	sent(space: OuterSpace, obj: ManageableObject) {
		const localObject = this.local(obj),
			localId = this.objectRefs.get(localObject)!,
			alreadyUsed = this.usedBy[localId].has(space)
		if (alreadyUsed) return new ObjectReference(space, localId)
		this.usedBy[localId].add(space)
		return localObject
	}

	collectGarbage() {
		for (const id in this.objects) {
			if (this.objects[id].deref() === undefined) {
				this.freeId(Number(id))
				for (const space of this.usedBy[id]) space.freed(Number(id))
				delete this.objects[id]
			}
		}
	}
}

class ObjectReference {
	constructor(
		public readonly idSpace: IdSpace,
		public readonly id: number
	) {}
}

export abstract class OuterSpace extends IdSpace {
	abstract freed(id: number): void
	abstract getUnique<T extends ManageableObject>(id: number): Promise<T>
}
