import { rpcClientMethod, rpcServerMethod, transferable } from '../src'

let userIdSpace = 0

//#region common

@transferable.object
class User {
	readonly id: number
	name: string
	constructor(init: { id: number; name: string } = { id: 0, name: '' }) {
		this.id = init.id
		this.name = init.name
	}
}

@transferable.object
class UserListInterface {
	@transferable.server
	create(name: string): User {
		throw transferable.definitionOnly
	}
	update(change: Partial<User>): void {
		throw transferable.definitionOnly
	}
}

//#endregion
//#region server
class UserList extends UserListInterface {
	create(name: string): User {
		return new User({ id: ++userIdSpace, name })
	}
}
//#endregion
//#region client

//const ClientUserList = transferable.client(UserListInterface)

//#endregion
const rpcGlobals = {
	users: UserListInterface
}
