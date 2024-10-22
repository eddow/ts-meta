import 'reflect-metadata'
import { ReflectionKey } from '../../types'

export function metadata<DataType extends object | any[]>(
	mdKey: string,
	target: any,
	ReflectionKey: ReflectionKey | DataType,
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
	ReflectionKey?: ReflectionKey | DataType,
	defaultValue?: DataType
): Partial<DataType> {
	if (typeof ReflectionKey === 'object') {
		defaultValue = ReflectionKey
		ReflectionKey = undefined
	}
	let md: Partial<DataType> =
		ReflectionKey !== undefined
			? Reflect.getMetadata(mdKey, target, ReflectionKey)
			: Reflect.getMetadata(mdKey, target)
	if (!md) {
		if (ReflectionKey !== undefined) Reflect.defineMetadata(mdKey, (md = {}), target, ReflectionKey)
		else Reflect.defineMetadata(mdKey, (md = {}), target)
	}
	return md
}
