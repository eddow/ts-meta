import { IterableWeakMap } from './iterableWeak'

type ContentObject = Exclude<Exclude<NonNullable<object>, Date>, RegExp>

function contentObject(x: any): x is ContentObject {
	return typeof x === 'object' && x !== null && !(x instanceof Date) && !(x instanceof RegExp)
}

const proxyCache = new WeakMap<any, any>(),
	parentsList = new WeakMap<object, IterableWeakMap<ContentObject, string | symbol>>()
function legacy(target: ContentObject) {
	const legacy = parentsList.get(target) ?? new IterableWeakMap()
	parentsList.set(target, legacy)
	return legacy
}

const reactiveHandler = {
	get<T extends ContentObject, K extends (string | symbol) & keyof T>(
		target: T,
		property: K,
		receiver: any
	): T[K] {
		return Reflect.get(target, property, receiver)
	},

	set<T extends ContentObject, K extends (string | symbol) & keyof T>(
		target: T,
		property: K,
		value: T[K],
		receiver: any
	): boolean {
		if (contentObject(target[property])) legacy(target[property]).delete(target)
		if (contentObject(value)) {
			value = reactive(value)
			legacy(<ContentObject>value).set(target, property)
		}
		return Reflect.set(target, property, value, receiver)
	},

	deleteProperty<T extends ContentObject, K extends (string | symbol) & keyof T>(
		target: T,
		property: K
	): boolean {
		if (contentObject(target[property])) legacy(target[property]).delete(target)
		return Reflect.deleteProperty(target, property)
	}
}

function ownEntries<T extends ContentObject, K extends (string | symbol) & keyof T>(
	target: T
): [K, T[K]][] {
	return <[K, T[K]][]>Object.entries(target).filter(([k]) => target.hasOwnProperty(k))
}

export function reactive<T extends ContentObject>(target: T): T {
	if (proxyCache.has(target)) return proxyCache.get(target)
	Object.assign(
		target,
		Object.fromEntries(
			ownEntries(target)
				.filter(([_, v]) => contentObject(v))
				.map(([k, v]) => [k, reactive(<ContentObject>v)])
		)
	)
	const rv = new Proxy<T>(target, reactiveHandler)
	proxyCache.set(target, rv)
	proxyCache.set(rv, rv)
	return rv
}

class Watch<Watched extends ContentObject, Value> {
	constructor(
		public readonly value: (target: Watched) => Value,
		public readonly callback: (value: Value) => void
	) {}
}

const watchList = new WeakMap<ContentObject, Set<Watch<ContentObject, any>>>()

export function watch<Watched extends ContentObject, Value>(
	target: Watched,
	value: (target: Watched) => Value,
	callback: (value: Value) => void
) {
	if (!watchList.has(target)) watchList.set(target, new Set())
	;(<Set<Watch<Watched, Value>>>watchList.get(target)!).add(new Watch(value, callback))
}
