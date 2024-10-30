export type NoParamConstructor<T = any> = new () => T

/* TODO allow recursive type description + check recursive types
 * + check recursive objects!
 */
// TODO path + error reporting
interface ObjectDefinition {
	[key: string]: TypeDefinition
}
export type TypeDefinition =
	| ComplexTypeDefinition
	| NoParamConstructor
	| undefined
	| null
	| boolean
	| number
	| string
	| symbol
	| bigint
	| ObjectDefinition
	| TypeDefinition[]

// #region Errors

export abstract class TypeErrorDesc<TD extends TypeDefinition = TypeDefinition> extends Error {
	constructor(
		message: string,
		public readonly value: any,
		public readonly type: TD
	) {
		super(message)
	}
}

/**
 * Hard comparison
 * example: `Number`, `MyClass`
 */
export class GivenTypeErrorDesc<
	TD extends TypeDefinition = TypeDefinition
> extends TypeErrorDesc<TD> {}
export class SpecifiedTypeErrorDesc<
	T,
	TD extends TypeDefinition = TypeDefinition
> extends TypeErrorDesc<TD> {
	constructor(
		message: string,
		value: any,
		type: TD,
		public readonly spec: T
	) {
		super(message, value, type)
	}
}
export class SubTypeErrorDesc<
	T = never,
	TD extends TypeDefinition = TypeDefinition
> extends SpecifiedTypeErrorDesc<T, TD> {
	constructor(
		message: string,
		value: any,
		type: TD,
		public readonly sub: TypeError,
		spec: T
	) {
		super(message, value, type, spec)
	}
}

export class AndTypeErrorDesc extends SubTypeErrorDesc<number, AndTypeDefinition> {}
export class OrTypeErrorDesc extends SpecifiedTypeErrorDesc<TypeError[], OrTypeDefinition> {}
export class ArrayTypeErrorDesc extends SubTypeErrorDesc<number> {}
export class SizeTypeErrorDesc extends SpecifiedTypeErrorDesc<{ min: number; max?: number }> {}
export class LiteralTypeErrorDesc extends TypeErrorDesc<LiteralTypeDefinition> {}
export class ObjectTypeErrorDesc extends SubTypeErrorDesc<string> {}

type TypeError = TypeErrorDesc | undefined

// #endregion

abstract class ComplexTypeDefinition {
	abstract check(value: any): TypeError
}

// #region Hard coded

export class HardCodedTypeDefinition extends ComplexTypeDefinition {
	constructor(
		public name: string,
		public check: (value: any) => TypeError
	) {
		super()
	}
}

export const any = new HardCodedTypeDefinition('any', () => undefined),
	never = new HardCodedTypeDefinition(
		'never',
		(value: any): TypeError => new GivenTypeErrorDesc('Unexpected value', value, never)
	)

// #endregion
// #region Complex types

export class OrTypeDefinition extends ComplexTypeDefinition {
	constructor(public readonly alternatives: ComplexTypeDefinition[]) {
		super()
		let literals: any[] | null = null
		for (let i = 0; i < alternatives.length; i++) {
			const alternative = alternatives[i]
			if (alternative instanceof OrTypeDefinition) {
				this.alternatives = this.alternatives.concat(alternative.alternatives)
				this.alternatives.splice(i--, 1)
			} else if (alternative instanceof LiteralTypeDefinition) {
				if (literals === null) literals = []
				literals.push(...alternative.values)
				this.alternatives.splice(i--, 1)
			}
		}
		if (literals !== null) this.alternatives.push(new LiteralTypeDefinition(...literals))
	}

	check(value: any): TypeError {
		const rv: TypeError[] = []
		for (const alternative of this.alternatives) {
			const error = typeError(value, alternative)
			if (error) rv.push(error)
			else return
		}
		return new OrTypeErrorDesc('No option fitting', value, this, rv)
	}
}

export class AndTypeDefinition extends ComplexTypeDefinition {
	constructor(public readonly alternatives: ComplexTypeDefinition[]) {
		super()
		for (let i = 0; i < alternatives.length; i++) {
			const alternative = alternatives[i]
			if (alternative instanceof AndTypeDefinition) {
				this.alternatives = this.alternatives.concat(alternative.alternatives)
				this.alternatives.splice(i--, 1)
			}
		}
	}

	check(value: any): TypeError {
		return firstError(
			this.alternatives,
			(item) => typeError(value, item),
			({ error, index }) => new AndTypeErrorDesc('Option not fitting', value, this, error, index)
		)
	}
}

