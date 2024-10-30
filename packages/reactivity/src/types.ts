export type ContentObject = Exclude<NonNullable<object | any[]>, RegExp>

export function contentObject(x: any): x is ContentObject {
	return typeof x === 'object' && x !== null && !(x instanceof Date) && !(x instanceof RegExp)
}

export type OrderedReactiveHandlers<Obj extends ContentObject = ContentObject> = {
	setFirst: ReactiveHandler<Obj>[]
	getFirst: ReactiveHandler<Obj>[]
	any: ReactiveHandler<Obj>[]
}

export type ProxyHandlers<Obj extends ContentObject = ContentObject> = {
	proxy: WeakRef<Obj>
	target: Obj
	handlers: OrderedReactiveHandlers<Obj>
}

export interface Transaction<Obj extends ContentObject = ContentObject> {
	type: string
	target: Obj
	value?: any
}

export type ValueOf<T> = PropertyKey extends keyof T ? T[PropertyKey] : any
export interface PropertyTransaction<
	Obj extends ContentObject = ContentObject,
	Value extends ValueOf<Obj> = ValueOf<Obj>
> extends Transaction<Obj> {
	type: 'property'
	propertyKey: PropertyKey
	value?: Value
}

export class ArrayIndexRange {
	public start: number
	public length: number
	public get end() {
		return this.start + this.length
	}
	constructor(description: { start: number; length?: number; end?: number }, arrayLength?: number) {
		const positive = (x: number) => (x < 0 ? Math.max(0, arrayLength! + x) : x)
		if (
			(description.start < 0 || ('end' in description && description.end! < 0)) &&
			arrayLength === undefined
		)
			throw new RangeError('Array length should be given if negative index are used')
		this.start = positive(description.start)
		if ('length' in description) this.length = description.length!
		else if ('end' in description) {
			let end = positive(description.end!)
			if (arrayLength !== undefined && end > arrayLength) end = arrayLength
			this.length = Math.max(0, end - this.start)
		} else this.length = 1
		if (arrayLength !== undefined && this.start + this.length > arrayLength)
			this.length = arrayLength - this.start
	}
}

export interface ArrayTransaction<Items = any, Obj extends ContentObject = Items[]>
	extends Transaction<Obj> {
	type: 'array'
	indexes: ArrayIndexRange
	value?: Items[] | Items
}

export interface SetTransaction<Items, Obj extends ContentObject = Set<Items>>
	extends Transaction<Obj> {
	type: 'set'
	value?: Items
}

export interface MapTransaction<key, Value, Obj extends ContentObject = Map<KeyAlgorithm, Value>> {
	type: 'map'
	key?: key
	value?: Value
}

export interface DateTransaction<Obj extends Date = Date> extends Transaction<Obj> {
	type: 'date'
	value: number
}

type IfArrayTransaction<Obj extends ContentObject, Returns = boolean | void> =
	Obj extends Array<infer Items> ? (transaction: ArrayTransaction<Items, Obj>) => Returns : never

/**
 * Callbacks for our proxies
 * In order to modify the value, the given argument can be modified (`consultation.value` or `modification.value`)
 */
export interface ReactiveHandler<Obj extends ContentObject> {
	/**
	 * Called on any modification
	 * @param modification The modification being effectuated
	 * @returns `false` to cancel the modification
	 */
	modify?(modification: Transaction<Obj>): boolean | void
	/**
	 * Called on any consultation
	 * @param consultation The consultation being effectuated
	 */
	consult?(consultation: Transaction<Obj>): boolean | void

	/**
	 * Check/modifies the value to affect to a field
	 * @param target Object being modified
	 * @param property Property being modified
	 * @param value New value
	 * @returns `false` to cancel the modification
	 */
	set?(modification: PropertyTransaction<Obj>): boolean | void
	/**
	 * Modifies the value retrieved
	 * @param target Object whose property is being retrieved
	 * @param property Name of the property being retrieved
	 * @param value Value retrieved until here
	 */
	get?(consultation: PropertyTransaction<Obj>): void

	/**
	 * Delete a property
	 * @param target Object whose property is being deleted
	 * @param property Name of the property being deleted
	 * @param value Current value
	 * @returns `false` to cancel the deletion
	 */
	delete?(deletion: PropertyTransaction<Obj, never>): boolean | void

	// #region Array

	arrayPush?: IfArrayTransaction<Obj>
	arrayPop?: IfArrayTransaction<Obj>
	arrayShift?: IfArrayTransaction<Obj>
	arrayUnshift?: IfArrayTransaction<Obj>
	arraySplice?: IfArrayTransaction<Obj>
	arrayFill?: IfArrayTransaction<Obj>
	arrayCopyWithin?: IfArrayTransaction<Obj>
	arrayReverse?: IfArrayTransaction<Obj>
	arraySort?: IfArrayTransaction<Obj>
	arraySlice?: IfArrayTransaction<Obj, void>

	// #endregion
	// #region Set

	setAdd?: Obj extends Set<infer Items>
		? (modification: SetTransaction<Items, Obj>) => boolean | void
		: never
	setDelete?: Obj extends Set<infer Items>
		? (modification: SetTransaction<Items, Obj>) => boolean | void
		: never
	setClear?: Obj extends Set<infer Items>
		? (modification: SetTransaction<Items, Obj>) => boolean | void
		: never
	setHas?: Obj extends Set<infer Items> ? (modification: SetTransaction<Items, Obj>) => void : never

	// #endregion
	// #region Map

	mapSet?: Obj extends Map<infer key, infer Value>
		? (modification: MapTransaction<key, Value, Obj>) => boolean | void
		: never
	mapDelete?: Obj extends Map<infer key, infer Value>
		? (modification: MapTransaction<key, Value, Obj>) => boolean | void
		: never
	mapClear?: Obj extends Map<infer key, infer Value>
		? (modification: MapTransaction<key, Value, Obj>) => void
		: never
	mapHas?: Obj extends Map<infer key, infer Value>
		? (modification: MapTransaction<key, Value, Obj>) => void
		: never
	mapGet?: Obj extends Map<infer key, infer Value>
		? (modification: MapTransaction<key, Value, Obj>) => void
		: never

	// #endregion

	alterDate?: Obj extends Date ? (modification: DateTransaction) => boolean | void : never
	readDate?: Obj extends Date ? (modification: DateTransaction) => boolean | void : never
}
