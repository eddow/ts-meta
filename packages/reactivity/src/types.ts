export type ContentObject = Exclude<Exclude<NonNullable<object>, Date>, RegExp>

export function contentObject(x: any): x is ContentObject {
	return typeof x === 'object' && x !== null && !(x instanceof Date) && !(x instanceof RegExp)
}

export type TargetProperty<
	Obj extends ContentObject = ContentObject,
	Value extends ValueOf<Obj> = any //ValueOf<Obj> (push -> ...args[])
> = {
	target: Obj
	propertyKey: PropertyKey
	value?: Value
}

export type ValueOf<T> = PropertyKey extends keyof T ? T[PropertyKey] : any
/**
 * Callbacks for our proxies
 * In order to modify the value, the given argument can be modified (`retrieval.value` or `modification.value`)
 */
export interface ReactiveHandler<Obj extends ContentObject> {
	/**
	 * Called on any modification (set, delete)
	 * @param target Object being modified
	 * @param property Property being modified
	 * @returns `false` to cancel the modification
	 */
	modify?<Value extends ValueOf<Obj>>(modification: TargetProperty<Obj, Value>): boolean | void

	/**
	 * Check/modifies the value to affect to a field
	 * @param target Object being modified
	 * @param property Property being modified
	 * @param value New value
	 * @returns `false` to cancel the modification
	 */
	set?<Value extends ValueOf<Obj>>(modification: TargetProperty<Obj, Value>): boolean | void
	/**
	 * Modifies the value retrieved
	 * @param target Object whose property is being retrieved
	 * @param property Name of the property being retrieved
	 * @param value Value retrieved until here
	 */
	get?<Value extends ValueOf<Obj>>(retrieval: TargetProperty<Obj, Value>): void

	/**
	 * Delete a property
	 * @param target Object whose property is being deleted
	 * @param property Name of the property being deleted
	 * @param value Current value
	 * @returns `false` to cancel the deletion
	 */
	delete?<Value extends ValueOf<Obj>>(deletion: TargetProperty<Obj, Value>): boolean | void

	arrayPush?<Value extends ValueOf<Obj>>(modification: TargetProperty<Obj, Value>): boolean | void
	arrayPop?<Value extends ValueOf<Obj>>(modification: TargetProperty<Obj, Value>): boolean | void
}
