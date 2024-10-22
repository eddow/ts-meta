import { ContentObject, contentObject, proxyWrapper, TargetProperty } from './proxies'

const deltas = new WeakMap<any, Delta>()

const deltaTracking = proxyWrapper(
	{
		modify({ target, propertyKey, value }: TargetProperty) {
			deltas.get(target)!.modify({ target, propertyKey, value })
		},
		set({ target, propertyKey, value }: TargetProperty) {
			deltas.get(target)!.set({ target, propertyKey, value })
			return value
		},
		delete({ target, propertyKey, value }: TargetProperty) {
			deltas.get(target)!.delete({ target, propertyKey, value })
		}
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
	modify(tpv: TargetProperty) {}
	set({ target, propertyKey, value }: TargetProperty) {
		return value
	}
	delete(tpv: TargetProperty) {}
}

/** This function is not to be called but to test TS validation */
function typeScriptTest() {
	// @ts-expect-error
	new Delta()
}
