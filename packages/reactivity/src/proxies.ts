import { Constructor } from '~/types'
import { ContentObject, ReactiveHandler, TargetProperty, ValueOf } from './types'

type OrderedReactiveHandlers<Obj extends ContentObject = ContentObject> = {
	setFirst: ReactiveHandler<Obj>[]
	getFirst: ReactiveHandler<Obj>[]
	any: ReactiveHandler<Obj>[]
}
const forSet = <Obj extends ContentObject>(handlers: OrderedReactiveHandlers<Obj>) => [
		...handlers.setFirst,
		...handlers.any,
		...handlers.getFirst
	],
	forGet = <Obj extends ContentObject>(handlers: OrderedReactiveHandlers<Obj>) => [
		...handlers.getFirst,
		...handlers.any,
		...handlers.setFirst
	]

type ProxyHandlers<Obj extends ContentObject = ContentObject> = {
	proxy: WeakRef<Obj>
	target: Obj
	handlers: OrderedReactiveHandlers<Obj>
}
const proxyCache = new WeakMap<any, ProxyHandlers>()

function chainHandlers<Obj extends ContentObject>(
	handlers: ReactiveHandler<Obj>[],
	transaction: TargetProperty<Obj>,
	...calls: (keyof ReactiveHandler<Obj>)[]
) {
	for (const handler of handlers)
		for (const call of calls) if (handler?.[call]?.(transaction) === false) return false
	return true
}

const proxyHandler = <Obj extends ContentObject>(handlers: OrderedReactiveHandlers<Obj>) => ({
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
		chainHandlers(forGet(handlers), retrieval, 'get')
		return retrieval.value
	},

	set(target: Obj, propertyKey: PropertyKey, value: ValueOf<Obj>, receiver: any): boolean {
		const modification = {
			target,
			propertyKey,
			value
		}
		return (
			chainHandlers(forSet(handlers), modification, 'modify', 'set') &&
			Reflect.set(target, propertyKey, modification.value, receiver)
		)
	},

	deleteProperty(target: Obj, propertyKey: PropertyKey): boolean {
		const modification = {
			target,
			propertyKey
		}
		return (
			chainHandlers(forGet(handlers), modification, 'modify', 'delete') &&
			Reflect.deleteProperty(target, propertyKey)
		)
	}
})

const policyPositions = {
	setLast: 'getFirst',
	getFirst: 'getFirst',
	setFirst: 'setFirst',
	getLast: 'setFirst',
	any: 'any'
} as const

type nativeDescriptor<Obj extends ContentObject = ContentObject> = {
	native: Constructor<Obj>
	mutations: Record<
		string,
		(this: ProxyHandlers<Obj>, handlers: OrderedReactiveHandlers<Obj>, ...args: any[]) => any
	>
}

/**
 *
 * @param reactiveHandler
 * @param policy
 * @returns
 */
export function proxyWrapper<Obj extends ContentObject = ContentObject>(
	reactiveHandler: ReactiveHandler<Obj>,
	policy: keyof typeof policyPositions = 'any'
) {
	// TODO: all Date.set... => dateChange
	// We consider a prototype overriding is always for the same functions. An object is not an Array *and* a Set
	const overridden = new WeakMap<any, any>(),
		nativeMutations: nativeDescriptor[] = [
			{
				native: Array,
				mutations: {
					push(...args: any[]) {
						const { target, handlers } = this,
							modification = {
								target,
								propertyKey: 'push',
								value: args
							}
						if (chainHandlers(forSet(handlers), modification, 'modify', 'arrayPush'))
							return Reflect.apply(Array.prototype.push, target, args)
					},
					pop() {
						const { target, handlers } = this,
							modification = {
								target,
								propertyKey: 'pop'
							}
						if (chainHandlers(forSet(handlers), modification, 'modify', 'arrayPop'))
							return Reflect.apply(Array.prototype.pop, target, [])
					}
				}
			},
			{
				/**
				 * All Int8Array, Float32Array, ... derive from one base class
				 */
				native: Object.getPrototypeOf(Int8Array.prototype).constructor,
				mutations: {}
			},
			{ native: Set, mutations: { add(...args: any[]) {} } }
		]
	/**
	 *  `target.__proto__` becomes `overridden` where `overridden` contains all the `methods`
	 *	and `overridden.__proto__` is the original `target.__proto__`
	 * @param target Modified object
	 * @param methods List of methods to create the prototype from
	 */
	function overridePrototype(target: any, methods: Record<string, (...args: any[]) => any>) {
		const prototype = Object.getPrototypeOf(target)
		if (!overridden.has(prototype)) {
			const descriptors: PropertyDescriptorMap = {}
			for (const method in methods)
				descriptors[method] = {
					//prefix + method[0].toUpperCase() + method.slice(1)
					value(...args: any[]) {
						//const { target, handlers } = proxyCache.get(this)!
						return methods[method].call(proxyCache.get(this)!, ...args)
					}
				}
			overridden.set(prototype, Object.create(prototype, descriptors))
		}
		Object.setPrototypeOf(target, overridden.get(prototype))
	}

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
						[policyPositions[policy]]: [reactiveHandler]
					},
					proxy = new Proxy<T>(target, proxyHandler<T>(handlers))
				// Add a proxy for direct property access
				proxyDesc = {
					proxy: new WeakRef(proxy),
					target,
					handlers
				}
				proxyCache.set(target, proxyDesc)
				proxyCache.set(proxy, proxyDesc)
			} else if (!proxyDesc.handlers[policyPositions[policy]].includes(reactiveHandler)) {
				proxyDesc.handlers[policyPositions[policy]].push(reactiveHandler)
			} else return proxyDesc.proxy.deref()! as T

			// Override native prototypes
			const native = nativeMutations.find(({ native }) => target instanceof native)
			if (native) overridePrototype(target, native.mutations)
			return proxyDesc.proxy.deref()! as T
		},
		is(target: Obj): boolean {
			const proxyDesc = proxyCache.get(target)
			return (
				!!proxyDesc &&
				Object.values(proxyDesc.handlers).some((handlers) => handlers.includes(reactiveHandler))
			)
		}
	}
}