export class LiteralTypeDefinition extends ComplexTypeDefinition {
	public readonly values: any[]
	constructor(...values: any[]) {
		super()
		this.values = values
	}

	check(value: any): TypeError {
		return guarded(
			this.values.includes(value),
			() => new LiteralTypeErrorDesc('Unexpected value', value, this)
		)
	}
}

export class ArrayTypeDefinition extends ComplexTypeDefinition {
	constructor(public readonly items: TypeDefinition) {
		super()
	}

	check(value: any): TypeError {
		if (!Array.isArray(value)) return new GivenTypeErrorDesc('Not an array', value, this)
		if (this.items === any) return undefined
		if (this.items === never && value.length > 0)
			return new GivenTypeErrorDesc('No entries allowed', value, this)
		return firstError(
			value,
			(item) => typeError(item, this.items),
			({ index, error }) => new ArrayTypeErrorDesc('Wrong array entry', value, this, error, index)
		)
	}
}

type ObjectTypeOptions = {
	/**
	 * If true, the object can be null
	 */
	readonly nullable: boolean
	/**
	 * If true, the object can have additional properties
	 */
	readonly others: TypeDefinition
}

/**
 * Default object options when not specified
 */
export let defaultObjectOptions: ObjectTypeOptions = {
	nullable: false,
	others: never
}

export class ObjectTypeDefinition extends ComplexTypeDefinition {
	constructor(
		public readonly properties: ObjectDefinition,
		public readonly options?: Partial<ObjectTypeOptions>
	) {
		super()
	}

	check(value: any): TypeError {
		const options: ObjectTypeOptions = this.options
			? <ObjectTypeOptions>(
					Object.fromEntries(
						Object.entries(defaultObjectOptions).map(([key, defaultValue]) => [
							key,
							(<any>this.options)[key] ?? defaultValue
						])
					)
				)
			: defaultObjectOptions
		return value === null
			? // Nullable or not
				guarded(options.nullable, () => new GivenTypeErrorDesc('Unexpected `null`', value, this))
			: // Pure object
				guarded(
					pureObject(value),
					() => new GivenTypeErrorDesc('Not a pure `Object`', value, this)
				) ||
					// Check described properties
					firstError(
						Object.entries(this.properties),
						([key, typeDef]) => typeError(value[key], typeDef),
						({ item: [key], error }) =>
							new ObjectTypeErrorDesc('Wrong specified property', value, this, error, key)
					) ||
					// Check additional properties
					guarded(options.others === any, () =>
						firstError(
							Object.entries(value),
							([key, value]) => !(key in this.properties) && typeError(value, options.others),
							({ item: [key], error }) =>
								new ObjectTypeErrorDesc('Wrong other property', value, this, error, key)
						)
					)
	}
}

export class TupleTypeDefinition extends ComplexTypeDefinition {
	constructor(
		public readonly mandatory: TypeDefinition[],
		public readonly optional?: TypeDefinition[],
		public readonly rest?: TypeDefinition
	) {
		super()
	}

	check(value: any): TypeError {
		const restPosition = this.mandatory.length + (this.optional?.length ?? 0)
		return (
			// Check it is an array
			guarded(Array.isArray(value), () => new GivenTypeErrorDesc('Not a tuple', value, this)) ||
			// Check the length
			guarded(
				(!!this.rest || value.length <= restPosition) && value.length >= this.mandatory.length,
				() =>
					new SizeTypeErrorDesc(
						`Tuple length error`,
						value,
						this,
						this.rest
							? {
									min: this.mandatory.length
								}
							: {
									min: this.mandatory.length,
									max: restPosition
								}
					)
			) ||
			// Check the mandatory entries
			firstError(
				this.mandatory,
				(mandatory, i) => typeError(value[i], mandatory),
				({ error, index }) =>
					new ArrayTypeErrorDesc(`Wrong mandatory tuple entry`, value, this, error, index)
			) ||
			// Check the optional entries
			(this.optional &&
				firstError(
					this.optional.slice(0, value.length - this.mandatory.length),
					(optional, i) => {
						const index = i + this.mandatory.length
						return typeError(value[index], optional)
					},
					({ error, index }) =>
						new ArrayTypeErrorDesc(
							`Wrong optional tuple entry`,
							value,
							this,
							error,
							index + this.mandatory.length
						)
				)) ||
			// Check the rest
			guarded(value.length <= restPosition, () =>
				firstError(
					value.slice(restPosition),

					(rest) => typeError(rest, this.rest!),

					({ error, index }) =>
						new ArrayTypeErrorDesc(
							`Wrong rest tuple entry`,
							value,
							this,
							error,
							index + restPosition
						)
				)
			)
		)
	}
}

