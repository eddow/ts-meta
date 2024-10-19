interface ObjectAllocator {
	weakRef: WeakRef<any>
	id: number
}

export class numberPool {
	private next = 1
	private readonly pool = new Set<number>()
	private readonly objects: ObjectAllocator[] = []
	allocate(): number {
		if (!this.pool.size) return this.next++
		const n = [...this.pool][0]
		this.pool.delete(n)
		return n
	}
	free(n: number) {
		this.pool.add(n)
		while (this.pool.has(this.next - 1)) this.pool.delete(--this.next)
	}
	allocateForObject(obj: NonNullable<object>): number {
		const n = this.allocate()
		this.objects.push({ weakRef: new WeakRef(obj), id: n })
		return n
	}
	checkObjects() {
		for (let i = 0; i < this.objects.length; i++) {
			const { weakRef, id } = this.objects[i]
			if (weakRef.deref() === undefined) {
				this.free(id)
				this.objects.splice(i, 1)
				i--
			}
		}
	}
}

export type NoParamConstructor<T = any> = new () => T

export type PropertiesOf<T> = {
	[K in keyof T as T[K] extends Function ? never : K]: T[K]
}

export function initialized<T extends object>(
	target: NoParamConstructor<T>,
	values: PropertiesOf<T>
): T {
	return Object.assign(new target(), values)
}

export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	propertyKey: string | symbol | DataType,
	defaultValue?: DataType
): Partial<DataType>
export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	defaultValue?: DataType
): Partial<DataType>
export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	propertyKey?: string | symbol | DataType,
	defaultValue?: DataType
): Partial<DataType> {
	if (typeof propertyKey === 'object') {
		defaultValue = propertyKey
		propertyKey = undefined
	}
	let md: Partial<DataType> =
		propertyKey !== undefined
			? Reflect.getMetadata(mdKey, target, propertyKey)
			: Reflect.getMetadata(mdKey, target)
	if (!md) {
		if (propertyKey !== undefined) Reflect.defineMetadata(mdKey, (md = {}), target, propertyKey)
		else Reflect.defineMetadata(mdKey, (md = {}), target)
	}
	return md
}
