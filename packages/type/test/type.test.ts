import {
	and,
	AndTypeDefinition,
	AndTypeErrorDesc,
	array,
	ArrayTypeErrorDesc,
	GivenTypeErrorDesc,
	typeError,
	literal,
	LiteralTypeErrorDesc,
	object,
	ObjectTypeErrorDesc,
	optional,
	or,
	OrTypeDefinition,
	OrTypeErrorDesc,
	SizeTypeErrorDesc,
	tuple,
	TypeErrorDesc,
	wildcards
} from '../src'

describe('type', () => {
	it('primitive', () => {
		expect(typeError('test', String)).toBe(undefined)
		expect(typeError(5, Number)).toBe(undefined)
		expect(typeError(true, Boolean)).toBe(undefined)
		expect(typeError(5, String)).toMatchObject(new GivenTypeErrorDesc('Wrong primitive', 5, String))
		expect(typeError(5, Boolean)).toMatchObject(
			new GivenTypeErrorDesc('Wrong primitive', 5, Boolean)
		)
	})
	it('literal', () => {
		const aLiteral = literal('test1', 'test2')
		expect(typeError('test', literal('test'))).toBe(undefined)
		expect(typeError('test', aLiteral)).toMatchObject(
			new LiteralTypeErrorDesc('Unexpected value', 'test', aLiteral)
		)
		expect(typeError(null, null)).toBe(undefined)
		expect(typeError(undefined, undefined)).toBe(undefined)
		expect(typeError(NaN, NaN)).toBe(undefined)
	})
	it('class', () => {
		class TestA {}
		const testA = new TestA()
		class TestB {}
		expect(typeError(testA, TestA)).toBe(undefined)
		expect(typeError(testA, TestB)).toMatchObject(
			new GivenTypeErrorDesc('Wrong class', testA, TestB)
		)
		expect(typeError(testA, Number)).toMatchObject(
			new GivenTypeErrorDesc('Wrong primitive', testA, Number)
		)
	})
	it('or', () => {
		expect(typeError(5, or(5, 6))).toBe(undefined)
		expect(typeError(5, or(6, 5))).toBe(undefined)
		expect(typeError(5, or(5, 6, 7))).toBe(undefined)
		expect(typeError(5, [6, 7, 5])).toBe(undefined)
		expect(typeError(5, [5, 6, 7, 8])).toBe(undefined)
		const failing = <OrTypeDefinition>or('yes', 'no', Boolean)
		expect(typeError(5, failing)).toMatchObject(
			new OrTypeErrorDesc('No option fitting', 5, failing, [
				new GivenTypeErrorDesc('Wrong primitive', 5, Boolean),
				new LiteralTypeErrorDesc('Unexpected value', 5, literal('yes', 'no'))
			])
		)
	})
	it('and', () => {
		expect(typeError(5, and(5, Number))).toBe(undefined)
		expect(typeError(5, and(5, 6))).toMatchObject(
			new AndTypeErrorDesc(
				'Option not fitting',
				5,
				<AndTypeDefinition>and(5, 6),
				new LiteralTypeErrorDesc('Unexpected value', 5, literal(6)),
				1
			)
		)
	})
	it('array', () => {
		expect(typeError([5, 6, 7, 8], array(Number))).toBe(undefined)
		expect(typeError([5, 6, false, 8], array(Number))).toMatchObject(
			new ArrayTypeErrorDesc(
				'Wrong array entry',
				[5, 6, false, 8],
				array(Number),
				new GivenTypeErrorDesc('Wrong primitive', false, Number),
				2
			)
		)
		expect(typeError([5, 6, false, 8], array([Number, Boolean]))).toBe(undefined)
	})
	it('tuple', () => {
		expect(typeError([5, false], tuple([Number, Boolean]))).toBe(undefined)
		expect(typeError([5, false, 'qwe'], tuple([Number, Boolean]))).toMatchObject(
			new SizeTypeErrorDesc('Tuple length error', [5, false, 'qwe'], tuple([Number, Boolean]), {
				min: 2,
				max: 2
			})
		)
		expect(typeError([5, false], tuple([Number, Boolean], [String]))).toBe(undefined)
		expect(typeError([5, false, 'qwe'], tuple([Number, Boolean], [String]))).toBe(undefined)
		expect(typeError([false, 'qwe', 1, 2, 3, 4], tuple([Boolean], [String], Number))).toBe(
			undefined
		)
		expect(typeError([false, 1, 2, 3, 4], tuple([Boolean], [String], Number))).toMatchObject(
			new ArrayTypeErrorDesc(
				`Wrong optional tuple entry`,
				[false, 1, 2, 3, 4],
				tuple([Boolean], [String], Number),
				new GivenTypeErrorDesc('Wrong primitive', 1, String),
				1
			)
		)
		expect(
			typeError([false, 'qwe', 1, 'asd', 2, 3, 4], tuple([Boolean], [String], Number))
		).toMatchObject(
			new ArrayTypeErrorDesc(
				`Wrong rest tuple entry`,
				[false, 'qwe', 1, 'asd', 2, 3, 4],
				tuple([Boolean], [String], Number),
				new GivenTypeErrorDesc('Wrong primitive', 'asd', Number),
				3
			)
		)
	})
	it('object', () => {
		expect(typeError({ x: 5 }, object({ x: Number }))).toBe(undefined)
		expect(typeError({ x: 5 }, { x: String })).toMatchObject(
			new ObjectTypeErrorDesc(
				`Wrong specified property`,
				{ x: 5 },
				object({ x: String }),
				new GivenTypeErrorDesc('Wrong primitive', 5, String),
				'x'
			)
		)
		expect(typeError({ x: 5 }, { x: Number, y: optional(Number) })).toBe(undefined)
		expect(typeError({ x: 5, y: 6 }, { x: Number, y: optional(Number) })).toBe(undefined)
	})
	it('object options', () => {
		expect(typeError(null, null)).toBe(undefined)
		expect(typeError(null, { x: 5 })).toMatchObject(
			new GivenTypeErrorDesc('Unexpected `null`', null, object({ x: 5 }))
		)
		expect(typeError(null, object({ x: 5 }, { nullable: true }))).toBe(undefined)
		expect(typeError(null, [{ x: 5 }, null])).toBe(undefined)
		expect(typeError({ x: 5, y: 6 }, { x: Number })).toMatchObject(
			new ObjectTypeErrorDesc(
				'Wrong other property',
				{ x: 5, y: 6 },
				object({ x: Number }),
				new GivenTypeErrorDesc('Unexpected value', 6, wildcards.never),
				'y'
			)
		)
		expect(typeError({ x: 5, y: '6' }, object({ x: Number }, { others: String }))).toBe(undefined)
	})
})
