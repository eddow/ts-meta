/**
 * The whole file has for only purpose to have a scope as empty as possible - only the arguments names
 *  and the engine values (like __dirname, window, ...) are available to the evaluated code
 * (Yes, eval give to the evaluated string the same scope it has)
 */

export default function (functionToUnscope: (...unscopedArguments: any[]) => any) {
	return ((functionToUnscope: string) =>
		((functionToUnscope) =>
			function (...unscopedArguments: any[]) {
				try {
					return functionToUnscope(...unscopedArguments)
				} catch (e) {
					if (e instanceof ReferenceError)
						e.message =
							e.message +
							`
@ts-meta/reactivity: Functions are "un-scoped" in order to avoid memory leaks - cf. TODO:doc-link`

					throw e
				}
			})(
			/*
			 * All these IIFEs using one and only one argument name have on purpose the unscoped function
			 *	only has access to :
			 * -`functionToUnscope`: the function's code (string)
			 * -`unscopedArguments`: the arguments passed to the function
			 *
			 * Just making sure there is no way to escape this scope prison
			 */
			eval(`[${functionToUnscope}]`)[0]
		))(functionToUnscope.toString())
}
