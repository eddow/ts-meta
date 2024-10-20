export type PrimitiveType = String | Number | Boolean | undefined | null | Date | RegExp
export type RawObject = {
	[key: string]: ManageableObject | PrimitiveType
} & {
	constructor: ObjectConstructor
}

export abstract class Collection<T extends IdentifiedObject> {
	abstract get(uniqueId: string): T
}
export abstract class IdentifiedObject {
	abstract get uniqueId(): string
}

export type ManageableObject = IdentifiedObject | RawObject | any[]
