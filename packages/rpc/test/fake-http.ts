export default function request<I = any, O = any>(
	fct: (path: string, body: I) => O,
	path: string,
	body: any
): Promise<O> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve(fct(path.toString(), JSON.parse(JSON.stringify(body))))
		})
	})
}
