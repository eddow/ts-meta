import { IterableWeakMap } from '@ts-meta/t-weak'
import Defer, { ContextStack, mapDefault } from './utils'

class ReactivityError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ReactivityError'
	}
}

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

const watchValueContext = new ContextStack<
	(target: ContentObject, property: string | symbol) => void
>()

const reactiveHandler = {
	get<T extends ContentObject, K extends (string | symbol) & keyof T>(
		target: T,
		property: K,
		receiver: any
	): T[K] {
		watchValueContext.current?.(target, property)
		return Reflect.get(target, property, receiver)
	},

	set<T extends ContentObject, K extends (string | symbol) & keyof T>(
		target: T,
		property: K,
		value: T[K],
		receiver: any
	): boolean {
		if (!watchValueContext.isEmpty)
			throw new ReactivityError('Cannot modify values while computing watch values')
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
		if (!watchValueContext.isEmpty)
			throw new ReactivityError('Cannot modify values while computing watch values')
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

type ObjectWatchers = Record<string | symbol, Set<Watch<ContentObject[], any[]>>>

const watchList = new WeakMap<ContentObject, ObjectWatchers>()
function touchProperty(target: ContentObject, property: string | symbol) {
	const watchers = watchList.get(target)?.[property]
	if (watchers) for (const watcher of watchers) watcher.touchDefer.defer()
}

class WatchHooks extends IterableWeakMap<ContentObject, Set<string | symbol>> {}
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
		public readonly callback: (value: Value, oldValue: Value) => void,
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
				(target, property) => {
					mapDefault(hooks, target, () => new Set()).add(property)
				},
				() => this.valueComputer(...(<Watched>this.targets.map((target) => target.deref())))
			)
		return { hooks, value }
	}
	private touched() {
		this.unregister()
		const { hooks, value } = this.computeValue()
		this.hooks = hooks
		if (value !== this.oldValue) this.callback(value, this.oldValue)
		this.oldValue = value
		this.register()
	}
	register() {
		this.forAllHooks((watchers: Set<Watch<ContentObject[], any[]>>) =>
			watchers.add(this as unknown as Watch<object[], any[]>)
		)
	}
	unregister() {
		this.forAllHooks((watchers: Set<Watch<ContentObject[], any[]>>) =>
			watchers.delete(this as unknown as Watch<ContentObject[], any[]>)
		)
	}
	forAllHooks(cb: (value: Set<Watch<ContentObject[], any[]>>) => void) {
		for (const [target, properties] of this.hooks) {
			const objectWatchList = mapDefault(watchList, target, () => <ObjectWatchers>{})
			for (const property of properties) {
				objectWatchList[property] ??= new Set()
				cb(objectWatchList[property])
			}
		}
	}
	destroy() {
		this.unregister()
		watchFinalizationRegistry.unregister(this)
	}
}

export function watch<Watched extends ContentObject, Value>(
	value: (target: Watched) => Value,
	callback: (value: Value) => void,
	...targets: Watched[]
) {}
