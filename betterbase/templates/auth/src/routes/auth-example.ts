import { Hono } from "hono"
import { requireAuth } from "../middleware/auth"

const authExampleRoute = new Hono()

// Example: Get current user (protected route)
authExampleRoute.get("/me", requireAuth, async (c) => {
  const user = c.get("user")
  const session = c.get("session")

  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      token: session.token,
    },
  })
})

// Example: Protected route with requireAuth
authExampleRoute.get("/protected", requireAuth, async (c) => {
  const user = c.get("user")

  return c.json({
    message: `Hello, ${user.name}! This is a protected route.`,
    userId: user.id,
  })
})

// Example: Public route
authExampleRoute.get("/public", async (c) => {
  return c.json({
    message: "This is a public route. Anyone can access it.",
  })
})

export { authExampleRoute }
