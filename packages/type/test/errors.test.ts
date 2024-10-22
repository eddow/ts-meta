import { typed } from '../src'
import { devTools } from '@ts-meta/utilities'

describe('errors', () => {
	it('non-inferred field', () => {
		devTools.warn = jest.fn()
		@typed()
		class Test {
			@typed()
			foo: string | number = ''
		}
		expect(devTools.warn).toHaveBeenCalledWith(expect.stringMatching(/foo.*Test.*inferred/g))
	})
	it('non-inferred array', () => {
		devTools.warn = jest.fn()
		@typed()
		class Test {
			@typed()
			foo: string[] = []
		}
		expect(devTools.warn).toHaveBeenCalledWith(expect.stringMatching(/foo.*Test.*inferred/g))
	})
})
