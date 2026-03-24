# E-commerce

Build a complete e-commerce store with products, cart, orders, and payment integration.

## Features

- Product catalog with categories
- Shopping cart
- Order management
- Payment processing
- Inventory tracking
- User authentication

## Project Setup

```bash
bb init ecommerce
cd ecommerce
bb auth setup
```

## Schema

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  image: text('image')
})

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  image: text('image')
})

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  price: real('price').notNull(),
  comparePrice: real('compare_price'),
  images: text('images'), // JSON array
  inventory: integer('inventory').default(0),
  categoryId: text('category_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const cartItems = sqliteTable('cart_items', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  sessionId: text('session_id'),
  productId: text('product_id').notNull(),
  quantity: integer('quantity').default(1)
})

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  status: text('status').default('pending'),
  total: real('total').notNull(),
  shippingAddress: text('shipping_address'), // JSON
  paymentStatus: text('payment_status').default('pending'),
  paymentIntentId: text('payment_intent_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(new Date())
})

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  price: real('price').notNull()
})
```

## API Routes

### Products

```typescript
// src/routes/products.ts
import { Hono } from 'hono'
import { db } from '../db'
import { products, categories } from '../db/schema'
import { eq, desc } from 'drizzle-orm'

const productsRouter = new Hono()

// Get all products
productsRouter.get('/', async (c) => {
  const allProducts = await db.select().from(products).order(desc(products.createdAt))
  return c.json(allProducts)
})

// Get product by slug
productsRouter.get('/:slug', async (c) => {
  const slug = c.req.param('slug')
  const [product] = await db.select().from(products).where(eq(products.slug, slug))
  
  if (!product) {
    return c.json({ error: 'Product not found' }, 404)
  }
  
  return c.json(product)
})

// Get products by category
productsRouter.get('/category/:slug', async (c) => {
  const slug = c.req.param('slug')
  const [category] = await db.select().from(categories).where(eq(categories.slug, slug))
  
  if (!category) {
    return c.json({ error: 'Category not found' }, 404)
  }
  
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.categoryId, category.id))
  
  return c.json(allProducts)
})

export default productsRouter
```

### Cart

```typescript
// src/routes/cart.ts
import { Hono } from 'hono'
import { db } from '../db'
import { cartItems, products } from '../db/schema'
import { eq, and } from 'drizzle-orm'

const cartRouter = new Hono()

// Get cart items
cartRouter.get('/', async (c) => {
  const userId = c.get('user')?.id
  const sessionId = c.req.header('x-session-id')
  
  const items = await db
    .select({
      id: cartItems.id,
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      product: products
    })
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(
      userId 
        ? eq(cartItems.userId, userId)
        : eq(cartItems.sessionId, sessionId)
    )
  
  return c.json(items)
})

// Add to cart
cartRouter.post('/', async (c) => {
  const userId = c.get('user')?.id
  const sessionId = c.req.header('x-session-id')
  const { productId, quantity = 1 } = await c.req.json()
  
  // Check if already in cart
  const existing = await db
    .select()
    .from(cartItems)
    .where(
      and(
        eq(cartItems.productId, productId),
        userId 
          ? eq(cartItems.userId, userId)
          : eq(cartItems.sessionId, sessionId)
      )
    )
    .limit(1)
  
  if (existing.length > 0) {
    await db
      .update(cartItems)
      .set({ quantity: existing[0].quantity + quantity })
      .where(eq(cartItems.id, existing[0].id))
  } else {
    await db.insert(cartItems).values({
      id: crypto.randomUUID(),
      userId,
      sessionId,
      productId,
      quantity
    })
  }
  
  return c.json({ success: true })
})

// Update quantity
cartRouter.patch('/:id', async (c) => {
  const { quantity } = await c.req.json()
  const itemId = c.req.param('id')
  
  await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId))
  
  return c.json({ success: true })
})

// Remove from cart
cartRouter.delete('/:id', async (c) => {
  const itemId = c.req.param('id')
  await db.delete(cartItems).where(eq(cartItems.id, itemId))
  
  return c.json({ success: true })
})

export default cartRouter
```

### Orders

```typescript
// src/routes/orders.ts
import { Hono } from 'hono'
import { db } from '../db'
import { orders, orderItems, cartItems, products } from '../db/schema'
import { eq } from 'drizzle-orm'
import { auth } from '../auth'

const ordersRouter = new Hono()

