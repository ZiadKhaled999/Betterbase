import type { auth } from "./index"

export type Session = typeof auth.$Infer.Session.session
export type User = typeof auth.$Infer.Session.user

export type AuthVariables = {
  user: User
  session: Session
}
