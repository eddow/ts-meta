import { ReflectionKey } from '~/types'

export type EventParams<Details = any> = Details extends void ? [] : [Details]
export type EventCB<Details = any> = Details extends void
	? () => void
	: ((details: Details) => void) | (() => void)
export type EventDetailList<Details = any> = Record<ReflectionKey, Details>

export type DetailedFunctions<T> = Partial<{
	[K in keyof T]: (details: T[K]) => void
}>
export type EventPropertyDescriptor<Details> =
	| TypedPropertyDescriptor<EventCB<Details>>
	| TypedPropertyDescriptor<EventCB<void>>

export type EventDecorator<Event, Details> = (
	target: Object,
	propertyKey: Event,
	descriptor: EventPropertyDescriptor<Details>
) => void
