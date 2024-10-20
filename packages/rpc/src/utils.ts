import 'reflect-metadata'

export type Constructor<Class extends object = any, Params extends any[] = any[]> = new (
	...args: Params
) => Class

export type PropertiesOf<T> = {
	[K in keyof T as T[K] extends Function ? never : K]: T[K]
}

export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	propertyKey: string | symbol | DataType,
	defaultValue?: DataType
): Partial<DataType>
export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	defaultValue?: DataType
): Partial<DataType>
export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	propertyKey?: string | symbol | DataType,
	defaultValue?: DataType
): Partial<DataType> {
	if (typeof propertyKey === 'object') {
		defaultValue = propertyKey
		propertyKey = undefined
	}
	let md: Partial<DataType> =
		propertyKey !== undefined
			? Reflect.getMetadata(mdKey, target, propertyKey)
			: Reflect.getMetadata(mdKey, target)
	if (!md) {
		if (propertyKey !== undefined) Reflect.defineMetadata(mdKey, (md = {}), target, propertyKey)
		else Reflect.defineMetadata(mdKey, (md = {}), target)
	}
	return md
}
