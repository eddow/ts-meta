import { IterableWeakMap } from '@ts-meta/t-weak'
import { Defer, ContextStack, mapDefault } from '@ts-meta/utilities'
import { proxyWrapper } from './proxies'
import { contentObject, ContentObject, TargetProperty } from './types'

class ReactivityError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ReactivityError'
	}
}
function customClone(value: any, cb: (value: any) => any) {
	if (!value || typeof value !== 'object') return value
	const clone = Object.create(Object.getPrototypeOf(value))
	for (const [key, val] of ownEntries(value)) clone[key] = cb(val)
	return clone
}
function weaken(value: any) {
	return reactivity.is(value) ? new WeakRef(value) : customClone(value, weaken)
}
function toughen(value: any) {
	return value instanceof WeakRef ? value.deref() : customClone(value, toughen)
}

const watchValueContext = new ContextStack<
	(target: ContentObject, propertyKey: PropertyKey) => void
>()

function ownEntries<T extends ContentObject, K extends PropertyKey & keyof T>(
	target: T
): [K, T[K]][] {
	return <[K, T[K]][]>Object.entries(target).filter(([k]) => target.hasOwnProperty(k))
}
const reactivity = proxyWrapper(
	{
		get({ target, propertyKey, value }: TargetProperty) {
			watchValueContext.current?.(target, propertyKey)
			return value
		},
		set({ value }: TargetProperty) {
			return contentObject(value) ? reactive(value) : value
		},
		modify({ target, propertyKey }: TargetProperty) {
			if (!watchValueContext.isEmpty)
				throw new ReactivityError('Cannot modify values while computing watch values')
			touchObject(target, propertyKey)
		}
	},
	'setFirst'
)
export function reactive<T extends ContentObject>(target: T): T {
	const wasReactive = reactivity.is(target),
		rv = reactivity.be(target)
	if (!wasReactive)
		// if a proxy has been created
		Object.assign(
			target,
			//Make all props reactive recursively
			Object.fromEntries(
				ownEntries(target)
					.filter(([_, v]) => contentObject(v))
					.map(([k, v]) => [k, reactive(<ContentObject>v)])
			)
		)
	return rv
}

type ObjectWatchers = Record<PropertyKey, Set<Watch<ContentObject[], any[]>>>
// TODO: Should be able to watch the whole object (ex. array.indexOf())
// TODO: Force scope-less value functions
// TODO: optional deep comparison
const watchList = new WeakMap<ContentObject, ObjectWatchers>()
function touchObject(target: ContentObject, propertyKey?: PropertyKey) {
	const objectWatchers = watchList.get(target)
	if (!objectWatchers) return
	const watchers =
		propertyKey !== undefined
			? // Touch only one property
				objectWatchers[propertyKey]
			: // Touch all properties
				Object.values(objectWatchers).reduce(
					(previous, current) => previous.union(current),
					new Set<Watch<ContentObject[], any[]>>()
				)
	for (const watcher of watchers) watcher.touchDefer.defer()
}

class WatchHooks extends IterableWeakMap<ContentObject, Set<PropertyKey>> {}
const watchFinalizationRegistry = new FinalizationRegistry((watch: Watch) => {
	// Note: when unregister-ing, the engine doesn't reference the watch anymore
	watch.unregister()
})
class Watch<Watched extends ContentObject[] = ContentObject[], Value extends any = any> {
	private readonly targets: WeakRef<ContentObject>[]
	private oldValue: Value
	private hooks: WatchHooks
	public touchDefer: Defer

	constructor(
		public readonly valueComputer: (...targets: Watched) => Value,
		public readonly callback: (value: Value, oldValue: Value, ...targets: Watched) => void,
		...targets: Watched
	) {
		this.touchDefer = new Defer(() => this.touched())
		this.targets = targets.map((target) => new WeakRef(target))
		for (const target of targets) {
			watchFinalizationRegistry.register(
				target,
				this as unknown as Watch<ContentObject[], any[]>,
				this
			)
		}
		const { hooks, value } = this.computeValue()
		this.hooks = hooks
		this.oldValue = value
	}
	private computeValue() {
		const hooks = new WatchHooks(),
			value = watchValueContext.with(
				(target, propertyKey) => {
					mapDefault(hooks, target, () => new Set()).add(propertyKey)
				},
				() => this.valueComputer(...(<Watched>this.targets.map((target) => target.deref())))
			)
		return { hooks, value }
	}
	// Should be deferred: actually calls the callback if the computed value is not exactly the same
	private touched() {
		this.unregister()
		const { hooks, value } = this.computeValue()
		this.hooks = hooks
		if (value !== this.oldValue)
			this.callback(
				value,
				this.oldValue,
				...(<Watched>this.targets.map((target) => target.deref()))
			)
		this.oldValue = value
		this.register()
	}
	// Add all local hooks to the global watch list
	register() {
		this.forAllHooks((watchers: Set<Watch<ContentObject[], any[]>>) =>
			watchers.add(this as unknown as Watch<object[], any[]>)
		)
	}
	// Remove all local hooks to the global watch list
	unregister() {
		this.forAllHooks((watchers: Set<Watch<ContentObject[], any[]>>) =>
			watchers.delete(this as unknown as Watch<ContentObject[], any[]>)
		)
	}
	forAllHooks(cb: (value: Set<Watch<ContentObject[], any[]>>) => void) {
		for (const [target, properties] of this.hooks) {
			const objectWatchList = mapDefault(watchList, target, () => <ObjectWatchers>{})
			for (const propertyKey of properties) {
				objectWatchList[propertyKey] ??= new Set()
				cb(objectWatchList[propertyKey])
			}
		}
	}
	destroy() {
		this.unregister()
		watchFinalizationRegistry.unregister(this)
	}
}

/* TODO: target becomes the first argument :
- reactive: weakRef to it
- pure object/array: weakRef to its components, make it an argument
*/
export function watch<Watched extends ContentObject[], Value>(
	value: (...target: Watched) => Value,
	callback: (value: Value, oldValue: Value, ...targets: Watched) => void,
	...targets: Watched
) {
	const watch = new Watch(value, callback, ...targets)
	watch.register()
	return watch
}
