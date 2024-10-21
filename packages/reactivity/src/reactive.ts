import { IterableWeakMap } from '@ts-meta/t-weak'
import Defer, { ContextStack, mapDefault } from './utils'
import { contentObject, ContentObject, proxyWrapper, TargetProperty } from './proxies'

class ReactivityError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'ReactivityError'
	}
}

const watchValueContext = new ContextStack<
	(target: ContentObject, propertyKey: PropertyKey) => void
>()

function ownEntries<T extends ContentObject, K extends PropertyKey & keyof T>(
	target: T
): [K, T[K]][] {
	return <[K, T[K]][]>Object.entries(target).filter(([k]) => target.hasOwnProperty(k))
}
const makeReactive = proxyWrapper(
	{
		get({ target, propertyKey, value }: TargetProperty) {
			watchValueContext.current?.(target, propertyKey)
			return value
		},
		set({ value }: TargetProperty) {
			return contentObject(value) ? reactive(value) : value
		},
		modify() {
			if (!watchValueContext.isEmpty)
				throw new ReactivityError('Cannot modify values while computing watch values')
		}
	},
	'setFirst'
)
export function reactive<T extends ContentObject>(target: T): T {
	const rv = makeReactive(target)
	if (rv !== target)
		// if a proxy has been created
		Object.assign(
			target,
			Object.fromEntries(
				ownEntries(target)
					.filter(([_, v]) => contentObject(v))
					.map(([k, v]) => [k, reactive(<ContentObject>v)])
			)
		)
	return rv
}

type ObjectWatchers = Record<PropertyKey, Set<Watch<ContentObject[], any[]>>>

const watchList = new WeakMap<ContentObject, ObjectWatchers>()
function touchProperty(target: ContentObject, propertyKey: PropertyKey) {
	const watchers = watchList.get(target)?.[propertyKey]
	if (watchers) for (const watcher of watchers) watcher.touchDefer.defer()
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
				(target, propertyKey) => {
					mapDefault(hooks, target, () => new Set()).add(propertyKey)
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

export function watch<Watched extends ContentObject, Value>(
	value: (target: Watched) => Value,
	callback: (value: Value) => void,
	...targets: Watched[]
) {}
