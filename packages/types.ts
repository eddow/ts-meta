export type ReflectionKey = string | symbol
export type Constructor<Class extends object = any, Params extends any[] = any[]> = new (
	...args: Params
) => Class

export type PropertiesOf<T> = {
	[K in keyof T as T[K] extends Function ? never : K]: T[K]
}
