import { proxyWrapper } from './proxies/proxies'
import { ContentObject, PropertyTransaction, Transaction } from './types'

const deltas = new WeakMap<any, Delta>()

const deltaTracking = proxyWrapper(
	{
		/*modify({ target, propertyKey, value }: Transaction) {
			deltas.get(target)!.modify({ target, propertyKey, value })
		},
		set({ target, propertyKey, value }: Transaction) {
			deltas.get(target)!.set({ target, propertyKey, value })
			return value
		},
		delete({ target, propertyKey, value }: Transaction) {
			deltas.get(target)!.delete({ target, propertyKey, value })
		}*/
	},
	'setLast'
)

/**
 * All Int8Array, Float32Array, ... derive from one base class
 */
const TypeSizeArray = Object.getPrototypeOf(Int8Array.prototype).constructor

class Delta<Obj extends ContentObject = ContentObject> {
	static from<Obj extends ContentObject>(target: Obj) {}
	private wrTarget: WeakRef<ContentObject>
	protected get target() {
		return this.wrTarget.deref()!
	}
	constructor(target: Obj) {
		this.wrTarget = new WeakRef(target)
	}
	modify(tpv: Transaction<Obj>) {}
	set({ target, propertyKey, value }: PropertyTransaction<Obj>) {
		return value
	}
	delete(tpv: Transaction<Obj>) {}
}

/** This function is not to be called but to test TS validation */
function typeScriptTest() {
	// @ts-expect-error
	new Delta()
}

/*

			push(native: (...args: any) => any, ...args: any[]) {
				const { target, handlers } = this,
					modification = {
						type: 'array',
						target,
						index: target.length,
						original: [],
						update: args
					}
				if (chainSetHandlers(handlers, modification, 'arrayPush'))
					return Reflect.apply(native, target, args)
			},
			pop(native: (...args: any) => any) {
				if (!this.target.length) return
				const { target, handlers } = this,
					orgVal = target[target.length - 1],
					modification = {
						type: 'array',
						target,
						index: target.length - 1,
						original: [orgVal],
						update: [],
						value: orgVal
					}
				if (chainGetHandlers(handlers, modification, 'get', 'arrayPop')) {
					Reflect.apply(native, target, [])
					return modification.value
				}
			},
			unshift(native: (...args: any) => any, ...args: any[]) {
				const { target, handlers } = this,
					modification = {
						type: 'array',
						target,
						index: 0,
						original: [],
						update: args
					}
				if (chainSetHandlers(handlers, modification, 'arrayUnshift'))
					return Reflect.apply(native, target, args)
			},
			shift(native: (...args: any) => any) {
				if (!this.target.length) return
				const { target, handlers } = this,
					orgVal = target[0],
					modification = {
						type: 'array',
						target,
						index: 0,
						original: [orgVal],
						update: [],
						value: orgVal
					}
				if (chainGetHandlers(handlers, modification, 'get', 'arrayShift')) {
					Reflect.apply(native, target, [])
					return modification.value
				}
			},
			splice(native: (...args: any) => any, start: number, deleteCount?: number, ...args: any[]) {
				const { target, handlers } = this
				if (start === undefined) start = 0
				if (start < 0) start = Math.max(0, target.length + start)
				if (start > target.length) start = target.length
				if (deleteCount === undefined) deleteCount = target.length - start
				if (deleteCount < 0) deleteCount = 0
				if (start + deleteCount > target.length) deleteCount = target.length - start
				const original = target.slice(start, start + deleteCount),
					modification = {
						type: 'array',
						target,
						index: start,
						original,
						update: args,
						value: original
					}
				if (chainSetHandlers(handlers, modification, 'arraySplice'))
					return Reflect.apply(native, target, args)
			},
			fill(native: (...args: any) => any, value: any, start?: number, end?: number) {
				const { target, handlers } = this
				if (start === undefined) start = 0
				if (start < 0) start = Math.max(0, target.length + start)
				if (start >= target.length) return
				if (end === undefined) end = target.length
				if (end < 0) end = Math.max(0, target.length + end)
				if (end > target.length) end = target.length
				if (end < start) return
				const original = target.slice(start, end),
					modification = {
						type: 'array',
						target,
						index: start,
						original,
						update: Array(original.length).fill(value),
						value
					}
				if (chainSetHandlers(handlers, modification, 'arrayFill'))
					return Reflect.apply(native, target, [value])
			},
			copyWithin(native: (...args: any) => any, targetIndex: number, start: number, end?: number) {
				const { target, handlers } = this
				if (targetIndex === undefined) start = 0
				if (targetIndex < 0) targetIndex = Math.max(0, target.length + targetIndex)
				if (targetIndex >= target.length) return
				if (start === undefined) start = 0
				if (start < 0) start = Math.max(0, target.length + start)
				if (start >= target.length) return
				if (end === undefined) end = target.length
				if (end < 0) end = Math.max(0, target.length + end)
				if (end > target.length) end = target.length
				if (end < start) return
				const source = target.slice(start, end),
					modification = {
						type: 'array',
						target,
						index: targetIndex,
						original: source,
						update: target.slice(targetIndex, targetIndex + source.length),
						value: source
					}
				if (chainSetHandlers(handlers, modification, 'arrayCopyWithin'))
					return Reflect.apply(native, target, [targetIndex, start, end])
			},
*/
