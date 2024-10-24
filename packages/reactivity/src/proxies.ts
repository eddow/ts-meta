export type ContentObject = Exclude<Exclude<NonNullable<object>, Date>, RegExp>

export function contentObject(x: any): x is ContentObject {
	return typeof x === 'object' && x !== null && !(x instanceof Date) && !(x instanceof RegExp)
}

export let cancelModification = Symbol('Cancel the modification')

export type TargetProperty<
	Obj extends ContentObject = ContentObject,
	Value extends ValueOf<Obj> = ValueOf<Obj>
> = {
	target: Obj
	propertyKey: PropertyKey
	value: Value
}

type ValueOf<T> = PropertyKey extends keyof T ? T[PropertyKey] : any
/**
 * Callbacks for our proxies
 */
interface ProxyHandler<Obj extends ContentObject> {
	/**
	 * Called on any modification (set, delete)
	 * @param target Object being modified
	 * @param property Property being modified
	 * @param value Current value
	 */
	modify?<Value extends ValueOf<Obj>>(modification: TargetProperty<Obj, Value>): void

	/**
	 * Check/modifies the value to affect to a field
	 * @param target Object being modified
	 * @param property Property being modified
	 * @param value New value
	 */
	set?<Value extends ValueOf<Obj>>(modification: TargetProperty<Obj, Value>): Value
	/**
	 * Modifies the value retrieved
	 * @param target Object whose property is being retrieved
	 * @param property Name of the property being retrieved
	 * @param value Value retrieved until here
	 */
	get?<Value extends ValueOf<Obj>>(retrieval: TargetProperty<Obj, Value>): Value

	/**
	 * Delete a property
	 * @param target Object whose property is being deleted
	 * @param property Name of the property being deleted
	 */
	delete?<Value extends ValueOf<Obj>>(deletion: TargetProperty<Obj, Value>): void
}

type OrderedProxyHandlers<Obj extends ContentObject = ContentObject> = {
	setFirst: ProxyHandler<Obj>[]
	getFirst: ProxyHandler<Obj>[]
	any: ProxyHandler<Obj>[]
}
const forSet = <Obj extends ContentObject>(handlers: OrderedProxyHandlers<Obj>) => [
		...handlers.setFirst,
		...handlers.any,
		...handlers.getFirst
	],
	forGet = <Obj extends ContentObject>(handlers: OrderedProxyHandlers<Obj>) => [
		...handlers.getFirst,
		...handlers.any,
		...handlers.setFirst
	]

type ProxyHandlers<Obj extends ContentObject = ContentObject> = {
	proxy: WeakRef<Obj>
	handlers: OrderedProxyHandlers<Obj>
}
const proxyCache = new WeakMap<any, ProxyHandlers>()

const reactiveHandler = <Obj extends ContentObject>(handlers: OrderedProxyHandlers<Obj>) => ({
	get<Value extends ValueOf<Obj>>(
		target: Obj,
		propertyKey: PropertyKey,
		receiver: any
	): ValueOf<Obj> {
		const retrieval = {
			target,
			propertyKey,
			value: <Value>Reflect.get(target, propertyKey, receiver)
		}
		for (const handler of forGet(handlers))
			if (handler.get) retrieval.value = handler.get(retrieval)
		return retrieval.value
	},

	set(target: Obj, propertyKey: PropertyKey, value: ValueOf<Obj>, receiver: any): boolean {
		const modification = {
			target,
			propertyKey,
			value
		}
		try {
			for (const handler of forSet(handlers)) {
				if (handler.modify) handler.modify(modification)
				if (handler.set) modification.value = handler.set(modification)
			}
		} catch (e) {
			if (e !== cancelModification) throw e
		}
		return Reflect.set(target, propertyKey, modification.value, receiver)
	},

	deleteProperty(target: Obj, propertyKey: PropertyKey): boolean {
		const retrieval = {
			target,
			propertyKey,
			value: <ValueOf<Obj>>Reflect.get(target, propertyKey)
		}
		try {
			for (const handler of forGet(handlers)) {
				if (handler.get) retrieval.value = handler.get(retrieval)
				if (handler.modify) handler.modify(retrieval)
				if (handler.delete) handler.delete(retrieval)
			}
		} catch (e) {
			if (e !== cancelModification) throw e
		}
		return Reflect.deleteProperty(target, propertyKey)
	}
})

const policyPositions = {
	setLast: 'getFirst',
	getFirst: 'getFirst',
	setFirst: 'setFirst',
	getLast: 'setFirst',
	any: 'any'
} as const

/**
 *
 * @param proxyHandler
 * @param policy
 * @returns
 */
export function proxyWrapper<Obj extends ContentObject = ContentObject>(
	proxyHandler: ProxyHandler<Obj>,
	policy: keyof typeof policyPositions = 'any'
) {
	return {
		/**
		 * Get the wrapped version of the target - whether the target is already wrapped, has already been wrapped or not
		 * @param target
		 * @returns
		 */
		be<T extends Obj>(target: T): T {
			let proxyDesc = proxyCache.get(target)
			if (!proxyDesc) {
				const handlers = {
					...{ setFirst: [], getFirst: [], any: [] },
					[policyPositions[policy]]: [proxyHandler]
				}
				proxyDesc = {
					proxy: new WeakRef(new Proxy<T>(target, reactiveHandler<T>(handlers))),
					handlers
				}
				proxyCache.set(target, proxyDesc)
				proxyCache.set(proxyDesc, proxyDesc)
			} else if (!proxyDesc.handlers[policyPositions[policy]].includes(proxyHandler)) {
				proxyDesc.handlers[policyPositions[policy]].push(proxyHandler)
			}
			return proxyDesc.proxy.deref()! as T
		},
		is(target: Obj): boolean {
			const proxyDesc = proxyCache.get(target)
			return (
				!!proxyDesc &&
				Object.values(proxyDesc.handlers).some((handlers) => handlers.includes(proxyHandler))
			)
		}
	}
}

// We consider a prototype overriding is always for the same functions. An object is not an Array *and* a Set
const overridden = new WeakMap<any, any>()
/**
 *  `target.__proto__` becomes `overriden` where `overridden` contains all the `methods`
 *	and `overridden.__proto__` is the original `target.__proto__`
 * @param target Modified object
 * @param methods List of methods to create the prototype from
 */
function overridePrototype(target: any, native: any, methods: string[]) {
	const prototype = Object.getPrototypeOf(target)
	if (!overridden.has(prototype)) {
		const descriptors: PropertyDescriptorMap = {},
			unWeak = /(?:Weak(.*))|.*/.exec(native.name)!,
			prefix = (unWeak[1] || unWeak[0]).toLowerCase()
		for (const method of methods)
			descriptors['mutate' + method[0].toUpperCase() + method.slice(1)] = {
				value: function (...args: any[]) {
					//;(deltas.get(target) as any)[method](...args)
					return native.prototype[method].apply(this, args)
				}
			}
		overridden.set(prototype, Object.create(prototype, descriptors))
	}
	Object.setPrototypeOf(target, overridden.get(prototype))
}
