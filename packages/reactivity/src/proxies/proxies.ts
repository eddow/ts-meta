import {
	ContentObject,
	OrderedReactiveHandlers,
	PropertyTransaction,
	ProxyHandlers,
	ReactiveHandler,
	ValueOf
} from '../types'
import { nativeTransactions } from './natives'
import { chainGetHandlers, chainSetHandlers, tProp } from './utils'

const proxyCache = new WeakMap<any, ProxyHandlers>(),
	// We consider a prototype overriding is always for the same functions. An object is not an Array *and* a Set
	overridden = new WeakMap<any, any>()

const proxyHandler = <Obj extends ContentObject>(handlers: OrderedReactiveHandlers<Obj>) => ({
	get<Value extends ValueOf<Obj>>(
		target: Obj,
		propertyKey: PropertyKey,
		receiver: any
	): ValueOf<Obj> {
		return chainGetHandlers(
			handlers,
			tProp(target, propertyKey, <Value>Reflect.get(target, propertyKey, receiver)),
			'get'
		)?.value
	},

	set(target: Obj, propertyKey: PropertyKey, value: ValueOf<Obj>, receiver: any): boolean {
		if (Array.isArray(target)) {
			const index = Number(propertyKey)
			if (
				!Number.isNaN(index) &&
				index >= target.length &&
				!chainSetHandlers(handlers, tProp(target, 'length', index + 1), 'set')
			)
				return false
		}
		const modification = tProp(target, propertyKey, value)
		return (
			!!chainSetHandlers(handlers, modification, 'set') &&
			Reflect.set(target, modification.propertyKey, modification.value, receiver)
		)
	},

	deleteProperty(target: Obj, propertyKey: PropertyKey): boolean {
		const modification = {
			type: 'property',
			target,
			propertyKey
		}
		return (
			!!chainSetHandlers(handlers, modification, 'delete') &&
			Reflect.deleteProperty(target, modification.propertyKey)
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
			} else if (!proxyDesc.handlers[policyPositions[policy]].includes(reactiveHandler as any)) {
				proxyDesc.handlers[policyPositions[policy]].push(reactiveHandler as any)
			} else return proxyDesc.proxy.deref()! as T

			// Override native prototypes
			const native = nativeTransactions.find(({ natives }) =>
				natives.some((native) => target instanceof native)
			)
			if (native) overridePrototype(target, native.transactions)
			return proxyDesc.proxy.deref()! as T
		},
		is(target: Obj): boolean {
			const proxyDesc = proxyCache.get(target)
			return (
				!!proxyDesc &&
				Object.values(proxyDesc.handlers).some((handlers) =>
					handlers.includes(reactiveHandler as any)
				)
			)
		}
	}
}

/**
 *  `target.__proto__` becomes `overridden` where `overridden` contains all the `methods`
 *	and `overridden.__proto__` is the original `target.__proto__`
 * @param target Modified object
 * @param methods List of methods to create the prototype from
 */
function overridePrototype(target: any, methods: Record<string, (...args: any[]) => any>) {
	// TODO: add getters and setters : traverse the prototype chain to find their getOwnPropertyDescriptor
	const prototype = Object.getPrototypeOf(target)
	if (!overridden.has(prototype)) {
		const descriptors: PropertyDescriptorMap = {}
		for (const method in methods)
			descriptors[method] = {
				//prefix + method[0].toUpperCase() + method.slice(1)
				value(...args: any[]) {
					//const { target, handlers } = proxyCache.get(this)!
					return methods[method].call(proxyCache.get(this)!, prototype[method], ...args)
				}
			}
		overridden.set(prototype, Object.create(prototype, descriptors))
	}
	Object.setPrototypeOf(target, overridden.get(prototype))
}