const primitiveTypes: { [key: string]: NoParamConstructor } = {
	boolean: Boolean,
	number: Number,
	string: String,
	bigint: Number
}
class PrimitiveTypeDefinition extends ComplexTypeDefinition {
	public static readonly number = new PrimitiveTypeDefinition(Number)
	public static readonly string = new PrimitiveTypeDefinition(String)
	public static readonly boolean = new PrimitiveTypeDefinition(Boolean)

	private constructor(public readonly type: any) {
		super()
	}
	check(value: any): TypeError {
		const type = primitiveTypes[typeof value]
		return guarded(
			type === this.type,
			() => new GivenTypeErrorDesc('Wrong primitive', value, this.type)
		)
	}
}

class InstanceTypeDefinition extends ComplexTypeDefinition {
	constructor(public readonly type: NoParamConstructor) {
		super()
	}
	check(value: any): TypeError {
		return guarded(
			value instanceof this.type,
			() => new GivenTypeErrorDesc('Wrong class', value, this.type)
		)
	}
}
const primitiveTypeDefinition = new Map<NoParamConstructor, PrimitiveTypeDefinition>([
	[Number, PrimitiveTypeDefinition.number],
	[String, PrimitiveTypeDefinition.string],
	[Boolean, PrimitiveTypeDefinition.boolean]
])
// #endregion
// #region factories

export function or(...alternatives: TypeDefinition[]): ComplexTypeDefinition {
	const rv = new OrTypeDefinition(alternatives.map(typeShortcut))
	return rv.alternatives.length === 1 ? rv.alternatives[0] : rv
}

export function and(...alternatives: TypeDefinition[]): ComplexTypeDefinition {
	const rv = new AndTypeDefinition(alternatives.map(typeShortcut))
	return rv.alternatives.length === 1 ? rv.alternatives[0] : rv
}

export function array(items: TypeDefinition = any): ArrayTypeDefinition {
	return new ArrayTypeDefinition(items)
}

export function record(items: TypeDefinition, nullable?: boolean): ComplexTypeDefinition {
	return object({}, { others: items, nullable })
}

export function object(
	properties: ObjectDefinition,
	options?: Partial<ObjectTypeOptions>
): ObjectTypeDefinition {
	return new ObjectTypeDefinition(properties, options)
}

export function literal(...values: any[]): LiteralTypeDefinition {
	return new LiteralTypeDefinition(...values)
}

export function tuple(
	mandatory: TypeDefinition[],
	optional?: TypeDefinition[],
	rest?: TypeDefinition
): TupleTypeDefinition {
	return new TupleTypeDefinition(mandatory, optional, rest)
}

export let primitive = {
	number: PrimitiveTypeDefinition.number,
	string: PrimitiveTypeDefinition.string,
	boolean: PrimitiveTypeDefinition.boolean
}

export function instance(type: NoParamConstructor): InstanceTypeDefinition {
	return new InstanceTypeDefinition(type)
}

// #endregion
// #region helpers

export function optional(value: any): TypeDefinition {
	return or(value, undefined)
}

function pureObject(x: any): boolean {
	return x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype
}

function guarded(check: boolean, factory: () => TypeError): TypeError {
	return check ? undefined : factory()
}

function firstError<T>(
	array: T[],
	typeCheck: (item: T, index: number) => TypeError | false,
	factory: (desc: { index: number; item: T; error: TypeError }) => TypeError
): TypeError {
	for (const [index, item] of array.entries()) {
		const error = typeCheck(item, index)
		if (error) return factory({ index, item, error })
	}
}

export function typeDescription(type: TypeDefinition): string {
	return typeof type === 'function' ? type.name : String(type)
}

function typeShortcut(type: TypeDefinition): ComplexTypeDefinition {
	if (type instanceof ComplexTypeDefinition) return type
	// Specific case: primitive
	if (typeof type === 'function' && primitiveTypeDefinition.has(type))
		return primitiveTypeDefinition.get(type)!
	// Specific case: object
	if (pureObject(type)) return object(<ObjectDefinition>type)
	// Specific case: literal
	if (
		['string', 'number', 'bigint', 'boolean', 'symbol', 'undefined'].includes(typeof type) ||
		type === null
	)
		return literal(type)
	// Specific case: array
	if (type instanceof Array) return or(...type)
	if (typeof type === 'function') return instance(type)
	throw new Error(`Unknown type: ${typeDescription(type)}`)
}

// #endregion
// #region engine

export function typeError(value: any, definition: TypeDefinition): TypeError {
	return typeShortcut(definition).check(value)
}

// #endregion
