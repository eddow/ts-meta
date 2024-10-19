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
	never,
	metaValidation,
	typed
} from '../src'

describe('type', () => {
	it('non-inferred field', () => {
		metaValidation.warn = jest.fn()
		@typed()
		class Test {
			@typed()
			foo: string | number = ''
		}
		expect(metaValidation.warn).toHaveBeenCalledWith(expect.stringMatching(/foo.*Test.*inferred/g))
	})
	it('non-inferred array', () => {
		metaValidation.warn = jest.fn()
		@typed()
		class Test {
			@typed()
			foo: string[] = []
		}
		expect(metaValidation.warn).toHaveBeenCalledWith(expect.stringMatching(/foo.*Test.*inferred/g))
	})
})