// Create order
ordersRouter.post('/', auth, async (c) => {
  const user = c.get('user')
  const { shippingAddress } = await c.req.json()
  
  // Get cart items
  const items = await db
    .select()
    .from(cartItems)
    .leftJoin(products, eq(cartItems.productId, products.id))
    .where(eq(cartItems.userId, user.id))
  
  if (items.length === 0) {
    return c.json({ error: 'Cart is empty' }, 400)
  }
  
  // Calculate total
  const total = items.reduce((sum, item) => {
    return sum + (item.products?.price || 0) * item.cartItems.quantity
  }, 0)
  
  // Create order
  const orderId = crypto.randomUUID()
  await db.insert(orders).values({
    id: orderId,
    userId: user.id,
    total,
    shippingAddress: JSON.stringify(shippingAddress)
  })
  
  // Create order items and update inventory
  for (const item of items) {
    const product = item.products
    if (!product) continue
    
    await db.insert(orderItems).values({
      id: crypto.randomUUID(),
      orderId,
      productId: product.id,
      quantity: item.cartItems.quantity,
      price: product.price
    })
    
    // Update inventory
    await db
      .update(products)
      .set({ inventory: product.inventory - item.cartItems.quantity })
      .where(eq(products.id, product.id))
  }
  
  // Clear cart
  await db.delete(cartItems).where(eq(cartItems.userId, user.id))
  
  return c.json({ orderId, total }, 201)
})

// Get user orders
ordersRouter.get('/', auth, async (c) => {
  const user = c.get('user')
  
  const userOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .order(desc(orders.createdAt))
  
  return c.json(userOrders)
})

// Get order details
ordersRouter.get('/:id', auth, async (c) => {
  const user = c.get('user')
  const orderId = c.req.param('id')
  
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
  
  if (!order || order.userId !== user.id) {
    return c.json({ error: 'Order not found' }, 404)
  }
  
  const items = await db
    .select()
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))
  
  return c.json({ ...order, items })
})

export default ordersRouter
```

## Payment Integration

Process payments using a payment provider:

```typescript
// src/routes/checkout.ts
import { Hono } from 'hono'
import { stripe } from '../lib/payment'

const checkoutRouter = new Hono()

checkoutRouter.post('/create-payment-intent', auth, async (c) => {
  const user = c.get('user')
  const { orderId } = await c.req.json()
  
  // Get order total
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  
  // Create payment intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.total * 100), // Stripe uses cents
    currency: 'usd',
    metadata: { orderId }
  })
  
  // Update order with payment intent
  await db
    .update(orders)
    .set({ paymentIntentId: paymentIntent.id })
    .where(eq(orders.id, orderId))
  
  return c.json({ clientSecret: paymentIntent.client_secret })
})

// Webhook for payment success
checkoutRouter.post('/webhook', async (c) => {
  const sig = c.req.header('stripe-signature')
  const body = await c.req.text()
  
  try {
    const event = stripe.webhooks.constructEvent(
      body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    )
    
    if (event.type === 'payment_intent.succeeded') {
      const { orderId } = event.data.object.metadata
      
      await db
        .update(orders)
        .set({ 
          paymentStatus: 'paid',
          status: 'processing'
        })
        .where(eq(orders.id, orderId))
    }
  } catch (err) {
    return c.json({ error: 'Webhook error' }, 400)
  }
  
  return c.json({ received: true })
})

export default checkoutRouter
```

## Frontend Example

```typescript
// ProductCard.tsx
function ProductCard({ product }) {
  const addToCart = async () => {
    await client.from('cart').insert({
      productId: product.id,
      quantity: 1
    })
    // Show success notification
  }

  return (
    <div className="product-card">
      <img src={product.images?.[0]} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
      {product.inventory > 0 ? (
        <button onClick={addToCart}>Add to Cart</button>
      ) : (
        <span>Out of Stock</span>
      )}
    </div>
  )
}

// Cart.tsx
function Cart() {
  const [items, setItems] = useState([])

  useEffect(() => {
    loadCart()
  }, [])

  const loadCart = async () => {
    const { data } = await client.from('cart').select()
    setItems(data)
  }

  const total = items.reduce((sum, item) => 
    sum + item.product.price * item.quantity, 0
  )

  return (
    <div>
      {items.map(item => (
        <CartItem key={item.id} item={item} />
      ))}
      <div>Total: ${total}</div>
      <button>Checkout</button>
    </div>
  )
}
```

## What's Included

This example demonstrates:
- Product catalog
- Shopping cart
- Order management
- Inventory tracking
- Payment integration
- User authentication

## Related

- [Database Feature](../features/database.md) - Database operations
- [Auth Feature](../features/authentication.md) - User authentication
- [Client SDK](../api-reference/client-sdk.md) - Client usage
